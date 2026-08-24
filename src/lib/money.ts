/**
 * Money helpers.
 *
 * Published prices are decimal USD per 1M tokens ($0.070, $2.32, $12.50). Doing
 * comparisons and percentages on those floats directly produces the usual
 * artefacts (0.1 + 0.2, 77.00000000000001% discounts). Every calculation here
 * therefore converts to integer micro-USD first, and only converts back for
 * display.
 *
 * 1 USD = 1_000_000 micros, which keeps six decimal places — more precision
 * than any provider publishes.
 */

export const MICROS_PER_USD = 1_000_000;

/** USD -> integer micro-USD. Returns null for null/NaN/negative input. */
export function toMicros(usd: number | null | undefined): number | null {
  if (usd === null || usd === undefined) return null;
  if (!Number.isFinite(usd) || usd < 0) return null;
  return Math.round(usd * MICROS_PER_USD);
}

/** Integer micro-USD -> USD. */
export function fromMicros(micros: number | null): number | null {
  if (micros === null) return null;
  return micros / MICROS_PER_USD;
}

/**
 * Parse a price out of source text such as `"$2.32"`, `"$0.070"`, `"1,200.00"`
 * or `"$60.00 /1M tokens"`. Returns null when there is no usable number, which
 * is how adapters signal "this provider does not publish that field".
 */
export function parseUsd(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '');
  const match = /-?\d+(?:\.\d+)?/.exec(cleaned);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Format a per-1M-token price for display.
 *
 * Cheap models cost fractions of a cent per 1M tokens, so a fixed 2-decimal
 * format would render several distinct prices as "$0.00". Precision therefore
 * grows as the number shrinks.
 */
export function formatUsd(usd: number | null): string {
  if (usd === null || !Number.isFinite(usd)) return '—';
  if (usd === 0) return '$0';
  const decimals = usd >= 100 ? 0 : usd >= 1 ? 2 : usd >= 0.01 ? 3 : 4;
  return `$${usd.toFixed(decimals)}`;
}

/**
 * Discount of `price` against `reference`, as a percentage rounded to one
 * decimal place.
 *
 * Returns null unless the comparison is meaningful: both sides must be present,
 * the reference must be a real positive price, and the offer must actually be
 * cheaper. A provider charging at or above list price shows no badge rather
 * than a negative "discount".
 */
export function discountPct(price: number | null, reference: number | null): number | null {
  const priceMicros = toMicros(price);
  const referenceMicros = toMicros(reference);
  if (priceMicros === null || referenceMicros === null) return null;
  if (referenceMicros <= 0) return null;
  if (priceMicros >= referenceMicros) return null;
  const pct = ((referenceMicros - priceMicros) / referenceMicros) * 100;
  return Math.round(pct * 10) / 10;
}

/**
 * Combined discount for an offer, weighting input and output the same way the
 * sort score does (see `lib/score.ts`). When only one side has a reference we
 * fall back to that side alone.
 */
export function offerDiscountPct(offer: {
  input_usd_per_1m: number | null;
  output_usd_per_1m: number | null;
  reference_input_usd_per_1m: number | null;
  reference_output_usd_per_1m: number | null;
}): number | null {
  const price = weightedMicros(offer.input_usd_per_1m, offer.output_usd_per_1m);
  const reference = weightedMicros(
    offer.reference_input_usd_per_1m,
    offer.reference_output_usd_per_1m,
  );
  if (price !== null && reference !== null) {
    return discountPct(fromMicros(price), fromMicros(reference));
  }
  return (
    discountPct(offer.input_usd_per_1m, offer.reference_input_usd_per_1m) ??
    discountPct(offer.output_usd_per_1m, offer.reference_output_usd_per_1m)
  );
}

/**
 * Public saving against one canonical official model baseline.
 *
 * Unlike provider diagnostics, this requires both input and output on both
 * sides so every public percentage uses exactly the documented input + 3×
 * output comparison.
 */
export function offerDiscountAgainstOfficial(
  offer: {
    input_usd_per_1m: number | null;
    output_usd_per_1m: number | null;
  },
  official: {
    input_usd_per_1m: number;
    output_usd_per_1m: number;
  },
): number | null {
  const price = weightedMicros(offer.input_usd_per_1m, offer.output_usd_per_1m);
  const reference = weightedMicros(
    official.input_usd_per_1m,
    official.output_usd_per_1m,
  );
  if (price === null || reference === null) return null;
  return discountPct(fromMicros(price), fromMicros(reference));
}

/** `input + 3 * output` in micro-USD, or null when either side is missing. */
function weightedMicros(input: number | null, output: number | null): number | null {
  const inputMicros = toMicros(input);
  const outputMicros = toMicros(output);
  if (inputMicros === null || outputMicros === null) return null;
  return inputMicros + 3 * outputMicros;
}
