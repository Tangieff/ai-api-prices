import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';

const MODELS_URL = 'https://relay-ai.org/api/models';

interface RelayModel {
  id?: unknown;
  display_name?: unknown;
  category?: unknown;
  available?: unknown;
  pricing?: {
    currency?: unknown;
    unit?: unknown;
    input?: unknown;
    output?: unknown;
    cache_read?: unknown;
  };
}

interface ModelsResponse {
  object?: unknown;
  scope?: unknown;
  currency?: unknown;
  pricing_unit?: unknown;
  count?: unknown;
  data?: unknown;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function parseModels(payload: unknown): RawOffer[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Relay: models response is not an object');
  }
  const response = payload as ModelsResponse;
  if (
    response.object !== 'list' ||
    response.scope !== 'public' ||
    response.currency !== 'USD' ||
    response.pricing_unit !== 'per_1m_tokens' ||
    !Array.isArray(response.data) ||
    !Number.isSafeInteger(response.count) ||
    response.count !== response.data.length
  ) {
    throw new Error('Relay: public USD per-token catalogue shape changed');
  }

  const offers: RawOffer[] = [];
  for (const row of response.data as RelayModel[]) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      row.category !== 'text' ||
      row.available !== true ||
      row.pricing?.currency !== 'USD' ||
      row.pricing.unit !== 'per_1m_tokens'
    ) {
      continue;
    }
    const input = positive(row.pricing.input);
    const output = positive(row.pricing.output);
    if (input === null || output === null) continue;
    offers.push({
      provider_model_id: row.id,
      display_name: typeof row.display_name === 'string' ? row.display_name : undefined,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: positive(row.pricing.cache_read),
      source_url: MODELS_URL,
    });
  }
  if (offers.length === 0) throw new Error('Relay: no available text-token models found');
  return offers;
}

export const relayAiAdapter: Adapter = {
  provider_id: 'relay-ai',
  source_kind: 'api',
  async fetchOffers() {
    return parseModels(await fetchJson<unknown>(MODELS_URL));
  },
};
