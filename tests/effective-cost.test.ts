import { describe, expect, it } from 'vitest';
import { effectiveUsdPer1m } from '@/lib/effective-cost';

describe('effective-cost normalization', () => {
  it('accepts an already-final USD price without a transform', () => {
    expect(effectiveUsdPer1m(1.234567)).toBe(1.234567);
  });

  it('applies a route multiplier in integer micro-USD', () => {
    expect(
      effectiveUsdPer1m(0.75, { route_multiplier: { numerator: 4, denominator: 5 } }),
    ).toBe(0.6);
  });

  it('combines group and model multipliers before one final rounding', () => {
    expect(
      effectiveUsdPer1m(2, {
        group_multiplier: { numerator: 3, denominator: 2 },
        model_multiplier: { numerator: 7, denominator: 10 },
      }),
    ).toBe(2.1);
  });

  it('normalizes a smallest public prepaid pack as credits per real USD', () => {
    expect(
      effectiveUsdPer1m(5, { credits_per_usd: { numerator: 500, denominator: 45 } }),
    ).toBe(0.45);
  });

  it('rounds only at the comparable one-micro-USD boundary', () => {
    expect(
      effectiveUsdPer1m(1, { credits_per_usd: { numerator: 3, denominator: 1 } }),
    ).toBe(0.333333);
  });

  it('rejects invalid multiplier descriptions', () => {
    expect(() =>
      effectiveUsdPer1m(1, { route_multiplier: { numerator: 0, denominator: 1 } }),
    ).toThrow(/positive safe integers/);
  });
});
