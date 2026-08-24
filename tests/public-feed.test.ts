import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/prices.json/route';

describe('GET /api/prices.json', () => {
  it('publishes the normalized comparison data without internal search blobs', async () => {
    const response = await GET();
    const body = (await response.json()) as {
      schema_version: number;
      price_unit: string;
      providers: Array<{ id: string; visit_url: string }>;
      models: Array<{
        id: string;
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

    const derouter = body.providers.find((provider) => provider.id === 'derouter');
    expect(derouter?.visit_url).toBe('https://derouter.ai?ref=mZxRdS1y');
  });
});
