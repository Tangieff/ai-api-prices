/**
 * Core data shapes for OXWeb Prices.
 *
 * Everything is deliberately flat and JSON-serialisable: the whole dataset is a
 * single generated file that the site reads at render time.
 *
 * Money convention: every `*_usd_per_1m` field is USD per 1,000,000 tokens.
 * Values are stored as plain numbers because that is what the sources publish,
 * but all arithmetic goes through `lib/money.ts`, which works in integer
 * micro-USD so repeated comparisons never drift.
 */

/** How an adapter obtained its data. Makes automation gaps obvious. */
export type SourceKind = 'api' | 'html' | 'seed';

export interface Provider {
  id: string;
  name: string;
  website_url: string;
  /** Referral destination. Null until a deal exists; `Visit` falls back to `website_url`. */
  affiliate_url: string | null;
  pricing_source_url: string;
  source_kind: SourceKind;
  /** One line describing what the provider is, shown next to its offers. */
  blurb: string;
}

export interface Model {
  id: string;
  display_name: string;
  /** Vendor that trained the model, e.g. "Anthropic". */
  maker: string | null;
  family: string | null;
  /** Extra search terms; the canonical id and display name are always searchable. */
  aliases: string[];
}

export interface Offer {
  provider_id: string;
  model_id: string;
  input_usd_per_1m: number | null;
  output_usd_per_1m: number | null;
  cache_read_usd_per_1m: number | null;
  cache_write_usd_per_1m: number | null;
  reference_input_usd_per_1m: number | null;
  reference_output_usd_per_1m: number | null;
  /** Provider-reference diagnostic; public savings are rebuilt from official model baselines. */
  discount_pct: number | null;
  /** UTC ISO-8601 instant the price was read from the source. */
  observed_at: string;
  source_url: string;
  /** Provider-side identifier, kept so a row can be traced back to the source. */
  provider_model_id: string;
  /** Plan/tier label when a provider publishes more than one price for a model. */
  tier: string | null;
}

/** Outcome of one provider refresh, kept in the dataset so failures stay visible. */
export interface ProviderStatus {
  provider_id: string;
  ok: boolean;
  offer_count: number;
  /** UTC ISO-8601 instant of the last *successful* refresh, null if never. */
  last_success_at: string | null;
  /** Set when the most recent attempt failed; the offers above are then stale. */
  error: string | null;
  /** True when offers were carried over from a previous run because this one failed. */
  stale: boolean;
}

export interface Dataset {
  /** Bumped when the shape changes so a stale file is ignored rather than mis-read. */
  version: 1;
  generated_at: string;
  providers: Provider[];
  models: Model[];
  offers: Offer[];
  provider_status: ProviderStatus[];
}
