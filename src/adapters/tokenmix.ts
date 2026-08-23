import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';

const MODELS_URL = 'https://api.tokenmix.ai/api/models';
const PAGE_SIZE = 100;

interface PricingTier {
  label_en?: unknown;
  input_price?: unknown;
  output_price?: unknown;
  unit?: unknown;
}

interface ModelRow {
  model_id?: unknown;
  name?: unknown;
  model_type?: unknown;
  input_price?: unknown;
  output_price?: unknown;
  original_input_price?: unknown;
  original_output_price?: unknown;
  status?: unknown;
  dynamic_pricing?: { tiers?: unknown } | null;
}

interface ModelsResponse {
  data?: unknown;
  meta?: { total_pages?: unknown };
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function parseModelsPage(payload: unknown): { offers: RawOffer[]; totalPages: number } {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as ModelsResponse).data)) {
    throw new Error('TokenMix: models response missing data array');
  }

  const response = payload as ModelsResponse;
  const totalPages = response.meta?.total_pages;
  if (!Number.isSafeInteger(totalPages) || (totalPages as number) < 1 || (totalPages as number) > 50) {
    throw new Error('TokenMix: invalid pagination metadata');
  }

  const offers: RawOffer[] = [];
  for (const row of response.data as ModelRow[]) {
    if (
      !row ||
      typeof row.model_id !== 'string' ||
      row.model_type !== 'chat' ||
      row.status !== 1
    ) {
      continue;
    }

    const referenceInput = positive(row.original_input_price);
    const referenceOutput = positive(row.original_output_price);
    const tiers = Array.isArray(row.dynamic_pricing?.tiers)
      ? (row.dynamic_pricing?.tiers as PricingTier[]).filter(
          (tier) => tier?.unit === 'million_tokens',
        )
      : [];
    const pricedTiers = tiers.filter(
      (tier) => positive(tier.input_price) !== null && positive(tier.output_price) !== null,
    );

    if (pricedTiers.length > 0) {
      for (const tier of pricedTiers) {
        offers.push({
          provider_model_id: row.model_id,
          display_name: typeof row.name === 'string' ? row.name : undefined,
          input_usd_per_1m: positive(tier.input_price),
          output_usd_per_1m: positive(tier.output_price),
          reference_input_usd_per_1m: referenceInput,
          reference_output_usd_per_1m: referenceOutput,
          tier:
            pricedTiers.length > 1 && typeof tier.label_en === 'string' ? tier.label_en : null,
          source_url: MODELS_URL,
        });
      }
      continue;
    }

    const input = positive(row.input_price);
    const output = positive(row.output_price);
    if (input === null || output === null) continue;
    offers.push({
      provider_model_id: row.model_id,
      display_name: typeof row.name === 'string' ? row.name : undefined,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      reference_input_usd_per_1m: referenceInput,
      reference_output_usd_per_1m: referenceOutput,
      source_url: MODELS_URL,
    });
  }

  return { offers, totalPages: totalPages as number };
}

export const tokenmixAdapter: Adapter = {
  provider_id: 'tokenmix',
  source_kind: 'api',
  async fetchOffers() {
    const first = parseModelsPage(
      await fetchJson<unknown>(`${MODELS_URL}?page=1&per_page=${PAGE_SIZE}`),
    );
    const offers = [...first.offers];
    for (let page = 2; page <= first.totalPages; page += 1) {
      const parsed = parseModelsPage(
        await fetchJson<unknown>(`${MODELS_URL}?page=${page}&per_page=${PAGE_SIZE}`),
      );
      if (parsed.totalPages !== first.totalPages) {
        throw new Error('TokenMix: pagination changed during refresh');
      }
      offers.push(...parsed.offers);
    }
    if (offers.length === 0) throw new Error('TokenMix: no active chat token prices found');
    return offers;
  },
};
