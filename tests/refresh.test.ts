import { describe, expect, it } from 'vitest';
import { refresh } from '@/refresh/run';
import { buildPageData } from '@/lib/view';
import type { Adapter, RawOffer } from '@/adapters';
import type { Dataset } from '@/lib/types';

/**
 * The refresh pipeline's central promise: providers fail independently, and a
 * failure never removes another provider's usable prices.
 */

function stubAdapter(providerId: string, offers: RawOffer[]): Adapter {
  return {
    provider_id: providerId,
    source_kind: 'api',
    fetchOffers: async () => offers,
  };
}

function failingAdapter(providerId: string, message: string): Adapter {
  return {
    provider_id: providerId,
    source_kind: 'html',
    fetchOffers: async () => {
      throw new Error(message);
    },
  };
}

const at = (iso: string) => () => new Date(iso);

const opusFromDerouter: RawOffer = {
  provider_model_id: 'Claude Opus 4.8',
  display_name: 'Claude Opus 4.8',
  input_usd_per_1m: 1.16,
  output_usd_per_1m: 5.81,
  reference_input_usd_per_1m: 5,
  reference_output_usd_per_1m: 25,
};

const opusFromClawhive: RawOffer = {
  provider_model_id: 'Claude Opus 4.8',
  input_usd_per_1m: 2.5,
  output_usd_per_1m: 12.5,
  reference_input_usd_per_1m: 5,
  reference_output_usd_per_1m: 25,
};

