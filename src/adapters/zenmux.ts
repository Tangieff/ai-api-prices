import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

const MODELS_URL = 'https://zenmux.ai/api/v1/models';

/**
 * ZenMux's structured catalogue (https://zenmux.ai/api/v1/models) publishes
 * every price as `{ value, unit: "perMTokens", currency: "USD" }` -- the
 * value is already USD per 1M tokens, so it must NOT be multiplied or
 * divided before use. `unit` and `currency` are asserted on every single
 * price entry below and any deviation throws, because a silent unit change
 * (say, to "perToken") would otherwise turn into a 1,000,000x pricing bug.
 */
const EXPECTED_UNIT = 'perMTokens';
const EXPECTED_CURRENCY = 'USD';
/** The tiering condition ZenMux attaches to some entries is a prompt-length
 * bucket, e.g. `{ prompt_tokens: { unit: "kTokens", gte: 272 } }`. */
const EXPECTED_CONDITION_UNIT = 'kTokens';

interface PromptTokensCondition {
  unit?: unknown;
  gte?: unknown;
  gt?: unknown;
  lt?: unknown;
  lte?: unknown;
}

interface RawPriceEntry {
  value?: unknown;
  unit?: unknown;
  currency?: unknown;
  conditions?: unknown;
}

interface ParsedPriceEntry {
  value: number;
  condition: PromptTokensCondition | null;
}

interface ModelRow {
  id?: unknown;
  display_name?: unknown;
  /** Vendor slug, used to tell a vendor label apart from the model's own name. */
  owned_by?: unknown;
  input_modalities?: unknown;
  output_modalities?: unknown;
  pricings?: unknown;
}

interface ModelsResponse {
  data?: unknown;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Validate one `{ value, unit, currency, conditions? }` entry and extract its
 * optional prompt-length condition. Throws on any unit/currency drift. */
function assertPriceEntry(entry: unknown, label: string): ParsedPriceEntry {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`ZenMux: ${label} is not an object`);
  }
  const raw = entry as RawPriceEntry;
  if (typeof raw.value !== 'number' || !Number.isFinite(raw.value) || raw.value < 0) {
    throw new Error(`ZenMux: ${label} has a non-numeric or negative value`);
  }
  if (raw.unit !== EXPECTED_UNIT) {
    throw new Error(
      `ZenMux: ${label} unit changed from "${EXPECTED_UNIT}" to "${String(raw.unit)}" -- refusing to guess the scale`,
    );
  }
  if (raw.currency !== EXPECTED_CURRENCY) {
    throw new Error(
      `ZenMux: ${label} currency changed from "${EXPECTED_CURRENCY}" to "${String(raw.currency)}"`,
    );
  }

  if (raw.conditions === undefined || raw.conditions === null) {
    return { value: raw.value, condition: null };
  }
  if (typeof raw.conditions !== 'object') {
    throw new Error(`ZenMux: ${label} has a malformed conditions field`);
  }
  const promptTokens = (raw.conditions as { prompt_tokens?: unknown }).prompt_tokens;
  if (!promptTokens || typeof promptTokens !== 'object') {
    throw new Error(`ZenMux: ${label} conditions is missing a prompt_tokens range`);
  }
  const condition = promptTokens as PromptTokensCondition;
  if (condition.unit !== EXPECTED_CONDITION_UNIT) {
    throw new Error(
      `ZenMux: ${label} condition unit changed from "${EXPECTED_CONDITION_UNIT}" to "${String(condition.unit)}"`,
    );
  }
  return { value: raw.value, condition };
}

/** Validate a whole pricings[key] array. Returns null when the key is absent
 * (no price published for that billing item); throws when it is present but
 * shaped wrong (present-but-empty, not an array, or a bad entry). */
function assertPriceArray(value: unknown, label: string): ParsedPriceEntry[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`ZenMux: ${label} is present but not a non-empty array`);
  }
  return value.map((entry, index) => assertPriceEntry(entry, `${label}[${index}]`));
}

