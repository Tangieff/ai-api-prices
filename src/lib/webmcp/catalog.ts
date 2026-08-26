import { MICROS_PER_USD, toMicros } from '../money';
import { COST_SCORE_LABEL, compareOffers, costScoreMicros } from '../score';
import { matches, normalise } from '../search';
import type { OfficialPriceBaseline } from '../official-prices';
import type { ModelView, OfferView, PageData } from '../view';

/**
 * The query layer behind the WebMCP tools.
 *
 * Everything here is pure, synchronous and DOM-free so it can be unit tested in
 * node and reused by any caller. It deliberately owns no *pricing* rules of its
 * own: model identity comes from `lib/search`, ranking from `lib/score`, and
 * money from `lib/money`. An agent must never be able to read a different price
 * from the one a human sees, so forking any of those rules here would be a bug,
 * not an optimisation. Result *ordering* is chosen per tool — a search returns
 * cheapest-first where the page leads with coverage — and each tool says so.
 */

/**
 * Exactly the slice of the page's data the tools need.
 *
 * Narrower than `PageData` on purpose: `provider_status` carries scraper error
 * strings that belong in the server log, not in a payload shipped to every
 * browser. `PageData` still satisfies this, so callers can pass either.
 */
export type PriceIndex = Pick<PageData, 'models' | 'providers' | 'generated_at'>;

/** Stated on every result. Agents otherwise guess per-token or per-1K. */
export const PRICE_UNIT = 'USD per 1M tokens';

/** Ceiling on a single token field. Keeps BigInt intermediates inside the safe range and bounds abuse. */
export const MAX_TOKENS_PER_FIELD = 1_000_000_000_000;

/** Hard cap on rows returned by any tool, so a prompt cannot ask for the whole catalogue. */
export const MAX_RESULTS = 25;

/** Comparing more than a handful of models produces output no agent reads usefully. */
export const MAX_MODELS_PER_COMPARISON = 5;

/**
 * Cap on any free-text field.
 *
 * No real model or maker name comes close. The cap exists because every one of
 * these strings is normalised and matched against the whole catalogue, so an
 * unbounded string is an invitation to burn CPU on a prompt-supplied value.
 */
export const MAX_TEXT_INPUT_LENGTH = 120;

/** Prices are per 1M tokens, so a token count divides by this before it becomes money. */
const TOKENS_PER_PRICE_UNIT = 1_000_000n;

export interface ProviderPrice {
  provider_id: string;
  provider_name: string;
  visit_url: string;
  tier: string | null;
  input_usd_per_1m: number | null;
  output_usd_per_1m: number | null;
  cache_read_usd_per_1m: number | null;
  cache_write_usd_per_1m: number | null;
  discount_pct: number | null;
  discount_unavailable_reason: string | null;
  observed_at: string;
  stale: boolean;
  is_cheapest: boolean;
}

export interface ModelIdentity {
  id: string;
  display_name: string;
  maker: string | null;
}

export interface SearchModelsParams {
  query?: unknown;
  maker?: unknown;
  max_input_usd_per_1m?: unknown;
  max_output_usd_per_1m?: unknown;
  min_providers?: unknown;
  limit?: unknown;
}

export interface SearchModelEntry extends ModelIdentity {
  provider_count: number;
  best_input_usd_per_1m: number | null;
  best_output_usd_per_1m: number | null;
  best_discount_pct: number | null;
  cheapest: {
    provider_id: string;
    provider_name: string;
    input_usd_per_1m: number | null;
    output_usd_per_1m: number | null;
    discount_pct: number | null;
  } | null;
}

export interface SearchModelsResult {
  price_unit: string;
  /** UTC instant the underlying price snapshot was generated. */
  generated_at: string | null;
  ranking: string;
  filters: {
    query: string | null;
    maker: string | null;
    max_input_usd_per_1m: number | null;
    max_output_usd_per_1m: number | null;
    min_providers: number | null;
  };
  total_matched: number;
  returned: number;
  models: SearchModelEntry[];
}

