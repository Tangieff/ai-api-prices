import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { effectiveUsdPer1m } from '@/lib/effective-cost';
import { parseModels as parseRelayModels } from '@/adapters/relay-ai';
import { parsePricingPage as parseLlmrelayPricing } from '@/adapters/llmrelay-dev';
import { parsePricingPage as parseMidRelayPricing } from '@/adapters/midrelay';
import { parsePricingPage as parseZrelayPricing } from '@/adapters/zrelay';
import { parsePricing as parseRelayFastPricing } from '@/adapters/relay-fast';
import { ADAPTERS } from '@/adapters';
import { PROVIDERS } from '@/lib/providers';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('Wave 2 registration', () => {
  it('keeps the provider and adapter registries in exact one-to-one sync', () => {
    expect(ADAPTERS.map((adapter) => adapter.provider_id).sort()).toEqual(
      PROVIDERS.map((provider) => provider.id).sort(),
    );
  });
});

describe('Relay adapter', () => {
  it('accepts only available positive-priced text models from the public USD catalogue', () => {
    const offers = parseRelayModels(JSON.parse(fixture('relay-ai-models.json')));
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      provider_model_id: 'claude-opus-5',
      input_usd_per_1m: 0.59,
      output_usd_per_1m: 2.93,
      cache_read_usd_per_1m: 0.06,
    });
  });

  it('fails closed if the currency/unit contract changes', () => {
    const payload = JSON.parse(fixture('relay-ai-models.json'));
    payload.currency = 'CREDITS';
    expect(() => parseRelayModels(payload)).toThrow(/catalogue shape/i);
  });
});

describe('llmrelay adapter', () => {
  it('reads fixed input/output rows and rejects image products', () => {
    const offers = parseLlmrelayPricing(fixture('llmrelay-dev-pricing.html'));
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      provider_model_id: 'claude-opus-5',
      input_usd_per_1m: 2.5,
      output_usd_per_1m: 12.5,
      reference_input_usd_per_1m: 5,
    });
  });
});

describe('MidRelay adapter', () => {
  it('reads provider and official USD pairs from the server-rendered table', () => {
    expect(parseMidRelayPricing(fixture('midrelay-pricing.html'))).toEqual([
      expect.objectContaining({ provider_model_id: 'Claude Opus 5', input_usd_per_1m: 1.59, output_usd_per_1m: 7.94, reference_input_usd_per_1m: 5, reference_output_usd_per_1m: 25 }),
      expect.objectContaining({ provider_model_id: 'GPT-5.6 Sol', input_usd_per_1m: 0.62, output_usd_per_1m: 3.71, reference_input_usd_per_1m: 5, reference_output_usd_per_1m: 30 }),
    ]);
  });
});

describe('Zrelay adapter', () => {
  it('keeps debit rates as provenance and applies the smallest public credit pack exactly', () => {
    const offers = parseZrelayPricing(fixture('zrelay-pricing.html'));
    expect(offers).toHaveLength(2);
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-5')!;
    expect(opus).toMatchObject({
      input_usd_per_1m: 5,
      output_usd_per_1m: 25,
      effective_cost: { credits_per_usd: { numerator: 25, denominator: 4 } },
      tier: '$16 → $100 credit',
    });
    expect(effectiveUsdPer1m(opus.input_usd_per_1m, opus.effective_cost)).toBe(0.8);
    expect(effectiveUsdPer1m(opus.output_usd_per_1m, opus.effective_cost)).toBe(4);
  });

  it('fails closed if the entry pack changes independently of the rate card', () => {
    expect(() => parseZrelayPricing(fixture('zrelay-pricing.html').replace('$16', '$18'))).toThrow(/entry credit tier/i);
  });
});

describe('relay.fast adapter', () => {
  const pricing = JSON.parse(fixture('relay-fast-pricing.json'));
  const status = JSON.parse(fixture('relay-fast-status.json'));

  it('represents default-route multipliers as exact rational effective cost', () => {
    const offers = parseRelayFastPricing(pricing, status);
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-4-6')!;
    expect(opus.effective_cost).toEqual({ group_multiplier: { numerator: 9, denominator: 250 } });
    expect(effectiveUsdPer1m(opus.input_usd_per_1m, opus.effective_cost)).toBe(0.18);
    expect(effectiveUsdPer1m(opus.output_usd_per_1m, opus.effective_cost)).toBe(0.9);
  });

  it('preserves short/long context tiers and excludes media products', () => {
    const offers = parseRelayFastPricing(pricing, status);
    expect(offers.filter((offer) => offer.provider_model_id === 'gpt-5.4').map((offer) => offer.tier)).toEqual(['short context', 'long context']);
    expect(offers.some((offer) => offer.provider_model_id === 'gpt-image-2')).toBe(false);
  });

  it('fails closed if public quota is no longer one USD per unit', () => {
    expect(() => parseRelayFastPricing(pricing, { data: { ...status.data, price: 2 } })).toThrow(/quota conversion/i);
  });
});