/** A stable key for comparing whether two entries describe the same
 * prompt-length bucket (or both describe no bucket at all). */
function conditionKey(condition: PromptTokensCondition | null): string {
  if (!condition) return 'unconditional';
  const at = (field: 'gte' | 'gt' | 'lt' | 'lte'): string =>
    typeof condition[field] === 'number' ? String(condition[field]) : '_';
  return `gte:${at('gte')}|gt:${at('gt')}|lt:${at('lt')}|lte:${at('lte')}`;
}

/** Render a prompt-length condition as a human-readable tier label, e.g.
 * "prompt >= 272K tokens". */
function describeCondition(condition: PromptTokensCondition): string {
  const parts: string[] = [];
  if (typeof condition.gte === 'number' && condition.gte > 0) parts.push(`>= ${condition.gte}K`);
  if (typeof condition.gt === 'number') parts.push(`> ${condition.gt}K`);
  if (typeof condition.lt === 'number') parts.push(`< ${condition.lt}K`);
  if (typeof condition.lte === 'number') parts.push(`<= ${condition.lte}K`);
  if (parts.length === 0) {
    throw new Error('ZenMux: prompt_tokens condition carries no usable bound');
  }
  return `prompt ${parts.join(' ')} tokens`;
}

/**
 * Turn one model row's `pricings` object into zero or more RawOffer rows.
 *
 * ZenMux sometimes publishes more than one entry per billing item -- not as
 * alternative list prices, but as prompt-length tiers (e.g. gpt-5.6-sol bills
 * $4 in / $20 out per 1M tokens under a 272K prompt, and $8 in / $30 out at
 * or above it -- see the fixtures). Each entry then carries a
 * `conditions.prompt_tokens` range.
 * We only ever emit multi-entry pricing as distinct tiered rows when EVERY
 * entry in both the prompt and completion arrays carries a condition, and
 * the prompt/completion entries pair up index-for-index on an identical
 * condition. If that pairing cannot be established with confidence -- for
 * example deepseek/deepseek-v4-pro, which (as observed on 2026-08-31)
 * repeats six untagged, condition-less completion entries with duplicate
 * values -- we fail closed and skip the model entirely rather than guessing
 * which entry is "the" price. This is a deliberate, documented choice: we
 * never silently take "the first entry" when the array is ambiguous.
 *
 * Only `prompt` -> input, `completion` -> output and `input_cache_read` ->
 * cache_read are mapped, per spec. The `input_cache_write_1_h` /
 * `input_cache_write_5_min` / `input_cache_write` keys are intentionally
 * left unmapped: ZenMux publishes more than one cache-write product and
 * there is no single unambiguous `cache_write_usd_per_1m` to assign.
 */
function buildOffersForModel(row: ModelRow, pricings: Record<string, unknown>): RawOffer[] {
  const promptEntries = assertPriceArray(pricings.prompt, `${String(row.id)}.pricings.prompt`);
  const completionEntries = assertPriceArray(
    pricings.completion,
    `${String(row.id)}.pricings.completion`,
  );
  // Both input and output prices are required.
  if (!promptEntries || !completionEntries) return [];
  if (promptEntries.length !== completionEntries.length) return [];

  const cacheReadEntries = assertPriceArray(
    pricings.input_cache_read,
    `${String(row.id)}.pricings.input_cache_read`,
  );

  const tierCount = promptEntries.length;
  const offers: RawOffer[] = [];

  for (let i = 0; i < tierCount; i += 1) {
    const promptEntry = promptEntries[i];
    const completionEntry = completionEntries[i];
    if (!promptEntry || !completionEntry) return [];

    const promptKey = conditionKey(promptEntry.condition);
    const completionKey = conditionKey(completionEntry.condition);

    if (tierCount > 1) {
      if (!promptEntry.condition || !completionEntry.condition || promptKey !== completionKey) {
        // Cannot confidently pair a multi-entry array to distinct tiers -- fail closed.
        return [];
      }
    } else if (promptKey !== completionKey) {
      // A single entry each, but their (absent-or-present) conditions disagree.
      return [];
    }

    const input = positive(promptEntry.value);
    const output = positive(completionEntry.value);
    if (input === null || output === null) return [];

    let cacheRead: number | null = null;
    if (cacheReadEntries && cacheReadEntries.length === tierCount) {
      const cacheEntry = cacheReadEntries[i];
      if (cacheEntry && conditionKey(cacheEntry.condition) === promptKey) {
        cacheRead = positive(cacheEntry.value);
      }
    }

    offers.push({
      provider_model_id: String(row.id),
      display_name: cleanDisplayName(row.display_name, row.owned_by),
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: cacheRead,
      tier: tierCount > 1 ? describeCondition(promptEntry.condition as PromptTokensCondition) : null,
      source_url: MODELS_URL,
    });
  }

  return offers;
}