export interface ModelNotFound {
  found: false;
  requested: string;
  reason: string;
  suggestions: string[];
}

export interface ProviderComparison {
  found: true;
  price_unit: string;
  generated_at: string | null;
  ranking: string;
  model: ModelIdentity;
  official_baseline: OfficialPriceBaseline | null;
  provider_count: number;
  returned: number;
  cheapest: ProviderPrice | null;
  providers: ProviderPrice[];
}

export interface InvalidInput {
  ok: false;
  error: string;
}

export interface WorkloadProviderCost {
  provider_id: string;
  provider_name: string;
  visit_url: string;
  tier: string | null;
  input_usd_per_1m: number | null;
  output_usd_per_1m: number | null;
  input_usd: number;
  output_usd: number;
  total_usd: number;
}

export interface WorkloadModelResult {
  requested: string;
  resolved: ModelIdentity | null;
  cheapest: WorkloadProviderCost | null;
  providers: WorkloadProviderCost[];
  not_costable: { provider_id: string; provider_name: string; reason: string }[];
}

export interface WorkloadEstimate {
  ok: true;
  price_unit: string;
  generated_at: string | null;
  currency: 'USD';
  workload: { input_tokens: number; output_tokens: number };
  cheapest_overall:
    | { model_id: string; display_name: string; provider_id: string; provider_name: string; total_usd: number }
    | null;
  models: WorkloadModelResult[];
  unresolved: string[];
}

export interface CompareModelsEntry {
  requested: string;
  resolved: ModelIdentity | null;
  provider_count: number | null;
  /**
   * Lowest input and lowest output price anywhere in the market for this model.
   * These are independent minima and may come from two different providers, so
   * they must never be presented as a price pair one provider sells — use
   * `cheapest_provider` for that.
   */
  market_low_input_usd_per_1m: number | null;
  market_low_output_usd_per_1m: number | null;
  best_discount_pct: number | null;
  /** The single best-value provider, with the prices that provider actually charges. */
  cheapest_provider: {
    provider_id: string;
    provider_name: string;
    input_usd_per_1m: number | null;
    output_usd_per_1m: number | null;
  } | null;
  workload: WorkloadProviderCost | null;
}

export interface ModelComparison {
  ok: true;
  price_unit: string;
  generated_at: string | null;
  ranking: string;
  workload: { input_tokens: number; output_tokens: number } | null;
  models: CompareModelsEntry[];
  unresolved: string[];
  cheapest_overall:
    | { model_id: string; display_name: string; provider_id: string; provider_name: string; total_usd: number }
    | null;
}

/** Round a USD figure to micro-USD precision so output is stable across calls. */
function roundUsd(usd: number | null): number | null {
  if (usd === null || !Number.isFinite(usd)) return null;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Clamp a caller-supplied row count into 1..MAX_RESULTS, falling back when it is not a number. */
export function clampLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const floored = Math.floor(value);
  if (floored < 1) return 1;
  if (floored > MAX_RESULTS) return MAX_RESULTS;
  return floored;
}

/** A price ceiling is only a filter when it is a usable non-negative number. */
function priceCeiling(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_INPUT_LENGTH) : '';
}

function providerName(data: PriceIndex, providerId: string): string {
  return data.providers[providerId]?.name ?? providerId;
}

function providerVisitUrl(data: PriceIndex, providerId: string): string {
  return data.providers[providerId]?.visit_url ?? '';
}

/**
 * Order offers exactly the way the page does.
 *
 * Stale rows sort after fresh ones before price is even considered — the same
 * rule `buildPageData` applies — so a provider whose refresh failed can never
 * head a list captioned "cheapest first" on the strength of a price nobody can
 * currently buy. Within a freshness band the canonical `compareOffers` decides,
 * rather than a second comparator that could drift away from it.
 */
