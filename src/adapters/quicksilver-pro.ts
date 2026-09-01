import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

const PRICING_URL = 'https://quicksilverpro.io/pricing.json';

/**
 * QuickSilver Pro (https://quicksilverpro.io/) publishes its whole catalog as a
 * single machine-readable feed at /pricing.json ("Do not hand-edit" per its own
 * `_note` field). Confirmed shape (2026-08-31):
 *
 *   { currency: "USD", unit: "mixed", models: [ { id, name, capabilities,
 *     pricing_unit, input_per_1m, output_per_1m, cached_input_per_1m?,
 *     cache_write_per_1m?, long_context? }, ... ] }
 *
 * `unit` is "mixed" at the top level because the catalog also carries
 * non-token products (e.g. image generation billed per image); each row
 * declares its own `pricing_unit`, and only "tokens" rows expose
 * input_per_1m/output_per_1m as USD-per-1M-token rates.
 */

interface LongContextTier {
  prompt_tokens_over?: unknown;
  input_per_1m?: unknown;
  output_per_1m?: unknown;
  cache_read_per_1m?: unknown;
}

interface ModelRow {
  id?: unknown;
  name?: unknown;
  capabilities?: unknown;
  pricing_unit?: unknown;
  input_per_1m?: unknown;
  output_per_1m?: unknown;
  cached_input_per_1m?: unknown;
  cache_write_per_1m?: unknown;
  long_context?: unknown;
}

interface CatalogPayload {
  currency?: unknown;
  models?: unknown;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Renders a long-context threshold like 200000 as ">=200k", or ">=250000" if not a clean thousand. */
function longContextTierLabel(promptTokensOver: number): string {
  return Number.isInteger(promptTokensOver) && promptTokensOver % 1000 === 0
    ? `>=${promptTokensOver / 1000}k`
    : `>=${promptTokensOver}`;
}

function isTextChatRow(row: ModelRow): row is ModelRow & { id: string } {
  return (
    typeof row.id === 'string' &&
    isComparableTextTokenModel(row.id) &&
    row.pricing_unit === 'tokens' &&
    Array.isArray(row.capabilities) &&
    row.capabilities.includes('text_input') &&
    row.capabilities.includes('text_output')
  );
}

/**
 * Pure parser: takes the decoded /pricing.json body and returns priced,
 * comparable text-token offers. QuickSilver Pro's one-time "100% match on
 * first credit purchase, up to $50" promotion is not part of this feed and
 * must never be folded into the ingested per-token rates below — only the
 * catalog's standard pay-as-you-go input_per_1m/output_per_1m (and, for
 * grok-4.6, its published long_context tier) are ingested.
 */
export function parsePricing(payload: unknown): RawOffer[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('QuickSilver Pro: pricing response is not a JSON object');
  }
  const catalog = payload as CatalogPayload;
  if (catalog.currency !== 'USD') {
    throw new Error('QuickSilver Pro: catalog currency is not USD');
  }
  if (!Array.isArray(catalog.models)) {
    throw new Error('QuickSilver Pro: catalog missing models array');
  }

  const offers: RawOffer[] = [];
  for (const row of catalog.models as ModelRow[]) {
    if (!row || typeof row !== 'object' || !isTextChatRow(row)) continue;

    const input = positive(row.input_per_1m);
    const output = positive(row.output_per_1m);
    if (input === null || output === null) continue;

    const displayName = typeof row.name === 'string' ? row.name : undefined;

    offers.push({
      provider_model_id: row.id,
      display_name: displayName,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: positive(row.cached_input_per_1m),
      cache_write_usd_per_1m: positive(row.cache_write_per_1m),
      source_url: PRICING_URL,
    });

    const longContext = row.long_context;
    if (longContext && typeof longContext === 'object') {
      const tier = longContext as LongContextTier;
      const tierInput = positive(tier.input_per_1m);
      const tierOutput = positive(tier.output_per_1m);
      const promptTokensOver = positive(tier.prompt_tokens_over);
      if (tierInput !== null && tierOutput !== null && promptTokensOver !== null) {
        offers.push({
          provider_model_id: row.id,
          display_name: displayName,
          input_usd_per_1m: tierInput,
          output_usd_per_1m: tierOutput,
          cache_read_usd_per_1m: positive(tier.cache_read_per_1m),
          cache_write_usd_per_1m: null,
          tier: longContextTierLabel(promptTokensOver),
          source_url: PRICING_URL,
        });
      }
    }
  }

  if (offers.length === 0) {
    throw new Error('QuickSilver Pro: no comparable text-token models with priced offers found');
  }
  return offers;
}

export const quicksilverProAdapter: Adapter = {
  provider_id: 'quicksilver-pro',
  source_kind: 'api',
  async fetchOffers() {
    return parsePricing(await fetchJson<unknown>(PRICING_URL));
  },
};
