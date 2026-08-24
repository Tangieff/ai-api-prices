import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

const PRICING_URL = 'https://aitransx.com/api/pricing';

interface PricingRow {
  model?: unknown;
  provider?: unknown;
  source?: unknown;
  input?: unknown;
  output?: unknown;
  original_input?: unknown;
  original_output?: unknown;
  request?: unknown;
}

interface PricingResponse {
  data?: unknown;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function isTextTokenModel(id: string): boolean {
  return !id.startsWith('~') && isComparableTextTokenModel(id);
}

export function parsePricing(payload: unknown): RawOffer[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as PricingResponse).data)) {
    throw new Error('AITransX: pricing response missing data array');
  }

  const offers: RawOffer[] = [];
  for (const value of (payload as PricingResponse).data as PricingRow[]) {
    if (!value || typeof value.model !== 'string' || !isTextTokenModel(value.model)) continue;
    const input = positive(value.input);
    const output = positive(value.output);
    if (input === null || output === null) continue;

    // OpenRouter-style `:batch` is a priced route, not part of model identity.
    // Keep the provider id verbatim for provenance while using a clean display
    // id and an explicit tier so it cannot collide with the on-demand route.
    const batch = value.model.endsWith(':batch');
    const displayModel = batch ? value.model.slice(0, -':batch'.length) : value.model;

    const route = [value.provider, value.source]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' / ');
    offers.push({
      provider_model_id: value.model,
      display_name: displayModel,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      reference_input_usd_per_1m: positive(value.original_input),
      reference_output_usd_per_1m: positive(value.original_output),
      tier: [route, batch ? 'batch' : ''].filter(Boolean).join(' · ') || null,
      source_url: PRICING_URL,
    });
  }

  if (offers.length === 0) throw new Error('AITransX: no token-priced models found');
  return offers;
}

export const aitransxAdapter: Adapter = {
  provider_id: 'aitransx',
  source_kind: 'api',
  async fetchOffers() {
    return parsePricing(await fetchJson<unknown>(PRICING_URL));
  },
};