describe('refresh', () => {
  it('groups the same model from different providers under one id', async () => {
    const { dataset } = await refresh({
      adapters: [
        stubAdapter('derouter', [opusFromDerouter]),
        stubAdapter('clawhive', [opusFromClawhive]),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });

    expect(dataset.models).toHaveLength(1);
    expect(dataset.models[0]!.id).toBe('claude-opus-4.8');
    expect(dataset.offers).toHaveLength(2);
  });

  it('computes the discount from each source’s own reference price', async () => {
    const { dataset } = await refresh({
      adapters: [stubAdapter('derouter', [opusFromDerouter])],
      now: at('2026-08-20T12:00:00.000Z'),
    });
    expect(dataset.offers[0]!.discount_pct).toBe(76.8);
  });

  it('leaves the discount null when the source publishes no reference', async () => {
    const { dataset } = await refresh({
      adapters: [
        stubAdapter('getgoapi', [
          { provider_model_id: 'claude-opus-4-6', input_usd_per_1m: 4, output_usd_per_1m: 20 },
        ]),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });
    expect(dataset.offers[0]!.discount_pct).toBeNull();
  });

  it('stamps every offer with the observation time and a source URL', async () => {
    const { dataset } = await refresh({
      adapters: [stubAdapter('derouter', [opusFromDerouter])],
      now: at('2026-08-20T12:00:00.000Z'),
    });
    expect(dataset.offers[0]!.observed_at).toBe('2026-08-20T12:00:00.000Z');
    expect(dataset.offers[0]!.source_url).toBe('https://derouter.ai/pricing');
    expect(dataset.offers[0]!.provider_model_id).toBe('Claude Opus 4.8');
  });

  it('keeps a failing provider’s previous offers instead of dropping them', async () => {
    const first = await refresh({
      adapters: [
        stubAdapter('derouter', [opusFromDerouter]),
        stubAdapter('clawhive', [opusFromClawhive]),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });

    const second = await refresh({
      previous: first.dataset,
      adapters: [
        stubAdapter('derouter', [opusFromDerouter]),
        failingAdapter('clawhive', 'HTTP 503 Service Unavailable'),
      ],
      now: at('2026-08-20T13:00:00.000Z'),
    });

    // Both providers still have a row for the model.
    expect(second.dataset.offers).toHaveLength(2);

    const clawhive = second.dataset.provider_status.find((s) => s.provider_id === 'clawhive')!;
    expect(clawhive.ok).toBe(false);
    expect(clawhive.stale).toBe(true);
    expect(clawhive.error).toMatch(/503/);
    // The carried-over row keeps its original timestamp — it was not re-observed.
    expect(clawhive.last_success_at).toBe('2026-08-20T12:00:00.000Z');
    const carried = second.dataset.offers.find((o) => o.provider_id === 'clawhive')!;
    expect(carried.observed_at).toBe('2026-08-20T12:00:00.000Z');

    // The healthy provider is untouched and freshly stamped.
    const derouter = second.dataset.provider_status.find((s) => s.provider_id === 'derouter')!;
    expect(derouter.ok).toBe(true);
    expect(derouter.stale).toBe(false);
  });

  it('survives an adapter that fails on the very first run', async () => {
    const { dataset } = await refresh({
      adapters: [
        stubAdapter('derouter', [opusFromDerouter]),
        failingAdapter('clawhive', 'page layout changed'),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });

    expect(dataset.offers).toHaveLength(1);
    const clawhive = dataset.provider_status.find((s) => s.provider_id === 'clawhive')!;
    expect(clawhive).toMatchObject({ ok: false, offer_count: 0, stale: false, last_success_at: null });
  });

  it('does not let one adapter’s failure abort the others', async () => {
    const { statuses } = await refresh({
      adapters: [
        failingAdapter('surplus-intelligence', 'boom'),
        failingAdapter('derouter', 'boom'),
        stubAdapter('clawhive', [opusFromClawhive]),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });
    expect(statuses).toHaveLength(3);
    expect(statuses.filter((s) => s.ok)).toHaveLength(1);
  });

  it('drops a tier row priced identically to the same provider’s base row', async () => {
    const { dataset } = await refresh({
      adapters: [
        stubAdapter('getgoapi', [
          { provider_model_id: 'claude-haiku-4-5', input_usd_per_1m: 0.8, output_usd_per_1m: 4 },
          {
            provider_model_id: 'claude-haiku-4-5-thinking',
            input_usd_per_1m: 0.8,
            output_usd_per_1m: 4,
          },
        ]),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });
    expect(dataset.offers).toHaveLength(1);
    expect(dataset.offers[0]!.tier).toBeNull();
  });

  it('keeps a tier row that is genuinely priced differently', async () => {
    const { dataset } = await refresh({
      adapters: [
        stubAdapter('getgoapi', [
          { provider_model_id: 'claude-opus-4-7', input_usd_per_1m: 4, output_usd_per_1m: 20 },
          {
            provider_model_id: 'claude-opus-4-7-thinking',
            input_usd_per_1m: 60,
            output_usd_per_1m: 300,
          },
        ]),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });
    expect(dataset.offers).toHaveLength(2);
    expect(dataset.offers.map((o) => o.tier).sort()).toEqual([null, 'thinking']);
  });
});

describe('buildPageData', () => {
  async function pageData(): Promise<ReturnType<typeof buildPageData>> {
    const { dataset } = await refresh({
      adapters: [
        stubAdapter('clawhive', [opusFromClawhive]),
        stubAdapter('derouter', [opusFromDerouter]),
        stubAdapter('getgoapi', [
          { provider_model_id: 'gpt-4o', input_usd_per_1m: 2, output_usd_per_1m: 8 },
        ]),
      ],
      now: at('2026-08-20T12:00:00.000Z'),
    });
    return buildPageData(dataset);
  }

  it('marks only the cheapest offer for a model as best', async () => {
    const data = await pageData();
    const opus = data.models.find((model) => model.id === 'claude-opus-4.8')!;
    expect(opus.offers.map((offer) => offer.is_best)).toEqual([true, false]);
    expect(data.providers[opus.offers[0]!.provider_id]!.name).toBe('derouter.ai');
  });

  it('leads with the models comparable across the most providers', async () => {
    const data = await pageData();
    expect(data.models[0]!.id).toBe('claude-opus-4.8');
    expect(data.models[0]!.provider_count).toBe(2);
  });

  it('resolves Visit through the configured provider destination', async () => {
    const data = await pageData();
    const offer = data.models[0]!.offers[0]!;
    expect(data.providers[offer.provider_id]!.visit_url).toBe('https://derouter.ai?ref=mZxRdS1y');
  });

  it('publishes a provider entry for every offer row', async () => {
    const data = await pageData();
    for (const model of data.models) {
      for (const offer of model.offers) {
        expect(data.providers[offer.provider_id], offer.provider_id).toBeDefined();
      }
    }
  });

  it('makes provider names searchable alongside the model', async () => {
    const data = await pageData();
    expect(data.models[0]!.search_text).toContain('clawhive');
  });

  it('reports an empty dataset without throwing', () => {
    const empty: Dataset = {
      version: 1,
      generated_at: '2026-08-20T12:00:00.000Z',
      providers: [],
      models: [],
      offers: [],
      provider_status: [],
    };
    const data = buildPageData(empty);
    expect(data.models).toEqual([]);
    expect(data.generated_at).toBeNull();
  });
});