function rankOffers(offers: OfferView[]): OfferView[] {
  return [...offers].sort(
    (a, b) => Number(a.stale) - Number(b.stale) || compareOffers(a, b),
  );
}

/** Offers whose provider refreshed successfully. A stale row can never win a comparison. */
function freshOffers(model: ModelView): OfferView[] {
  return model.offers.filter((offer) => !offer.stale);
}

/** The cheapest comparable fresh offer, or null when nothing is comparable. */
function cheapestFreshOffer(model: ModelView): OfferView | null {
  return rankOffers(freshOffers(model)).find((offer) => costScoreMicros(offer) !== null) ?? null;
}

/**
 * Resolve a free-text model name to one catalogue entry.
 *
 * Exact id and exact display name win outright so a precise caller is never
 * second-guessed. Otherwise the site's own search predicate decides, and among
 * several matches the most widely stocked model wins — "opus" should land on the
 * model a dozen providers sell, not an obscure one-provider variant.
 */
export function resolveModel(data: PriceIndex, query: unknown): ModelView | null {
  const trimmed = trimmedString(query);
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();

  const byId = data.models.find((model) => model.id.toLowerCase() === lowered);
  if (byId) return byId;

  const byName = data.models.find((model) => model.display_name.toLowerCase() === lowered);
  if (byName) return byName;

  const candidates = data.models.filter((model) => matches(model.search_text, trimmed));
  if (candidates.length === 0) return null;

  return (
    [...candidates].sort(
      (a, b) => b.provider_count - a.provider_count || a.display_name.localeCompare(b.display_name),
    )[0] ?? null
  );
}

/** A few near-miss names, so a failed lookup gives the agent something to retry with. */
function suggestModels(data: PriceIndex, query: string, limit = 5): string[] {
  const needle = normalise(query);
  if (!needle) return [];
  return data.models
    .filter((model) => normalise(model.search_text).includes(needle.slice(0, 4)))
    .sort((a, b) => b.provider_count - a.provider_count || a.display_name.localeCompare(b.display_name))
    .slice(0, limit)
    .map((model) => model.display_name);
}

function notFound(data: PriceIndex, requested: string): ModelNotFound {
  return {
    found: false,
    requested,
    reason: requested
      ? `No model in the index matches "${requested}".`
      : 'A model name is required.',
    suggestions: requested ? suggestModels(data, requested) : [],
  };
}

