import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePricing } from '@/adapters/frugal-relay';

const fixture = () =>
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'fixtures', 'frugal-pricing.json'), 'utf8'),
  ) as unknown;

describe('Frugal Relay adapter', () => {
  const offers = parsePricing(fixture());

  it('calculates each enabled token route from the live ratio feed', () => {
    const sol = offers.filter((offer) => offer.provider_model_id === 'gpt-5.6-sol');
    expect(sol).toHaveLength(2);
    expect(sol).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input_usd_per_1m: 0.225,
          output_usd_per_1m: 1.35,
          cache_read_usd_per_1m: 0.0225,
          tier: 'Plus Account Route · eligibility varies',
        }),
        expect.objectContaining({
          input_usd_per_1m: 0.45,
          output_usd_per_1m: 2.7,
          cache_read_usd_per_1m: 0.045,
          tier: 'Pro Account Route · eligibility varies',
        }),
      ]),
    );
  });

  it('keeps Claude cache pricing on the route that is actually enabled', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-5');
    expect(opus).toMatchObject({
      input_usd_per_1m: 0.55,
      output_usd_per_1m: 2.75,
      cache_read_usd_per_1m: 0.055,
      cache_write_usd_per_1m: 0.6875,
      tier: 'Claude Route · eligibility varies',
      source_url: 'https://frugalrelay.me/api/pricing',
    });
  });

  it('does not invent routes that exist in group_ratio but are not enabled for the model', () => {
    expect(offers.map((offer) => offer.tier)).not.toContain(
      'Claude Sale Channel · eligibility varies',
    );
  });

  it('skips test-only, unpriced and request-priced groups', () => {
    expect(offers.map((offer) => offer.tier).some((tier) => tier?.includes('Test'))).toBe(false);
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('gpt-image-2');
    expect(offers).toHaveLength(3);
  });

  it('fails loudly when the public feed shape is no longer usable', () => {
    expect(() => parsePricing({ success: false, data: [] })).toThrow(/successful data/i);
    expect(() =>
      parsePricing({ success: true, data: [], group_ratio: {}, usable_group: {} }),
    ).toThrow(/no publishable/i);
  });
});
