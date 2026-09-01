import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/prices.json/route';
import { PROVIDERS } from '@/lib/providers';

/**
 * Derived from the registry rather than restated. The point of the assertion is
 * that the feed publishes the active set and nothing else — pinning a literal
 * list here only means it has to be edited every time a provider is added.
 */
const ACTIVE_PROVIDER_IDS = PROVIDERS.map((provider) => provider.id).sort();

describe('GET /api/prices.json', () => {
  it('publishes the normalized comparison data without search-only fields', async () => {
    const response = await GET();
    const body = (await response.json()) as {
      schema_version: number;
      price_unit: string;
      total_offers: number;
      providers: Array<{ id: string; visit_url: string }>;
      models: Array<{
        id: string;
        offers: Array<{ provider_id: string }>;
        official_baseline: null | { model_id: string; valid_through?: string };
        [key: string]: unknown;
      }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
    expect(body.schema_version).toBe(2);
    expect(body.price_unit).toBe('USD per 1M tokens');
    expect(body).not.toHaveProperty('referral_disclosure');
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.models[0]).not.toHaveProperty('search_text');
    expect(body.models.some((model) => model.official_baseline !== null)).toBe(true);
    expect(body.models.find((model) => model.id === 'gpt-5.6-sol')?.official_baseline).toMatchObject({
      model_id: 'gpt-5.6-sol',
      valid_through: '2026-11-21',
    });

    expect(body.providers.map((provider) => provider.id).sort()).toEqual(ACTIVE_PROVIDER_IDS);
    expect(body.total_offers).toBe(
      body.models.reduce((total, model) => total + model.offers.length, 0),
    );
    expect(
      body.models.flatMap((model) => model.offers).every((offer) =>
        ACTIVE_PROVIDER_IDS.includes(offer.provider_id),
      ),
    ).toBe(true);

    const cometapi = body.providers.find((provider) => provider.id === 'cometapi');
    expect(cometapi?.visit_url).toBe('https://www.cometapi.com/console/login?aff=fEWl');
  });
});