/** Search and filter the model index. */
export function searchModels(data: PriceIndex, params: SearchModelsParams): SearchModelsResult {
  const query = trimmedString(params.query);
  const maker = trimmedString(params.maker).toLowerCase();
  const maxInput = priceCeiling(params.max_input_usd_per_1m);
  const maxOutput = priceCeiling(params.max_output_usd_per_1m);
  const minProvidersRaw = params.min_providers;
  const minProviders =
    typeof minProvidersRaw === 'number' && Number.isFinite(minProvidersRaw) && minProvidersRaw >= 1
      ? Math.floor(minProvidersRaw)
      : null;
  const limit = clampLimit(params.limit, 10);

  const matched = data.models.filter((model) => {
    if (query && !matches(model.search_text, query)) return false;
    if (maker && !(model.maker ?? '').toLowerCase().includes(maker)) return false;
    if (minProviders !== null && model.provider_count < minProviders) return false;

    if (maxInput !== null || maxOutput !== null) {
      const affordable = freshOffers(model).some((offer) => {
        if (maxInput !== null && (offer.input_usd_per_1m === null || offer.input_usd_per_1m > maxInput)) {
          return false;
        }
        if (maxOutput !== null && (offer.output_usd_per_1m === null || offer.output_usd_per_1m > maxOutput)) {
          return false;
        }
        return true;
      });
      if (!affordable) return false;
    }

    return true;
  });

  const ordered = [...matched].sort((a, b) => {
    const scoreA = costScoreMicros(cheapestFreshOffer(a) ?? { input_usd_per_1m: null, output_usd_per_1m: null });
    const scoreB = costScoreMicros(cheapestFreshOffer(b) ?? { input_usd_per_1m: null, output_usd_per_1m: null });
    if (scoreA !== null && scoreB !== null && scoreA !== scoreB) return scoreA - scoreB;
    if (scoreA !== null && scoreB === null) return -1;
    if (scoreA === null && scoreB !== null) return 1;
    return a.display_name.localeCompare(b.display_name);
  });

  const models = ordered.slice(0, limit).map((model): SearchModelEntry => {
    const cheapest = cheapestFreshOffer(model);
    return {
      id: model.id,
      display_name: model.display_name,
      maker: model.maker,
      provider_count: model.provider_count,
      best_input_usd_per_1m: roundUsd(model.best_input_usd_per_1m),
      best_output_usd_per_1m: roundUsd(model.best_output_usd_per_1m),
      best_discount_pct: model.best_discount_pct,
      cheapest: cheapest
        ? {
            provider_id: cheapest.provider_id,
            provider_name: providerName(data, cheapest.provider_id),
            input_usd_per_1m: roundUsd(cheapest.input_usd_per_1m),
            output_usd_per_1m: roundUsd(cheapest.output_usd_per_1m),
            discount_pct: cheapest.discount_pct,
          }
        : null,
    };
  });

  return {
    price_unit: PRICE_UNIT,
    generated_at: data.generated_at,
    ranking: COST_SCORE_LABEL,
    filters: {
      query: query || null,
      maker: trimmedString(params.maker) || null,
      max_input_usd_per_1m: maxInput,
      max_output_usd_per_1m: maxOutput,
      min_providers: minProviders,
    },
    total_matched: matched.length,
    returned: models.length,
    models,
  };
}

export interface ProviderComparisonParams {
  model?: unknown;
  limit?: unknown;
  include_stale?: unknown;
}

/** Every provider selling one model, cheapest first. */
export function compareProvidersForModel(
  data: PriceIndex,
  params: ProviderComparisonParams,
): ProviderComparison | ModelNotFound {
  const requested = trimmedString(params.model);
  const model = resolveModel(data, requested);
  if (!model) return notFound(data, requested);

  const includeStale = params.include_stale === true;
  const limit = clampLimit(params.limit, 10);
  const cheapest = cheapestFreshOffer(model);
  const source = includeStale ? model.offers : freshOffers(model);

  const ranked = rankOffers(source);
  const toProviderPrice = (offer: OfferView): ProviderPrice => ({
    provider_id: offer.provider_id,
    provider_name: providerName(data, offer.provider_id),
    visit_url: providerVisitUrl(data, offer.provider_id),
    tier: offer.tier,
    input_usd_per_1m: roundUsd(offer.input_usd_per_1m),
    output_usd_per_1m: roundUsd(offer.output_usd_per_1m),
    cache_read_usd_per_1m: roundUsd(offer.cache_read_usd_per_1m),
    cache_write_usd_per_1m: roundUsd(offer.cache_write_usd_per_1m),
    discount_pct: offer.discount_pct,
    discount_unavailable_reason: offer.discount_unavailable_reason,
    observed_at: offer.observed_at,
    stale: offer.stale,
    is_cheapest: offer === cheapest,
  });

  const providers = ranked.slice(0, limit).map(toProviderPrice);

  return {
    found: true,
    price_unit: PRICE_UNIT,
    generated_at: data.generated_at,
    ranking: COST_SCORE_LABEL,
    model: { id: model.id, display_name: model.display_name, maker: model.maker },
    official_baseline: model.official_baseline,
    provider_count: model.provider_count,
    returned: providers.length,
    // Derived from the full ranking, not the truncated page: a small `limit`
    // must not be able to report "no cheapest provider" when one exists.
    cheapest: cheapest ? toProviderPrice(cheapest) : null,
    providers,
  };
}

