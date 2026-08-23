import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePricing as parseAITransXPricing } from '@/adapters/aitransx';
import { parsePricingPage as parseCometPricing } from '@/adapters/cometapi';
import { parseModelsPage as parseOmniaKeyModels } from '@/adapters/omniakey';
import { parsePricingPage as parseRelayGPUPricing } from '@/adapters/relaygpu';
import { parseModelsPage as parseRelayRouterModels } from '@/adapters/relayrouter';
import { parseModelsPage as parseTokenMixModels } from '@/adapters/tokenmix';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('CometAPI adapter', () => {
  const offers = parseCometPricing(fixture('cometapi-pricing.html'));

  it('reads text-token RSC records and preserves the published route multiplier', () => {
    expect(offers).toEqual([
      expect.objectContaining({
        provider_model_id: 'gemini-3.7-flash',
        input_usd_per_1m: 0.75,
        output_usd_per_1m: 3.75,
        effective_cost: { route_multiplier: { numerator: 4, denominator: 5 } },
        reference_input_usd_per_1m: 1,
        reference_output_usd_per_1m: 5,
      }),
    ]);
  });

  it('rejects an unrecognizable hydration stream', () => {
    expect(() => parseCometPricing('<html></html>')).toThrow(/pricing records/i);
  });
});

describe('OmniaKey adapter', () => {
  const offers = parseOmniaKeyModels(fixture('omniakey-models.html'));

  it('reads current and official input/output prices from model cards', () => {
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      provider_model_id: 'claude-opus-5',
      input_usd_per_1m: 1.2,
      output_usd_per_1m: 6,
      reference_input_usd_per_1m: 5,
      reference_output_usd_per_1m: 25,
    });
  });
});

describe('RelayRouter adapter', () => {
  it('includes explicit USD direct routes and rejects ratio-only pools', () => {
    expect(parseRelayRouterModels(fixture('relayrouter-models.html'))).toEqual([
      expect.objectContaining({
        provider_model_id: 'deepseek-v4-flash',
        input_usd_per_1m: 0.162,
        output_usd_per_1m: 0.324,
        tier: 'direct route',
      }),
    ]);
  });
});

describe('AITransX adapter', () => {
  it('keeps positive text-token routes with source identity and excludes media rows', () => {
    const offers = parseAITransXPricing(JSON.parse(fixture('aitransx-pricing.json')));
    expect(offers).toEqual([
      expect.objectContaining({
        provider_model_id: 'openai/gpt-5.6-sol',
        tier: 'relay / relay',
        reference_input_usd_per_1m: 5,
        reference_output_usd_per_1m: 30,
      }),
    ]);
  });
});

describe('TokenMix adapter', () => {
  it('preserves token-priced long-context tiers and filters non-chat/disabled rows', () => {
    const parsed = parseTokenMixModels(JSON.parse(fixture('tokenmix-models.json')));
    expect(parsed.totalPages).toBe(1);
    expect(parsed.offers).toHaveLength(2);
    expect(parsed.offers.map((offer) => offer.tier)).toEqual(['standard', 'long_context']);
    expect(parsed.offers[1]).toMatchObject({ input_usd_per_1m: 9.5, output_usd_per_1m: 42.75 });
  });

  it('fails closed when pagination metadata is absent', () => {
    expect(() => parseTokenMixModels({ data: [] })).toThrow(/pagination/i);
  });
});

describe('RelayGPU adapter', () => {
  const offers = parseRelayGPUPricing(fixture('relaygpu-pricing.html'));

  it('keeps standard and OpenGPU routes distinct when both prices are published', () => {
    expect(offers).toHaveLength(3);
    expect(offers.filter((offer) => offer.provider_model_id === 'Qwen3.5-35B')).toEqual([
      expect.objectContaining({ tier: 'standard route', input_usd_per_1m: 0.1, output_usd_per_1m: 0.6 }),
      expect.objectContaining({ tier: 'OpenGPU network', input_usd_per_1m: 0.08, output_usd_per_1m: 0.48 }),
    ]);
  });

  it('uses the model name without appending the vendor label and skips incomplete rows', () => {
    expect(offers.map((offer) => offer.provider_model_id)).toContain('Claude Opus 5');
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('Embedding Model');
  });
});