/** Fold a label to comparable letters and digits, e.g. "Z.AI" -> "zai". */
function foldVendor(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * ZenMux labels each model "Anthropic: Claude Opus 5". The refresh pipeline
 * canonicalises the display name in preference to the id, and that prose form
 * has no namespace separator to strip, so it would fold to "anthropic:-claude-
 * opus-5" — a model with no official baseline and so no savings figure. Drop
 * the vendor label and keep the model name; the id stays verbatim regardless.
 *
 * Only a genuine vendor label is dropped. The colon in a name like
 * "GPT-5.6: Sol" belongs to the model, and cutting at it would leave "Sol",
 * which canonicalises to an id no baseline matches — silently stranding the
 * row instead of pricing the model. A prefix qualifies when it matches the
 * row's own `owned_by`, or when it carries no digit, which every vendor label
 * in this catalogue satisfies and no versioned model name does.
 */
function cleanDisplayName(raw: unknown, ownedBy: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const whole = raw.trim();
  const split = /^([^:]+):\s*(.+)$/.exec(whole);
  if (!split) return whole.length > 0 ? whole : undefined;

  const [, prefix, rest] = split;
  const matchesOwner =
    typeof ownedBy === 'string' && foldVendor(prefix!) === foldVendor(ownedBy);
  const looksLikeVendor = !/\d/.test(prefix!);
  if (!matchesOwner && !looksLikeVendor) return whole;

  const withoutVendor = rest!.trim();
  return withoutVendor.length > 0 ? withoutVendor : whole;
}

export function parseModels(payload: unknown): RawOffer[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as ModelsResponse).data)) {
    throw new Error('ZenMux: models response missing data array');
  }

  const response = payload as ModelsResponse;
  const offers: RawOffer[] = [];

  for (const entry of response.data as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as ModelRow;
    if (typeof row.id !== 'string' || !isComparableTextTokenModel(row.id)) continue;

    // Reject anything whose output isn't plain text (image/video/audio/embeddings/...).
    const outputModalities = row.output_modalities;
    if (
      !Array.isArray(outputModalities) ||
      outputModalities.length === 0 ||
      !outputModalities.every((modality) => modality === 'text')
    ) {
      continue;
    }

    // Require a text input surface too (multimodal input like image/file is fine).
    const inputModalities = row.input_modalities;
    if (!Array.isArray(inputModalities) || !inputModalities.includes('text')) continue;

    if (!row.pricings || typeof row.pricings !== 'object') continue;

    offers.push(...buildOffersForModel(row, row.pricings as Record<string, unknown>));
  }

  if (offers.length === 0) throw new Error('ZenMux: no priced text-token models found');
  return offers;
}

export const zenmuxAdapter: Adapter = {
  provider_id: 'zenmux',
  source_kind: 'api',
  async fetchOffers() {
    return parseModels(await fetchJson<unknown>(MODELS_URL));
  },
};