export type TokenValidation =
  | { ok: true; input_tokens: number; output_tokens: number }
  | InvalidInput;

/**
 * Validate a workload.
 *
 * Tool arguments arrive from a language model, so every field is treated as
 * hostile: `NaN`, `Infinity`, negatives, strings and objects all fail closed
 * with an explanation the agent can act on rather than throwing. Fractional
 * token counts are rounded because a fraction of a token is not a thing anyone
 * can buy.
 */
export function validateWorkload(inputTokens: unknown, outputTokens: unknown): TokenValidation {
  const input = normaliseTokenCount(inputTokens);
  const output = normaliseTokenCount(outputTokens);
  if (input === null) {
    return { ok: false, error: `input_tokens must be a number between 0 and ${MAX_TOKENS_PER_FIELD}` };
  }
  if (output === null) {
    return { ok: false, error: `output_tokens must be a number between 0 and ${MAX_TOKENS_PER_FIELD}` };
  }
  if (input === 0 && output === 0) {
    return { ok: false, error: 'input_tokens and output_tokens cannot both be zero' };
  }
  return { ok: true, input_tokens: input, output_tokens: output };
}

function normaliseTokenCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > MAX_TOKENS_PER_FIELD) return null;
  return Math.round(value);
}

export type ModelListValidation = { ok: true; models: string[] } | InvalidInput;

/** Validate a caller-supplied list of model names. */
export function validateModelList(value: unknown, min: number, max: number): ModelListValidation {
  if (!Array.isArray(value)) return { ok: false, error: 'models must be an array of model names' };
  const names = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
  if (names.length !== value.length) {
    return { ok: false, error: 'models must contain only non-empty strings' };
  }
  if (names.length < min) return { ok: false, error: `models must contain at least ${min} name(s)` };
  if (names.length > max) return { ok: false, error: `models must contain at most ${max} name(s)` };
  return { ok: true, models: names.map((name) => name.trim().slice(0, MAX_TEXT_INPUT_LENGTH)) };
}

/** Integer micro-USD to USD. The caller has already bounded the value, so this cannot fail. */
function usdFromMicros(micros: bigint): number {
  return Number(micros) / MICROS_PER_USD;
}

/** Largest micro-USD amount that survives the trip through a JSON number intact. */
const MAX_SAFE_MICROS = BigInt(Number.MAX_SAFE_INTEGER);

/** Exact integer division with half-up rounding, matching `lib/effective-cost`. */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

type OfferCost =
  | { ok: true; input: bigint; output: bigint; total: bigint }
  | { ok: false; reason: string };

/**
 * Cost of one offer for a workload, in exact integer micro-USD.
 *
 * `price_per_1m * tokens` reaches ~1e19 for a large workload, far past
 * `Number.MAX_SAFE_INTEGER`, so everything up to and including the total stays
 * in BigInt. Input and output are rounded separately, which is what makes the
 * two published components add up to the published total exactly rather than
 * approximately. Only the total is range-checked, because it is the largest of
 * the three and bounds the other two.
 */
function offerWorkloadCost(offer: OfferView, inputTokens: number, outputTokens: number): OfferCost {
  const inputPrice = toMicros(offer.input_usd_per_1m);
  const outputPrice = toMicros(offer.output_usd_per_1m);
  if (inputPrice === null || outputPrice === null) {
    return { ok: false, reason: 'Provider does not publish both an input and an output price' };
  }

  const input = divideRoundHalfUp(BigInt(inputPrice) * BigInt(inputTokens), TOKENS_PER_PRICE_UNIT);
  const output = divideRoundHalfUp(BigInt(outputPrice) * BigInt(outputTokens), TOKENS_PER_PRICE_UNIT);
  const total = input + output;
  if (total > MAX_SAFE_MICROS) {
    return { ok: false, reason: 'Workload cost is too large to report exactly' };
  }

  return { ok: true, input, output, total };
}

