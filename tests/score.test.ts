import { describe, expect, it } from 'vitest';
import { compareOffers, costScoreMicros } from '@/lib/score';
import type { Offer } from '@/lib/types';

function offer(partial: Partial<Offer>): Offer {
  return {
    provider_id: 'p',
    model_id: 'm',
    input_usd_per_1m: null,
    output_usd_per_1m: null,
    cache_read_usd_per_1m: null,
    cache_write_usd_per_1m: null,
    reference_input_usd_per_1m: null,
    reference_output_usd_per_1m: null,
    discount_pct: null,
    observed_at: '2026-08-20T00:00:00.000Z',
    source_url: 'https://example.test/',
    provider_model_id: 'm',
    tier: null,
    ...partial,
  };
}

describe('costScoreMicros', () => {
  it('is input + 3 * output in micro-USD', () => {
    expect(costScoreMicros({ input_usd_per_1m: 1, output_usd_per_1m: 2 })).toBe(7_000_000);
    expect(costScoreMicros({ input_usd_per_1m: 0.5, output_usd_per_1m: 2.5 })).toBe(8_000_000);
  });

  it('is null when a price is missing, since the offer is not comparable', () => {
    expect(costScoreMicros({ input_usd_per_1m: 1, output_usd_per_1m: null })).toBeNull();
    expect(costScoreMicros({ input_usd_per_1m: null, output_usd_per_1m: 2 })).toBeNull();
  });

  it('weights output heavily enough to rank a cheap-in/expensive-out offer correctly', () => {
    const cheapInput = costScoreMicros({ input_usd_per_1m: 0.1, output_usd_per_1m: 20 })!;
    const balanced = costScoreMicros({ input_usd_per_1m: 4, output_usd_per_1m: 8 })!;
    expect(balanced).toBeLessThan(cheapInput);
  });
});

describe('compareOffers', () => {
  it('orders cheapest first', () => {
    const rows = [
      offer({ provider_id: 'c', input_usd_per_1m: 4, output_usd_per_1m: 20 }),
      offer({ provider_id: 'a', input_usd_per_1m: 0.5, output_usd_per_1m: 2.5 }),
      offer({ provider_id: 'b', input_usd_per_1m: 1.16, output_usd_per_1m: 5.81 }),
    ].sort(compareOffers);
    expect(rows.map((row) => row.provider_id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts incomplete offers after every comparable one', () => {
    const rows = [
      offer({ provider_id: 'incomplete', input_usd_per_1m: 0.01, output_usd_per_1m: null }),
      offer({ provider_id: 'expensive', input_usd_per_1m: 99, output_usd_per_1m: 999 }),
    ].sort(compareOffers);
    expect(rows.map((row) => row.provider_id)).toEqual(['expensive', 'incomplete']);
  });

  it('breaks ties deterministically so refreshes do not reshuffle equal rows', () => {
    const a = offer({ provider_id: 'zzz', input_usd_per_1m: 1, output_usd_per_1m: 1 });
    const b = offer({ provider_id: 'aaa', input_usd_per_1m: 1, output_usd_per_1m: 1 });
    expect([a, b].sort(compareOffers).map((row) => row.provider_id)).toEqual(['aaa', 'zzz']);
    expect([b, a].sort(compareOffers).map((row) => row.provider_id)).toEqual(['aaa', 'zzz']);
  });
});
