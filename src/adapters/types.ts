import type { SourceKind } from '@/lib/types';

/**
 * What an adapter returns for one row of a provider's price list, before model
 * canonicalisation and discount calculation are applied.
 *
 * Adapters stay deliberately dumb: read the source, pull out numbers, hand back
 * raw values. Everything shared — slug folding, discount maths, timestamps —
 * happens once in the refresh pipeline so all five providers behave the same.
 */
export interface RawOffer {
  /** The provider's own identifier for the model, kept verbatim for traceability. */
  provider_model_id: string;
  /** Display name from the source when it publishes one nicer than the id. */
  display_name?: string;
  input_usd_per_1m: number | null;
  output_usd_per_1m: number | null;
  cache_read_usd_per_1m?: number | null;
  cache_write_usd_per_1m?: number | null;
  /** List/direct price the source itself compares against, when it publishes one. */
  reference_input_usd_per_1m?: number | null;
  reference_output_usd_per_1m?: number | null;
  /** Plan or variant label when the provider sells the same model more than once. */
  tier?: string | null;
  /** Overrides the provider-level source URL for deep-linkable rows. */
  source_url?: string;
}

export interface Adapter {
  provider_id: string;
  /** How this adapter gets its data — surfaced in the UI so seeded rows are honest. */
  source_kind: SourceKind;
  /** Throws on failure; the refresh pipeline isolates and records the error. */
  fetchOffers(): Promise<RawOffer[]>;
}
