import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePricingPage } from '@/adapters/evolink';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('EvoLink adapter', () => {
  const offers = parsePricingPage(fixture('evolink-pricing.html'));

  it('parses the live discounted rate, not the vendor list price', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-5');
    expect(opus).toMatchObject({
      input_usd_per_1m: 4.75,
      output_usd_per_1m: 23.75,
      source_url: 'https://evolink.ai/pricing',
    });

    const grok = offers.find((offer) => offer.provider_model_id === 'grok-4.6');
    expect(grok?.input_usd_per_1m).toBeCloseTo(1.7, 9);
    expect(grok?.output_usd_per_1m).toBeCloseTo(5.1, 9);
  });

  it('never ingests the provider-published official/list price as a reference', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-5');
    // The source row also carries officialUSD: 0.005 / tiers.input: 0.005 (Anthropic's
    // list price, which EvoLink discounts against) — that must never surface here.
    expect(opus?.reference_input_usd_per_1m).toBeUndefined();
    expect(opus?.reference_output_usd_per_1m).toBeUndefined();
  });

  it('rejects non-text products even when they carry a modality-less well-formed price', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain(
      'gemini-3.1-flash-image-preview',
    );
  });

  it('skips text rows with no priced rate (coming-soon models)', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('gpt-6');
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('claude-fable-5-1');
  });

  it('skips malformed rows missing an id/apiName or a rate object', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('broken-row');
  });

  it('produces exactly the well-formed, priced, text offers in the fixture', () => {
    expect(offers).toHaveLength(2);
  });

  it('throws when the embedded catalog is no longer valid JSON', () => {
    expect(() => parsePricingPage(fixture('evolink-pricing-malformed.html'))).toThrow();
  });

  it('throws when the rows marker is missing entirely (page shape changed)', () => {
    expect(() => parsePricingPage('<html><body>no catalog here</body></html>')).toThrow(
      /rows not found/i,
    );
  });

  it('throws when the catalog contains zero priced text offers', () => {
    expect(() => parsePricingPage(fixture('evolink-pricing-empty.html'))).toThrow(
      /no priced text token models/i,
    );
  });
});
