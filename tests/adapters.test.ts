import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMarkets } from '@/adapters/surplus-intelligence';
import { parsePricingPage, parseOfficialPair } from '@/adapters/derouter';
import { parseModelsPage } from '@/adapters/getgoapi';
import { parseHomepage as parseWorldgateHomepage } from '@/adapters/worldgate';

/**
 * Parser tests run against synthetic fixtures that reproduce only the structure
 * each parser keys on, so a layout change is caught here rather than by an empty
 * comparison table.
 */

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('Surplus Intelligence adapter', () => {
  const offers = parseMarkets(JSON.parse(fixture('surplus-markets.json')));

  it('converts micro-USD to dollars', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-4.6');
    expect(opus?.input_usd_per_1m).toBe(0.5);
    expect(opus?.cache_read_usd_per_1m).toBe(0.05);
  });

  it('carries the direct price through as the discount reference', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-4.6');
    expect(opus?.reference_input_usd_per_1m).toBe(5);
    expect(opus?.reference_output_usd_per_1m).toBe(25);
  });

  it('skips media listings, which are priced per job rather than per token', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain(
      'veo3-1-full-image-to-video',
    );
  });

  it('throws when the response is not the expected shape', () => {
    expect(() => parseMarkets({})).toThrow(/markets/);
    expect(() => parseMarkets(null)).toThrow(/markets/);
    expect(() => parseMarkets({ markets: [{ model: 'x', media_unit: 'job' }] })).toThrow();
  });
});

describe('derouter.ai adapter', () => {
  const offers = parsePricingPage(fixture('derouter-pricing.html'));

  it('reads every priced row', () => {
    expect(offers.length).toBe(12);
    expect(offers.map((offer) => offer.provider_model_id)).toContain('Claude Opus 4.8');
  });

  it('reads all four price columns', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'Claude Opus 4.8');
    expect(opus).toMatchObject({
      input_usd_per_1m: 1.16,
      output_usd_per_1m: 5.81,
      cache_read_usd_per_1m: 0.12,
      cache_write_usd_per_1m: 1.45,
      reference_input_usd_per_1m: 5,
      reference_output_usd_per_1m: 25,
    });
  });

  it('splits the combined "official I/O" cell', () => {
    expect(parseOfficialPair('$10 / $50')).toEqual([10, 50]);
    expect(parseOfficialPair('$2.5 / $15')).toEqual([2.5, 15]);
    expect(parseOfficialPair('—')).toEqual([null, null]);
  });

  it('ignores the header row', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('Model');
  });

  it('throws when the pricing table is gone', () => {
    expect(() => parsePricingPage('<html><body><p>Coming soon</p></body></html>')).toThrow(
      /pricing table/i,
    );
  });
});

describe('GetGoAPI adapter', () => {
  const offers = parseModelsPage(fixture('getgoapi-models.html'));

  it('reads per-token prices from the catalogue', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-4-6');
    expect(opus?.input_usd_per_1m).toBe(4);
    expect(opus?.output_usd_per_1m).toBe(20);
  });

  it('publishes no reference price, so its rows carry no discount', () => {
    expect(offers.every((offer) => offer.reference_input_usd_per_1m === undefined)).toBe(true);
  });

  it('skips per-request media pricing', () => {
    const ids = offers.map((offer) => offer.provider_model_id);
    expect(ids).not.toContain('grok-2-image-1212');
    expect(ids).not.toContain('grok-imagine-video');
  });

  it('deep-links each row to its model page', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'claude-opus-4-6');
    expect(opus?.source_url).toBe('https://getgoapi.com/en/models/claude-opus-4-6');
  });

  it('throws when the catalogue table is gone', () => {
    expect(() => parseModelsPage('<html><body></body></html>')).toThrow(/model table/i);
  });
});

describe('WorldGate adapter', () => {
  const offers = parseWorldgateHomepage(fixture('worldgate-home.html'));

  it('reads USD from the price attributes rather than the rendered text', () => {
    const opus = offers.find((offer) => offer.provider_model_id === 'Claude Opus 5');
    expect(opus?.input_usd_per_1m).toBe(0.26);
    expect(opus?.output_usd_per_1m).toBe(1.56);
  });

  it('maps the four price columns in order', () => {
    const sonnet = offers.find((offer) => offer.provider_model_id === 'Claude Sonnet 5');
    expect(sonnet).toMatchObject({
      input_usd_per_1m: 0.104,
      output_usd_per_1m: 0.52,
      cache_read_usd_per_1m: 0.0104,
      cache_write_usd_per_1m: 0.13,
    });
  });

  it('prefers the attribute when the page ships stale text beside it', () => {
    const qwen = offers.find((offer) => offer.provider_model_id === 'Qwen 3.7 Max');
    expect(qwen?.input_usd_per_1m).toBe(1.3);
  });

  it('covers every model family on the page, not just Claude', () => {
    const ids = offers.map((offer) => offer.provider_model_id);
    expect(ids).toContain('GPT 5.6 Sol');
    expect(ids).toContain('Kimi K3');
    expect(ids).toContain('GLM 5.2');
    expect(ids).toContain('DeepSeek V4 Flash');
    expect(ids).toContain('Qwen 3.7 Max');
    expect(ids).toContain('MiniMax M3');
    expect(offers).toHaveLength(26);
  });

  it('skips the header row of every table', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('Model');
  });

  it('publishes no reference price today, so its rows carry no discount', () => {
    expect(offers.every((offer) => offer.reference_input_usd_per_1m === null)).toBe(true);
  });

  it('picks up the official comparison once the page publishes one', () => {
    const [offer] = parseWorldgateHomepage(
      '<table><tr>' +
        '<td>Claude Opus 5</td>' +
        '<td data-price-usd="0.26">$0.2600</td>' +
        '<td data-price-usd="1.56">$1.56</td>' +
        '<td data-official-input-usd="5" data-official-output-usd="25">$5.00 / $25.00</td>' +
        '</tr></table>',
    );
    expect(offer?.reference_input_usd_per_1m).toBe(5);
    expect(offer?.reference_output_usd_per_1m).toBe(25);
  });

  it('throws when the pricing tables are gone', () => {
    expect(() => parseWorldgateHomepage('<html><body><h1>WorldGate</h1></body></html>')).toThrow(
      /pricing tables/i,
    );
  });
});
