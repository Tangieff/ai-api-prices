import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePricing } from '@/adapters/quicksilver-pro';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('QuickSilver Pro adapter', () => {
  const offers = parsePricing(JSON.parse(fixture('quicksilver-pro-catalog.json')));

  it('parses primary-model prices with exact numbers', () => {
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider_model_id: 'claude-opus-5',
          display_name: 'Claude Opus 5',
          input_usd_per_1m: 4,
          output_usd_per_1m: 20,
          source_url: 'https://quicksilverpro.io/pricing.json',
        }),
        expect.objectContaining({
          provider_model_id: 'gemini-3.1-pro-preview',
          input_usd_per_1m: 1.7,
          output_usd_per_1m: 10.2,
        }),
      ]),
    );
  });

  it('carries published cache rates alongside the base rate', () => {
    const sol = offers.find(
      (o) => o.provider_model_id === 'gpt-5.6-sol' && o.tier == null,
    );
    expect(sol).toMatchObject({
      input_usd_per_1m: 4,
      output_usd_per_1m: 24,
      cache_read_usd_per_1m: 0.4,
      cache_write_usd_per_1m: 5,
    });
  });

  it('emits a published long-context tier as a distinct row, not collapsed into the base rate', () => {
    const base = offers.find((o) => o.provider_model_id === 'grok-4.6' && o.tier == null);
    const longContext = offers.find(
      (o) => o.provider_model_id === 'grok-4.6' && o.tier != null,
    );
    expect(base).toMatchObject({ input_usd_per_1m: 2, output_usd_per_1m: 6 });
    expect(longContext).toMatchObject({
      tier: '>=200k',
      input_usd_per_1m: 4,
      output_usd_per_1m: 12,
      cache_read_usd_per_1m: 1,
    });
    // Both rows must be present simultaneously, not one replacing the other.
    expect(offers.filter((o) => o.provider_model_id === 'grok-4.6')).toHaveLength(2);
  });

  it('does not reflect the one-time first-purchase match bonus in ingested prices', () => {
    // QuickSilver Pro advertises "100% match on first credit purchase, up to
    // $50" as a promotional bonus (not present in /pricing.json at all).
    // The ingested rate for a primary model must equal the catalog's raw
    // input_per_1m/output_per_1m unmodified by any such multiplier — e.g.
    // claude-opus-5 must read as 4/20, never doubled to 8/40 or otherwise
    // adjusted for the bonus.
    const opus = offers.find((o) => o.provider_model_id === 'claude-opus-5');
    expect(opus?.input_usd_per_1m).toBe(4);
    expect(opus?.output_usd_per_1m).toBe(20);
  });

  it('never populates reference_* fields from a provider-claimed list price', () => {
    for (const offer of offers) {
      expect(offer.reference_input_usd_per_1m).toBeUndefined();
      expect(offer.reference_output_usd_per_1m).toBeUndefined();
    }
  });

  it('excludes non-text products such as per-image billing', () => {
    const ids = offers.map((o) => o.provider_model_id);
    expect(ids).not.toContain('flux.2-pro');
  });

  it('rejects a row with a missing or zero price', () => {
    const result = parsePricing({
      currency: 'USD',
      models: [
        {
          id: 'acme/missing-output',
          pricing_unit: 'tokens',
          capabilities: ['text_input', 'text_output'],
          input_per_1m: 1,
          // no output_per_1m
        },
        {
          id: 'acme/zero-input',
          pricing_unit: 'tokens',
          capabilities: ['text_input', 'text_output'],
          input_per_1m: 0,
          output_per_1m: 5,
        },
        {
          id: 'acme/complete',
          pricing_unit: 'tokens',
          capabilities: ['text_input', 'text_output'],
          input_per_1m: 1,
          output_per_1m: 2,
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ provider_model_id: 'acme/complete' });
  });

  it('rejects a non-text product by id pattern even if it claims token pricing', () => {
    const result = parsePricing({
      currency: 'USD',
      models: [
        {
          id: 'acme/text-embedding-3',
          pricing_unit: 'tokens',
          capabilities: ['text_input', 'text_output'],
          input_per_1m: 1,
          output_per_1m: 2,
        },
        {
          id: 'acme/chat-model',
          pricing_unit: 'tokens',
          capabilities: ['text_input', 'text_output'],
          input_per_1m: 1,
          output_per_1m: 2,
        },
      ],
    });
    expect(result.map((o) => o.provider_model_id)).toEqual(['acme/chat-model']);
  });

  it('throws when the top-level shape changes', () => {
    expect(() => parsePricing(null)).toThrow();
    expect(() => parsePricing('not json')).toThrow();
    expect(() => parsePricing({ currency: 'USD' })).toThrow(/models array/i);
    expect(() => parsePricing({ currency: 'USD', models: {} })).toThrow(/models array/i);
    expect(() => parsePricing({ currency: 'EUR', models: [] })).toThrow(/currency/i);
  });

  it('throws when every row is non-text or unpriced (zero offers)', () => {
    expect(() =>
      parsePricing(JSON.parse(fixture('quicksilver-pro-zero-offers.json'))),
    ).toThrow(/no comparable text-token models/i);
  });
});