function toWorkloadCost(
  data: PriceIndex,
  offer: OfferView,
  cost: { input: bigint; output: bigint; total: bigint },
): WorkloadProviderCost {
  return {
    provider_id: offer.provider_id,
    provider_name: providerName(data, offer.provider_id),
    visit_url: providerVisitUrl(data, offer.provider_id),
    tier: offer.tier,
    input_usd_per_1m: roundUsd(offer.input_usd_per_1m),
    output_usd_per_1m: roundUsd(offer.output_usd_per_1m),
    input_usd: usdFromMicros(cost.input),
    output_usd: usdFromMicros(cost.output),
    total_usd: usdFromMicros(cost.total),
  };
}

interface CostedModel {
  providers: WorkloadProviderCost[];
  cheapest: WorkloadProviderCost | null;
  /** The winner's exact total, kept so cross-model comparison never rounds first. */
  cheapest_micros: bigint | null;
  not_costable: WorkloadModelResult['not_costable'];
}

/** Cost every fresh offer for one model against a workload, cheapest first. */
function costModel(
  data: PriceIndex,
  model: ModelView,
  inputTokens: number,
  outputTokens: number,
  limit: number,
): CostedModel {
  const priced: { micros: bigint; cost: WorkloadProviderCost }[] = [];
  const notCostable: WorkloadModelResult['not_costable'] = [];

  for (const offer of freshOffers(model)) {
    const cost = offerWorkloadCost(offer, inputTokens, outputTokens);
    if (!cost.ok) {
      notCostable.push({
        provider_id: offer.provider_id,
        provider_name: providerName(data, offer.provider_id),
        reason: cost.reason,
      });
      continue;
    }
    priced.push({ micros: cost.total, cost: toWorkloadCost(data, offer, cost) });
  }

  // Ranked on exact micro-USD. Two totals a fraction of a cent apart must not
  // collapse into the same double and fall through to alphabetical order.
  priced.sort((a, b) => {
    if (a.micros !== b.micros) return a.micros < b.micros ? -1 : 1;
    return a.cost.provider_name.localeCompare(b.cost.provider_name);
  });

  const winner = priced[0];
  return {
    providers: priced.slice(0, limit).map((entry) => entry.cost),
    cheapest: winner?.cost ?? null,
    cheapest_micros: winner?.micros ?? null,
    not_costable: notCostable,
  };
}

export interface WorkloadParams {
  models?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  limit?: unknown;
}

/** What a given token volume actually costs, per model and per provider. */
export function estimateWorkloadCost(
  data: PriceIndex,
  params: WorkloadParams,
): WorkloadEstimate | InvalidInput {
  const list = validateModelList(params.models, 1, MAX_MODELS_PER_COMPARISON);
  if (!list.ok) return list;

  const workload = validateWorkload(params.input_tokens, params.output_tokens);
  if (!workload.ok) return workload;

  const limit = clampLimit(params.limit, 5);
  const unresolved: string[] = [];
  const models: WorkloadModelResult[] = [];
  let best: WorkloadEstimate['cheapest_overall'] = null;
  let bestMicros: bigint | null = null;

  for (const requested of list.models) {
    const model = resolveModel(data, requested);
    if (!model) {
      unresolved.push(requested);
      models.push({ requested, resolved: null, cheapest: null, providers: [], not_costable: [] });
      continue;
    }

    const { cheapest_micros, ...costed } = costModel(
      data,
      model,
      workload.input_tokens,
      workload.output_tokens,
      limit,
    );
    models.push({
      requested,
      resolved: { id: model.id, display_name: model.display_name, maker: model.maker },
      ...costed,
    });

    // Compared on exact micro-USD, not on the rounded USD figure.
    if (costed.cheapest && cheapest_micros !== null && (bestMicros === null || cheapest_micros < bestMicros)) {
      bestMicros = cheapest_micros;
      best = {
        model_id: model.id,
        display_name: model.display_name,
        provider_id: costed.cheapest.provider_id,
        provider_name: costed.cheapest.provider_name,
        total_usd: costed.cheapest.total_usd,
      };
    }
  }

  return {
    ok: true,
    price_unit: PRICE_UNIT,
    generated_at: data.generated_at,
    currency: 'USD',
    workload: { input_tokens: workload.input_tokens, output_tokens: workload.output_tokens },
    cheapest_overall: best,
    models,
    unresolved,
  };
}

