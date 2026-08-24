import { describe, expect, it } from 'vitest';
import { FEATURED_MODEL_IDS } from '@/lib/featured-models';
import { OFFICIAL_PRICE_BASELINES, officialPriceComparison } from '@/lib/official-prices';
import type { Dataset, Offer } from '@/lib/types';
import { buildPageData } from '@/lib/view';

const observedAt = '2026-08-24T12:00:00.000Z';

function offer(
  provider_id: string,
  overrides: Partial<Offer> = {},
): Offer {
  return {
    provider_id,
    model_id: 'claude-opus-5',
    input_usd_per_1m: 1,
    output_usd_per_1m: 5,
    cache_read_usd_per_1m: null,
    cache_write_usd_per_1m: null,
    reference_input_usd_per_1m: null,
    reference_output_usd_per_1m: null,
    discount_pct: null,
    observed_at: observedAt,
    source_url: 'https://example.com/pricing',
    provider_model_id: 'claude-opus-5',
    tier: null,
    ...overrides,
  };
}

function pageData(offers: Offer[], now: Date = new Date(observedAt)) {
  const modelIds = [...new Set(offers.map((item) => item.model_id))];
  const providerIds = [...new Set(offers.map((item) => item.provider_id))];
  const dataset: Dataset = {
    version: 1,
    generated_at: observedAt,
    providers: [],
    models: modelIds.map((id) => ({
      id,
      display_name: id,
      maker: null,
      family: null,
      aliases: [],
    })),
    offers,
    provider_status: providerIds.map((provider_id) => ({
      provider_id,
      ok: true,
      offer_count: offers.filter((item) => item.provider_id === provider_id).length,
      last_success_at: observedAt,
      error: null,
      stale: false,
    })),
  };
  return buildPageData(dataset, now);
}

