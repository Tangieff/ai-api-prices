import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseModelsPage, parsePricePair } from '@/adapters/boundless';
import { parseEntryPack, parsePricingPage } from '@/adapters/llmsrelay';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('Boundless API adapter', () => {
  const offers = parseModelsPage(fixture('boundless-models.html'));

  it('ingests every currently live token-priced row and skips unavailable/media rows', () => {
    expect(offers).toHaveLength(13);
    expect(offers.map((offer) => offer.provider_model_id)).toContain('gpt-5.6-sol');
    expect(offers.map((offer) => offer.provider_model_id)).toContain('claude-opus-5');
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('claude-opus-4-6');
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('veo-3.1-video-audio');
  });

  it('uses Boundless prices and its published official comparison as the reference', () => {
    const sol = offers.find((offer) => offer.provider_model_id === 'gpt-5.6-sol');
    expect(sol).toMatchObject({
      input_usd_per_1m: 1.25,
      output_usd_per_1m: 7.5,
      reference_input_usd_per_1m: 2.5,
      reference_output_usd_per_1m: 15,
    });
  });

  it('parses combined input/output price cells', () => {
    expect(parsePricePair('$0.375 / $2.25')).toEqual([0.375, 2.25]);
    expect(parsePricePair('—')).toEqual([null, null]);
  });

  it('throws when there are no live token-priced rows', () => {
    expect(() =>
      parseModelsPage(
        '<table><tr><td>gpt-x</td><td>—</td><td>$1 / $2</td><td>$2 / $4</td><td>—</td><td>−50%</td><td>Coming soon</td></tr></table>',
      ),
    ).toThrow(/live token-price table/i);
  });
});

describe('LLMsRelay adapter', () => {
  const html = fixture('llmsrelay-pricing.html');
  const offers = parsePricingPage(html);

  it('derives the effective cash multiplier from the smallest public usage pack', () => {
    expect(parseEntryPack(html)).toEqual({
      pay_usd: 45,
      usage_usd: 500,
      multiplier: 0.09,
      tier: '$45 → $500 usage',
    });
  });

  it('publishes the complete public Claude rate card', () => {
    expect(offers).toHaveLength(8);
    expect(offers.map((offer) => offer.provider_model_id)).toEqual(
      expect.arrayContaining(['claude-fable-5', 'claude-opus-5', 'claude-sonnet-5']),
    );
  });

  it('converts platform usage rates into effective cash prices without hiding the condition', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-5');
    expect(opus).toMatchObject({
      input_usd_per_1m: 0.45,
      output_usd_per_1m: 2.25,
      cache_write_usd_per_1m: 0.5625,
      cache_read_usd_per_1m: 0.045,
      reference_input_usd_per_1m: 5,
      reference_output_usd_per_1m: 25,
      tier: '$45 → $500 usage',
    });
  });

  it('fails loudly if the entry pack disappears', () => {
    expect(() =>
      parsePricingPage(
        '<table><tr><td>claude-opus-5</td><td>$5</td><td>$25</td><td>$6.25</td><td>$0.5</td></tr></table>',
      ),
    ).toThrow(/usage pack/i);
  });
});
