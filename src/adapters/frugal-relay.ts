import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';

/**
 * Frugal Relay publishes its live model/route pricing inputs as JSON.
 *
 * Token pricing is route-specific:
 *   input  = model_ratio * 2 * group_ratio[route]
 *   output = input * completion_ratio
 *
 * A model may list groups that are not currently priceable (for example a
 * group with no group_ratio), and the feed can contain test-only groups. Those
 * are deliberately skipped. The route name remains visible as the offer tier
 * because eligibility varies by account.
 */
const PRICING_URL = 'https://frugalrelay.me/api/pricing';
const USD_PRECISION = 1_000_000;

interface FrugalModel {
  model_name?: unknown;
  quota_type?: unknown;
  model_ratio?: unknown;
  completion_ratio?: unknown;
  cache_ratio?: unknown;
  create_cache_ratio?: unknown;
  enable_groups?: unknown;
}

interface FrugalPricingResponse {
  success?: unknown;
  data?: unknown;
  group_ratio?: unknown;
  usable_group?: unknown;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundedUsd(value: number): number {
  return Math.round(value * USD_PRECISION) / USD_PRECISION;
}

function routeIsPublishable(name: string): boolean {
  return !/test/i.test(name);
}

export function parsePricing(payload: unknown): RawOffer[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Frugal Relay: pricing response is not an object');
  }

  const response = payload as FrugalPricingResponse;
  if (response.success !== true || !Array.isArray(response.data)) {
    throw new Error('Frugal Relay: pricing response missing successful data array');
  }
  if (!response.group_ratio || typeof response.group_ratio !== 'object') {
    throw new Error('Frugal Relay: pricing response missing group ratios');
  }
  if (!response.usable_group || typeof response.usable_group !== 'object') {
    throw new Error('Frugal Relay: pricing response missing route names');
  }

  const groupRatios = response.group_ratio as Record<string, unknown>;
  const routeNames = response.usable_group as Record<string, unknown>;
  const offers: RawOffer[] = [];

  for (const rawModel of response.data) {
    if (!rawModel || typeof rawModel !== 'object') continue;
    const model = rawModel as FrugalModel;

    // quota_type 0 is token pricing. Request/image pricing does not belong in
    // the per-1M-token comparison.
    if (model.quota_type !== 0 || typeof model.model_name !== 'string') continue;

    const modelRatio = finiteNumber(model.model_ratio);
    const completionRatio = finiteNumber(model.completion_ratio);
    if (modelRatio === null || modelRatio <= 0 || completionRatio === null || completionRatio <= 0) {
      continue;
    }
    if (!Array.isArray(model.enable_groups)) continue;

    const cacheRatio = finiteNumber(model.cache_ratio);
    const createCacheRatio = finiteNumber(model.create_cache_ratio);

    for (const rawGroup of model.enable_groups) {
      if (typeof rawGroup !== 'string') continue;
      const groupRatio = finiteNumber(groupRatios[rawGroup]);
      const routeName = routeNames[rawGroup];
      if (groupRatio === null || groupRatio <= 0 || typeof routeName !== 'string') continue;
      if (!routeIsPublishable(routeName)) continue;

      const input = roundedUsd(modelRatio * 2 * groupRatio);
      const output = roundedUsd(input * completionRatio);

      offers.push({
        provider_model_id: model.model_name,
        input_usd_per_1m: input,
        output_usd_per_1m: output,
        cache_read_usd_per_1m:
          cacheRatio !== null && cacheRatio >= 0 ? roundedUsd(input * cacheRatio) : null,
        cache_write_usd_per_1m:
          createCacheRatio !== null && createCacheRatio >= 0
            ? roundedUsd(input * createCacheRatio)
            : null,
        tier: `${routeName} · eligibility varies`,
        source_url: PRICING_URL,
      });
    }
  }

  if (offers.length === 0) {
    throw new Error('Frugal Relay: no publishable token-priced routes found');
  }
  return offers;
}

export const frugalRelayAdapter: Adapter = {
  provider_id: 'frugalrelay',
  source_kind: 'api',
  async fetchOffers() {
    return parsePricing(await fetchJson<unknown>(PRICING_URL));
  },
};
