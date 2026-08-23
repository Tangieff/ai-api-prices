import { fetchJson } from '@/lib/http';
import type { PriceRatio } from '@/lib/effective-cost';
import type { Adapter, RawOffer } from './types';

const PRICING_URL = 'https://relay.fast/api/pricing';
const STATUS_URL = 'https://relay.fast/api/status';

interface PricingRow {
  model_name?: unknown;
  quota_type?: unknown;
  model_ratio?: unknown;
  completion_ratio?: unknown;
  cache_ratio?: unknown;
  create_cache_ratio?: unknown;
  enable_groups?: unknown;
  group_ratio?: unknown;
  supported_endpoint_types?: unknown;
  billing_mode?: unknown;
  billing_expr?: unknown;
}

interface PricingResponse {
  success?: unknown;
  data?: unknown;
}

interface StatusResponse {
  data?: {
    quota_display_type?: unknown;
    quota_per_unit?: unknown;
    price?: unknown;
    custom_currency_exchange_rate?: unknown;
  };
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function ratioFromDecimal(value: number): PriceRatio {
  const denominator = 1_000_000_000;
  const numerator = Math.round(value * denominator);
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function isTextModel(id: string): boolean {
  return !/(?:^|[-/])(?:image|video|audio|tts|embedding|whisper|sora|veo)(?:[-/.]|$)/i.test(id);
}

function expressionTiers(expression: string): { tier: string; input: number; output: number; cache: number | null; cacheWrite: number | null }[] {
  const tiers = [...expression.matchAll(/tier\("([^"]+)",\s*([^)]*)\)/g)].map((match) => {
    const formula = match[2] ?? '';
    const value = (symbol: string) => {
      const found = new RegExp(`(?:^|\\+)\\s*${symbol}\\s*\\*\\s*([0-9]+(?:\\.[0-9]+)?)`).exec(formula);
      return found ? Number(found[1]) : null;
    };
    return {
      tier: (match[1] ?? '').replace(/_/g, ' '),
      input: value('p'),
      output: value('c'),
      cache: value('cr'),
      cacheWrite: value('cc'),
    };
  });
  if (tiers.length === 0 || tiers.some((tier) => !tier.tier || tier.input === null || tier.output === null)) {
    throw new Error('relay.fast: unsupported tiered billing expression');
  }
  return tiers as { tier: string; input: number; output: number; cache: number | null; cacheWrite: number | null }[];
}

export function parsePricing(payload: unknown, statusPayload: unknown): RawOffer[] {
  const status = statusPayload as StatusResponse;
  if (
    status?.data?.quota_display_type !== 'USD' ||
    status.data.quota_per_unit !== 500_000 ||
    status.data.price !== 1 ||
    status.data.custom_currency_exchange_rate !== 1
  ) {
    throw new Error('relay.fast: public USD quota conversion changed');
  }
  if (!payload || typeof payload !== 'object' || (payload as PricingResponse).success !== true || !Array.isArray((payload as PricingResponse).data)) {
    throw new Error('relay.fast: pricing response missing data array');
  }

  const offers: RawOffer[] = [];
  for (const row of (payload as PricingResponse).data as PricingRow[]) {
    if (
      !row ||
      typeof row.model_name !== 'string' ||
      !isTextModel(row.model_name) ||
      row.quota_type !== 0 ||
      !Array.isArray(row.enable_groups) ||
      !row.enable_groups.includes('default') ||
      !Array.isArray(row.supported_endpoint_types)
    ) {
      continue;
    }
    const group = positive((row.group_ratio as Record<string, unknown> | undefined)?.default);
    if (group === null) continue;
    const effectiveCost = { group_multiplier: ratioFromDecimal(group) };
    if (row.billing_mode === 'tiered_expr') {
      if (typeof row.billing_expr !== 'string') {
        throw new Error('relay.fast: tiered row missing billing expression');
      }
      for (const tier of expressionTiers(row.billing_expr)) {
        offers.push({
          provider_model_id: row.model_name,
          input_usd_per_1m: tier.input,
          output_usd_per_1m: tier.output,
          cache_read_usd_per_1m: tier.cache,
          cache_write_usd_per_1m: tier.cacheWrite,
          effective_cost: effectiveCost,
          tier: tier.tier,
          source_url: PRICING_URL,
        });
      }
      continue;
    }
    const modelRatio = positive(row.model_ratio);
    const completionRatio = positive(row.completion_ratio);
    if (modelRatio === null || completionRatio === null) continue;
    const input = modelRatio * 2;
    offers.push({
      provider_model_id: row.model_name,
      input_usd_per_1m: input,
      output_usd_per_1m: input * completionRatio,
      cache_read_usd_per_1m: positive(row.cache_ratio) === null ? null : input * (row.cache_ratio as number),
      cache_write_usd_per_1m: positive(row.create_cache_ratio) === null ? null : input * (row.create_cache_ratio as number),
      effective_cost: effectiveCost,
      source_url: PRICING_URL,
    });
  }
  if (offers.length === 0) throw new Error('relay.fast: no default-group text-token models found');
  return offers;
}

export const relayFastAdapter: Adapter = {
  provider_id: 'relay-fast',
  source_kind: 'api',
  async fetchOffers() {
    const [pricing, status] = await Promise.all([
      fetchJson<unknown>(PRICING_URL),
      fetchJson<unknown>(STATUS_URL),
    ]);
    return parsePricing(pricing, status);
  },
};
