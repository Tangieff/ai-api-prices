import type { Offer } from './types';
import { toMicros } from './money';

/**
 * Cost score used to order the offers for one model, cheapest first.
 *
 * The score is `input + 3 * output` in micro-USD.
 *
 * Why `3x` on output: real chat/coding workloads read far more tokens than they
 * write, but output tokens are priced 4-6x higher, so weighting them equally
 * with input would rank a cheap-in/expensive-out offer far too well. A 1:3
 * weighting is a deliberately blunt, documented stand-in for "typical mixed
 * usage" — it is not a billing estimate, only a stable ordering rule. Because
 * every offer is scored the same way, the ranking is comparable even though the
 * absolute number is not a real cost.
 *
 * Returns null when either side is missing: an offer that only publishes an
 * input price cannot be compared on cost, and sorts after complete offers.
 */
export function costScoreMicros(offer: Pick<Offer, 'input_usd_per_1m' | 'output_usd_per_1m'>): number | null {
  const input = toMicros(offer.input_usd_per_1m);
  const output = toMicros(offer.output_usd_per_1m);
  if (input === null || output === null) return null;
  return input + 3 * output;
}

/** Human-readable description of the score, shown in the UI so the sort is not a black box. */
export const COST_SCORE_LABEL = 'input + 3 x output';

/** The fields the comparator actually reads. Lets projected views reuse it verbatim. */
export type ComparableOffer = Pick<
  Offer,
  'input_usd_per_1m' | 'output_usd_per_1m' | 'provider_id' | 'tier'
>;

/**
 * Sort comparator for offers within a single model.
 *
 * Order: complete comparable offers by ascending score, then offers missing a
 * price, then a stable tie-break on provider id so refreshes do not reshuffle
 * equal rows.
 */
export function compareOffers(a: ComparableOffer, b: ComparableOffer): number {
  const scoreA = costScoreMicros(a);
  const scoreB = costScoreMicros(b);
  if (scoreA !== null && scoreB !== null && scoreA !== scoreB) return scoreA - scoreB;
  if (scoreA !== null && scoreB === null) return -1;
  if (scoreA === null && scoreB !== null) return 1;
  if (a.provider_id !== b.provider_id) return a.provider_id < b.provider_id ? -1 : 1;
  return (a.tier ?? '').localeCompare(b.tier ?? '');
}
