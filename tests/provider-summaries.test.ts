import { describe, expect, it } from 'vitest';
import { buildProviderSummaries } from '@/lib/provider-summaries';
import type { ModelView, ProviderRef } from '@/lib/view';

const providers: Record<string, ProviderRef> = {
  broad: {
    id: 'broad',
    name: 'Broad Relay',
    visit_url: 'https://example.com/broad?ref=1',
    source_kind: 'api',
  },
  narrow: {
    id: 'narrow',
    name: 'Narrow Relay',
    visit_url: 'https://example.com/narrow?ref=1',
    source_kind: 'html',
  },
};

function model(id: string, offers: ModelView['offers']): ModelView {
  return {
    id,
    display_name: id,
    maker: null,
    offers,
    search_text: id,
    provider_count: new Set(offers.map((offer) => offer.provider_id)).size,
    best_input_usd_per_1m: 1,
    best_output_usd_per_1m: 2,
    best_discount_pct: null,
    official_baseline: null,
  };
}

const offer = (
  provider_id: string,
  is_best: boolean,
  observed_at: string,
): ModelView['offers'][number] => ({
  provider_id,
  input_usd_per_1m: 1,
  output_usd_per_1m: 2,
  cache_read_usd_per_1m: null,
  cache_write_usd_per_1m: null,
  discount_pct: null,
  discount_unavailable_reason: 'Official comparable baseline unavailable',
  observed_at,
  tier: null,
  is_best,
  stale: false,
});

describe('buildProviderSummaries', () => {
  it('counts unique models, offers and existing cheapest rows without inventing a new ranking', () => {
    const models = [
      model('alpha', [
        offer('broad', true, '2026-08-23T08:00:00.000Z'),
        { ...offer('broad', false, '2026-08-23T08:05:00.000Z'), tier: 'plus' },
        offer('narrow', false, '2026-08-23T08:03:00.000Z'),
      ]),
      model('beta', [offer('broad', true, '2026-08-23T09:00:00.000Z')]),
    ];

    const result = buildProviderSummaries(models, providers);

    expect(result.map((provider) => provider.id)).toEqual(['broad', 'narrow']);
    expect(result[0]).toMatchObject({
      model_count: 2,
      offer_count: 3,
      cheapest_count: 2,
      latest_observed_at: '2026-08-23T09:00:00.000Z',
    });
    expect(result[1]).toMatchObject({ model_count: 1, offer_count: 1, cheapest_count: 0 });
  });

  it('keeps provider search text useful for names and ids', () => {
    const result = buildProviderSummaries(
      [model('alpha', [offer('broad', true, '2026-08-23T08:00:00.000Z')])],
      providers,
    );

    expect(result[0]!.search_text).toContain('broad relay');
    expect(result[0]!.search_text).toContain('broad');
  });
});
