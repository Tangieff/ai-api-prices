import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';

/**
 * Surplus Intelligence — public marketplace API.
 *
 * `GET /api/markets` returns the live order book summary per model: the best ask
 * across all sellers plus `direct_*`, the first-party list price the marketplace
 * measures its discount against. That `direct_*` figure is exactly the
 * "meaningful reference price" the product wants, so it flows straight through.
 *
 * Prices are integer micro-USD per 1M tokens (`12000000` = $12.00).
 */

const MARKETS_URL = 'https://api.surplusintelligence.ai/api/markets';

const MICROS_PER_USD = 1_000_000;

interface MarketRow {
  model?: unknown;
  best_input_per_1m?: unknown;
  best_output_per_1m?: unknown;
  best_cache_read_per_1m?: unknown;
  best_cache_write_per_1m?: unknown;
  direct_input_per_1m?: unknown;
  direct_output_per_1m?: unknown;
  /** Non-null for image/video/music listings, which are priced per job, not per token. */
  media_unit?: unknown;
  seller_count?: unknown;
}

interface MarketsResponse {
  markets?: unknown;
}

/** Micro-USD integer -> USD, rejecting anything that is not a usable positive price. */
function microsToUsd(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value / MICROS_PER_USD;
}

export function parseMarkets(payload: unknown): RawOffer[] {
  const markets = (payload as MarketsResponse | null)?.markets;
  if (!Array.isArray(markets)) {
    throw new Error('Surplus Intelligence: expected a "markets" array');
  }

  const offers: RawOffer[] = [];
  for (const entry of markets as MarketRow[]) {
    if (!entry || typeof entry.model !== 'string' || !entry.model) continue;

    // Media listings price per job/second rather than per token; the comparison
    // table only deals in per-1M-token prices, so they are skipped rather than
    // shown with a misleading $0.
    if (entry.media_unit !== null && entry.media_unit !== undefined) continue;

    const input = microsToUsd(entry.best_input_per_1m);
    const output = microsToUsd(entry.best_output_per_1m);
    if (input === null && output === null) continue;

    // A market with no sellers has no price anyone can actually buy at.
    if (typeof entry.seller_count === 'number' && entry.seller_count <= 0) continue;

    offers.push({
      provider_model_id: entry.model,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: microsToUsd(entry.best_cache_read_per_1m),
      cache_write_usd_per_1m: microsToUsd(entry.best_cache_write_per_1m),
      reference_input_usd_per_1m: microsToUsd(entry.direct_input_per_1m),
      reference_output_usd_per_1m: microsToUsd(entry.direct_output_per_1m),
    });
  }

  if (offers.length === 0) {
    throw new Error('Surplus Intelligence: no token-priced markets in response');
  }
  return offers;
}

export const surplusIntelligenceAdapter: Adapter = {
  provider_id: 'surplus-intelligence',
  source_kind: 'api',
  async fetchOffers() {
    return parseMarkets(await fetchJson<unknown>(MARKETS_URL));
  },
};
