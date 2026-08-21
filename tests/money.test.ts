import { describe, expect, it } from 'vitest';
import {
  discountPct,
  formatUsd,
  fromMicros,
  offerDiscountPct,
  parseUsd,
  toMicros,
} from '@/lib/money';

describe('toMicros / fromMicros', () => {
  it('round-trips published prices exactly', () => {
    for (const usd of [0, 0.023, 0.07, 0.5, 1.16, 2.32, 12.5, 60, 1200]) {
      expect(fromMicros(toMicros(usd))).toBe(usd);
    }
  });

  it('rejects values that are not usable prices', () => {
    expect(toMicros(null)).toBeNull();
    expect(toMicros(undefined)).toBeNull();
    expect(toMicros(Number.NaN)).toBeNull();
    expect(toMicros(-1)).toBeNull();
  });

  it('avoids the float drift that plain arithmetic would introduce', () => {
    // 0.1 + 0.2 !== 0.3 in float; via micros the comparison is exact.
    expect(toMicros(0.1)! + toMicros(0.2)!).toBe(toMicros(0.3));
  });
});

describe('parseUsd', () => {
  it('reads the shapes the provider pages actually publish', () => {
    expect(parseUsd('$2.32')).toBe(2.32);
    expect(parseUsd('$0.070')).toBe(0.07);
    expect(parseUsd('$60.00 /1M tokens')).toBe(60);
    expect(parseUsd('$1,200.00')).toBe(1200);
    expect(parseUsd(' $5 ')).toBe(5);
  });

  it('returns null when there is no number to read', () => {
    expect(parseUsd('—')).toBeNull();
    expect(parseUsd('')).toBeNull();
    expect(parseUsd(null)).toBeNull();
    expect(parseUsd('market')).toBeNull();
  });
});

describe('formatUsd', () => {
  it('keeps sub-cent prices distinguishable', () => {
    // A flat 2-decimal format would render all three of these as "$0.00".
    expect(formatUsd(0.023)).toBe('$0.023');
    expect(formatUsd(0.07)).toBe('$0.070');
    expect(formatUsd(0.0046)).toBe('$0.0046');
  });

  it('formats ordinary and large prices compactly', () => {
    expect(formatUsd(2.32)).toBe('$2.32');
    expect(formatUsd(12.5)).toBe('$12.50');
    expect(formatUsd(300)).toBe('$300');
    expect(formatUsd(0)).toBe('$0');
  });

  it('renders a missing price as a dash', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(Number.NaN)).toBe('—');
  });
});

describe('discountPct', () => {
  it('computes the published savings', () => {
    expect(discountPct(0.5, 1)).toBe(50);
    expect(discountPct(2.5, 5)).toBe(50);
    expect(discountPct(1.16, 5)).toBe(76.8);
  });

  it('omits the badge when there is nothing meaningful to compare', () => {
    expect(discountPct(1, null)).toBeNull();
    expect(discountPct(null, 5)).toBeNull();
    expect(discountPct(1, 0)).toBeNull();
  });

  it('never reports a negative discount for an above-list price', () => {
    // ClawHive resells GPT-4o above the direct price; that is not a saving.
    expect(discountPct(2.75, 2.5)).toBeNull();
    expect(discountPct(5, 5)).toBeNull();
  });
});

describe('offerDiscountPct', () => {
  it('weights input and output the same way the sort score does', () => {
    // derouter Claude Opus 4.8: $1.16/$5.81 against a $5/$25 list price.
    expect(
      offerDiscountPct({
        input_usd_per_1m: 1.16,
        output_usd_per_1m: 5.81,
        reference_input_usd_per_1m: 5,
        reference_output_usd_per_1m: 25,
      }),
    ).toBe(76.8);
  });

  it('falls back to whichever side has a reference', () => {
    expect(
      offerDiscountPct({
        input_usd_per_1m: 0.5,
        output_usd_per_1m: 2.5,
        reference_input_usd_per_1m: 1,
        reference_output_usd_per_1m: null,
      }),
    ).toBe(50);
  });

  it('returns null when the source publishes no reference price', () => {
    // GetGoAPI has no direct-price column, so its rows carry no badge.
    expect(
      offerDiscountPct({
        input_usd_per_1m: 4,
        output_usd_per_1m: 20,
        reference_input_usd_per_1m: null,
        reference_output_usd_per_1m: null,
      }),
    ).toBeNull();
  });
});
