import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/prices.json/route';

describe('GET /api/prices.json', () => {
  it('publishes the normalized comparison data without internal search blobs', async () => {
    const response = await GET();
    const body = (await response.json()) as {
      schema_version: number;
      price_unit: string;
      providers: Array<{ id: string; visit_url: string }>;
      models: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
    expect(body.schema_version).toBe(1);
    expect(body.price_unit).toBe('USD per 1M tokens');
    expect(body).not.toHaveProperty('referral_disclosure');
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.models[0]).not.toHaveProperty('search_text');

    const derouter = body.providers.find((provider) => provider.id === 'derouter');
    expect(derouter?.visit_url).toBe('https://derouter.ai?ref=mZxRdS1y');
  });
});