describe('official model-maker price baselines', () => {
  it('covers every safely comparable featured model with current first-party provenance', () => {
    const unavailableFeatured = new Set(['gemini-3.1-pro', 'deepseek-v4-pro']);
    expect(OFFICIAL_PRICE_BASELINES.size).toBeGreaterThan(FEATURED_MODEL_IDS.length);
    for (const id of FEATURED_MODEL_IDS.filter((modelId) => !unavailableFeatured.has(modelId))) {
      const baseline = OFFICIAL_PRICE_BASELINES.get(id);
      expect(baseline, id).toBeDefined();
      expect(baseline?.source_url).toMatch(/^https:\/\//);
      expect(baseline?.verified_at).toBe('2026-08-24');
      expect(baseline?.note.length).toBeGreaterThan(10);
    }
    for (const id of unavailableFeatured) {
      expect(OFFICIAL_PRICE_BASELINES.has(id)).toBe(false);
      expect(officialPriceComparison({ model_id: id, tier: null }).comparable).toBe(false);
    }
  });

  it('records every first-party date-bounded token baseline explicitly', () => {
    const timeBounded = [...OFFICIAL_PRICE_BASELINES.values()]
      .filter((baseline) => baseline.valid_through)
      .map((baseline) => [baseline.model_id, baseline.valid_through]);

    expect(timeBounded).toEqual([
      ['gpt-5.6', '2026-11-21'],
      ['gpt-5.6-sol', '2026-11-21'],
    ]);
  });

  it('keeps Claude Sonnet 5 comparable after its cancelled price increase date', () => {
    const comparison = officialPriceComparison(
      { model_id: 'claude-sonnet-5', tier: null },
      new Date('2026-09-01T00:00:00.000Z'),
    );

    expect(comparison).toMatchObject({
      comparable: true,
      unavailable_reason: null,
      baseline: { input_usd_per_1m: 2, output_usd_per_1m: 10 },
    });
    expect(comparison.baseline).not.toHaveProperty('valid_through');
  });

  it('fails closed after a promotional baseline expires without guessing its successor', () => {
    const expired = officialPriceComparison(
      { model_id: 'gpt-5.6-sol', tier: null },
      new Date('2026-11-22T00:00:00.000Z'),
    );
    expect(expired).toMatchObject({
      comparable: false,
      unavailable_reason: 'Official baseline requires re-verification',
      baseline: { valid_through: '2026-11-21' },
    });

    const data = pageData(
      [
        offer('worldgate', {
          model_id: 'gpt-5.6-sol',
          input_usd_per_1m: 1,
          output_usd_per_1m: 5,
        }),
      ],
      new Date('2026-11-22T00:00:00.000Z'),
    );

    expect(data.models[0]!.official_baseline).toMatchObject({
      input_usd_per_1m: 4,
      output_usd_per_1m: 20,
      valid_through: '2026-11-21',
    });
    expect(data.models[0]!.offers[0]).toMatchObject({
      discount_pct: null,
      discount_unavailable_reason: 'Official baseline requires re-verification',
    });
    expect(data.models[0]!.best_discount_pct).toBeNull();
  });

  it('fails closed for time-dependent and non-first-party shorthand baselines', () => {
    for (const model_id of [
      'deepseek-v4-pro',
      'deepseek-v4-flash',
      'gemini-3.1-pro',
      'gemini-3-flash',
      'gemini-3.1-flash-lite-preview',
    ]) {
      expect(OFFICIAL_PRICE_BASELINES.has(model_id)).toBe(false);
      expect(officialPriceComparison({ model_id, tier: null })).toMatchObject({
        baseline: null,
        comparable: false,
        unavailable_reason: 'Official comparable baseline unavailable',
      });
    }
  });

  it('leaves permanent baselines comparable regardless of the injected date', () => {
    const comparison = officialPriceComparison(
      { model_id: 'claude-opus-5', tier: null },
      new Date('2099-01-01T00:00:00.000Z'),
    );

    expect(comparison.comparable).toBe(true);
    expect(comparison.unavailable_reason).toBeNull();
    expect(comparison.baseline).not.toHaveProperty('valid_through');
  });

  it('uses one official baseline even when provider reference fields differ or are null', () => {
    const data = pageData([
      offer('worldgate'),
      offer('frugalrelay', {
        reference_input_usd_per_1m: 10,
        reference_output_usd_per_1m: 50,
        discount_pct: 90,
      }),
    ]);
    const offers = data.models[0]!.offers;

    expect(offers).toHaveLength(2);
    expect(offers[0]!.discount_pct).toBe(80);
    expect(offers[1]!.discount_pct).toBe(80);
    expect(data.models[0]!.best_discount_pct).toBe(80);
  });

  it('shows an explicit unavailable state when no official baseline exists', () => {
    const data = pageData([offer('worldgate', { model_id: 'unknown-model' })]);
    expect(data.models[0]!.offers[0]).toMatchObject({
      discount_pct: null,
      discount_unavailable_reason: 'Official comparable baseline unavailable',
    });
  });

  it('does not fabricate a saving at or above official price', () => {
    const data = pageData([
      offer('worldgate', { input_usd_per_1m: 5, output_usd_per_1m: 25 }),
      offer('frugalrelay', { input_usd_per_1m: 6, output_usd_per_1m: 30 }),
    ]);
    for (const item of data.models[0]!.offers) {
      expect(item.discount_pct).toBeNull();
      expect(item.discount_unavailable_reason).toBe('No saving vs official standard API price');
    }
  });

  it('does not compare an incompatible special tier to the standard baseline', () => {
    const comparison = officialPriceComparison({ model_id: 'claude-opus-5', tier: 'batch' });
    expect(comparison.baseline).not.toBeNull();
    expect(comparison.comparable).toBe(false);
    expect(comparison.unavailable_reason).toContain('for this tier');

    const data = pageData([offer('worldgate', { tier: 'Claude / direct · batch' })]);
    expect(data.models[0]!.offers[0]!.discount_pct).toBeNull();
  });
});
