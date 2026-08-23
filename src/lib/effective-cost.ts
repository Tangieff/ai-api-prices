import { fromMicros, toMicros } from './money';

/** A positive rational number, kept exact until final micro-USD rounding. */
export interface PriceRatio {
  numerator: number;
  denominator: number;
}

/**
 * effective USD = base rate * route * group * model / credits per real USD
 *
 * Omit the transform when an adapter already supplies final USD prices. Named
 * factors preserve pricing provenance without becoming a generic billing engine.
 */
export interface EffectiveCostTransform {
  route_multiplier?: PriceRatio;
  group_multiplier?: PriceRatio;
  model_multiplier?: PriceRatio;
  credits_per_usd?: PriceRatio;
}

function validateRatio(name: string, ratio: PriceRatio): void {
  if (
    !Number.isSafeInteger(ratio.numerator) ||
    !Number.isSafeInteger(ratio.denominator) ||
    ratio.numerator <= 0 ||
    ratio.denominator <= 0
  ) {
    throw new Error(`${name} must use positive safe integers`);
  }
}

/** Apply a transform with one final half-up rounding to integer micro-USD. */
export function effectiveUsdPer1m(
  baseUsdPer1m: number | null | undefined,
  transform?: EffectiveCostTransform,
): number | null {
  if (baseUsdPer1m === null || baseUsdPer1m === undefined) return null;
  const baseMicros = toMicros(baseUsdPer1m);
  if (baseMicros === null) throw new Error('base price must be a finite non-negative USD value');
  if (!transform) return fromMicros(baseMicros);

  let numerator = BigInt(baseMicros);
  let denominator = 1n;
  const multipliers = [
    ['route_multiplier', transform.route_multiplier],
    ['group_multiplier', transform.group_multiplier],
    ['model_multiplier', transform.model_multiplier],
  ] as const;

  for (const [name, ratio] of multipliers) {
    if (!ratio) continue;
    validateRatio(name, ratio);
    numerator *= BigInt(ratio.numerator);
    denominator *= BigInt(ratio.denominator);
  }

  if (transform.credits_per_usd) {
    validateRatio('credits_per_usd', transform.credits_per_usd);
    numerator *= BigInt(transform.credits_per_usd.denominator);
    denominator *= BigInt(transform.credits_per_usd.numerator);
  }

  const roundedMicros = (numerator + denominator / 2n) / denominator;
  if (roundedMicros > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('effective price exceeds the safe integer micro-USD range');
  }
  return fromMicros(Number(roundedMicros));
}
