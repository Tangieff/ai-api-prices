import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

const MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models';
const USD_PER_1M = 1_000_000;

interface ModelPricing {
  input?: unknown;
  output?: unknown;
}

interface ModelModalities {
  input?: unknown;
  output?: unknown;
}

interface ModelRow {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  modalities?: ModelModalities;
  pricing?: unknown;
}

interface ModelsResponse {
  object?: unknown;
  data?: unknown;
}

/**
 * Vercel AI Gateway publishes per-token USD prices as decimal strings (e.g.
 * "0.000002"). Parse to a finite non-negative number; reject anything else.
 */
function perTokenNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Multiplying a parsed per-token float by 1e6 can leave binary-float dust
 * (e.g. 0.0000008 * 1_000_000 === 0.7999999999999999). Vercel's own decimal
 * strings never carry more than a few significant digits once expressed per
 * 1M tokens, so round to 6 decimal places — far finer than any published
 * rate — to drop that dust without touching real precision.
 */
function toUsdPer1M(perToken: number): number {
  return Number((perToken * USD_PER_1M).toFixed(6));
}

function isTextOnlyOutput(modalities: ModelModalities | undefined): boolean {
  const output = modalities?.output;
  return Array.isArray(output) && output.length === 1 && output[0] === 'text';
}

/**
 * Pure parser exercised directly by tests. Ingests ONLY the base
 * `pricing.input` / `pricing.output` per-token rates published for each
 * model. Vercel AI Gateway also publishes distinct nested variants —
 * `pricing.fast`, `pricing.regional.<region>` (which can itself carry its
 * own nested `fast`), long-context `pricing.*_tiers`, `pricing.service_tiers`
 * and (for DeepSeek) `pricing.peak_pricing` — each a genuinely different
 * priced product. We deliberately do not emit rows for those: the base rate
 * is what every plain pay-as-you-go call is billed at, and mixing in the
 * variants would multiply rows per model without a reliable way to label
 * each one's exact billing condition from this feed alone. A `-fast` variant
 * that already ships as its own top-level catalogue id (e.g.
 * `anthropic/claude-opus-5-fast`) is unaffected and still ingested normally,
 * since it is a distinct `id`, not a nested field.
 */
export function parseModels(payload: unknown): RawOffer[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Vercel AI Gateway: models response is not an object');
  }
  const response = payload as ModelsResponse;
  if (!Array.isArray(response.data)) {
    throw new Error('Vercel AI Gateway: models response missing data array');
  }

  const offers: RawOffer[] = [];
  for (const row of response.data as ModelRow[]) {
    if (!row || typeof row.id !== 'string' || row.id.length === 0) continue;
    if (row.type !== 'language') continue;
    if (!isComparableTextTokenModel(row.id)) continue;
    if (!isTextOnlyOutput(row.modalities)) continue;

    const pricing = row.pricing;
    if (!pricing || typeof pricing !== 'object') continue;
    const { input, output } = pricing as ModelPricing;
    const inputPerToken = perTokenNumber(input);
    const outputPerToken = perTokenNumber(output);
    if (inputPerToken === null || outputPerToken === null) continue;
    if (inputPerToken <= 0 || outputPerToken <= 0) continue;

    offers.push({
      provider_model_id: row.id,
      display_name: typeof row.name === 'string' ? row.name : undefined,
      input_usd_per_1m: toUsdPer1M(inputPerToken),
      output_usd_per_1m: toUsdPer1M(outputPerToken),
      source_url: MODELS_URL,
    });
  }

  if (offers.length === 0) {
    throw new Error('Vercel AI Gateway: no comparable text-token models found');
  }

  return offers;
}

export const vercelAiGatewayAdapter: Adapter = {
  provider_id: 'vercel-ai-gateway',
  source_kind: 'api',
  async fetchOffers() {
    return parseModels(await fetchJson<unknown>(MODELS_URL));
  },
};