export interface CompareModelsParams {
  models?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  limit?: unknown;
}

/**
 * Compare several models side by side.
 *
 * Token volumes are optional. Supplied together they turn the comparison from
 * "which is cheaper per million tokens" into "which is cheaper for this job",
 * which is the question people actually have. Supplying only one of the two is
 * rejected rather than guessed.
 */
export function compareModels(
  data: PriceIndex,
  params: CompareModelsParams,
): ModelComparison | InvalidInput {
  const list = validateModelList(params.models, 2, MAX_MODELS_PER_COMPARISON);
  if (!list.ok) return list;

  const hasInput = params.input_tokens !== undefined && params.input_tokens !== null;
  const hasOutput = params.output_tokens !== undefined && params.output_tokens !== null;
  if (hasInput !== hasOutput) {
    return { ok: false, error: 'input_tokens and output_tokens must be supplied together' };
  }

  let workload: { input_tokens: number; output_tokens: number } | null = null;
  if (hasInput && hasOutput) {
    const validated = validateWorkload(params.input_tokens, params.output_tokens);
    if (!validated.ok) return validated;
    workload = { input_tokens: validated.input_tokens, output_tokens: validated.output_tokens };
  }

  const limit = clampLimit(params.limit, 5);
  const unresolved: string[] = [];
  const entries: CompareModelsEntry[] = [];
  let best: ModelComparison['cheapest_overall'] = null;
  let bestMicros: bigint | null = null;

  for (const requested of list.models) {
    const model = resolveModel(data, requested);
    if (!model) {
      unresolved.push(requested);
      entries.push({
        requested,
        resolved: null,
        provider_count: null,
        market_low_input_usd_per_1m: null,
        market_low_output_usd_per_1m: null,
        best_discount_pct: null,
        cheapest_provider: null,
        workload: null,
      });
      continue;
    }

    const cheapest = cheapestFreshOffer(model);
    let workloadCost: WorkloadProviderCost | null = null;
    if (workload) {
      const costed = costModel(data, model, workload.input_tokens, workload.output_tokens, limit);
      workloadCost = costed.cheapest;
      if (
        workloadCost &&
        costed.cheapest_micros !== null &&
        (bestMicros === null || costed.cheapest_micros < bestMicros)
      ) {
        bestMicros = costed.cheapest_micros;
        best = {
          model_id: model.id,
          display_name: model.display_name,
          provider_id: workloadCost.provider_id,
          provider_name: workloadCost.provider_name,
          total_usd: workloadCost.total_usd,
        };
      }
    }

    entries.push({
      requested,
      resolved: { id: model.id, display_name: model.display_name, maker: model.maker },
      provider_count: model.provider_count,
      market_low_input_usd_per_1m: roundUsd(model.best_input_usd_per_1m),
      market_low_output_usd_per_1m: roundUsd(model.best_output_usd_per_1m),
      best_discount_pct: model.best_discount_pct,
      cheapest_provider: cheapest
        ? {
            provider_id: cheapest.provider_id,
            provider_name: providerName(data, cheapest.provider_id),
            input_usd_per_1m: roundUsd(cheapest.input_usd_per_1m),
            output_usd_per_1m: roundUsd(cheapest.output_usd_per_1m),
          }
        : null,
      workload: workloadCost,
    });
  }

  return {
    ok: true,
    price_unit: PRICE_UNIT,
    generated_at: data.generated_at,
    ranking: COST_SCORE_LABEL,
    workload,
    models: entries,
    unresolved,
    cheapest_overall: best,
  };
}
