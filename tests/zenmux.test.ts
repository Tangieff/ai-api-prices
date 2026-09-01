import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseModels } from '@/adapters/zenmux';

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8')) as unknown;

describe('ZenMux adapter', () => {
  it('parses a single-tier model and maps prompt/completion/input_cache_read exactly', () => {
    const offers = parseModels(fixture('zenmux-models.json'));
    const opus = offers.filter((offer) => offer.provider_model_id === 'anthropic/claude-opus-5');
    expect(opus).toHaveLength(1);
    expect(opus[0]).toMatchObject({
      provider_model_id: 'anthropic/claude-opus-5',
      display_name: 'Claude Opus 5',
      input_usd_per_1m: 5,
      output_usd_per_1m: 25,
      cache_read_usd_per_1m: 0.5,
      tier: null,
      source_url: 'https://zenmux.ai/api/v1/models',
    });
  });

  /**
   * The refresh pipeline canonicalises the display name ahead of the id, and
   * ZenMux labels every model "Vendor: Model". Left alone that folds to
   * "anthropic:-claude-opus-5", which has no official baseline and so carries
   * no savings figure into the featured-model gate.
   */
  it('drops the vendor label from the display name so the model canonicalises', () => {
    const offers = parseModels(fixture('zenmux-models.json'));
    for (const offer of offers) {
      expect(offer.display_name ?? '').not.toMatch(/:/);
    }
  });

  /**
   * The refresh canonicalises the display name ahead of the id, so cutting at
   * the wrong colon strands a row on a model id no official baseline matches.
   * A vendor label goes; a colon belonging to the model's own name stays.
   */
  it('keeps a colon that belongs to the model name rather than a vendor label', () => {
    const payload = {
      data: [
        {
          id: 'openai/gpt-5.6-sol',
          display_name: 'GPT-5.6: Sol',
          owned_by: 'openai',
          input_modalities: ['text'],
          output_modalities: ['text'],
          pricings: {
            prompt: [{ value: 4, unit: 'perMTokens', currency: 'USD' }],
            completion: [{ value: 20, unit: 'perMTokens', currency: 'USD' }],
          },
        },
        {
          id: 'z-ai/glm-5.3',
          display_name: 'Z.AI: GLM-5.3',
          owned_by: 'z-ai',
          input_modalities: ['text'],
          output_modalities: ['text'],
          pricings: {
            prompt: [{ value: 1.4, unit: 'perMTokens', currency: 'USD' }],
            completion: [{ value: 4.4, unit: 'perMTokens', currency: 'USD' }],
          },
        },
      ],
    };
    const byId = new Map(parseModels(payload).map((offer) => [offer.provider_model_id, offer]));
    // "GPT-5.6" is not the vendor, so the whole name survives.
    expect(byId.get('openai/gpt-5.6-sol')?.display_name).toBe('GPT-5.6: Sol');
    // "Z.AI" matches owned_by "z-ai" once folded, so the label goes.
    expect(byId.get('z-ai/glm-5.3')?.display_name).toBe('GLM-5.3');
  });

  it('does not multiply perMTokens values -- they are already USD per 1M tokens', () => {
    const offers = parseModels(fixture('zenmux-models.json'));
    const opus = offers.find((offer) => offer.provider_model_id === 'anthropic/claude-opus-5');
    // The raw fixture says value: 5 / value: 25. If the adapter ever started
    // multiplying by 1,000,000 (mistaking the unit for a per-token price)
    // this assertion would fail loudly.
    expect(opus?.input_usd_per_1m).toBe(5);
    expect(opus?.output_usd_per_1m).toBe(25);
  });

  it('emits distinct tiered rows for prompt-length-conditioned pricing arrays', () => {
    const offers = parseModels(fixture('zenmux-models.json'));
    const sol = offers.filter((offer) => offer.provider_model_id === 'openai/gpt-5.6-sol');
    expect(sol).toHaveLength(2);
    expect(sol).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input_usd_per_1m: 4,
          output_usd_per_1m: 20,
          cache_read_usd_per_1m: 0.4,
          tier: 'prompt < 272K tokens',
        }),
        expect.objectContaining({
          input_usd_per_1m: 8,
          output_usd_per_1m: 30,
          cache_read_usd_per_1m: 0.8,
          tier: 'prompt >= 272K tokens',
        }),
      ]),
    );

    const grok = offers.filter((offer) => offer.provider_model_id === 'x-ai/grok-4.6');
    expect(grok).toHaveLength(2);
    expect(grok).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input_usd_per_1m: 2,
          output_usd_per_1m: 6,
          cache_read_usd_per_1m: 0.5,
          tier: 'prompt <= 200K tokens',
        }),
        expect.objectContaining({
          input_usd_per_1m: 4,
          output_usd_per_1m: 12,
          cache_read_usd_per_1m: 1,
          tier: 'prompt >= 200K tokens',
        }),
      ]),
    );
  });

  it('fails closed on an ambiguous multi-entry array with no conditions to pair on', () => {
    // deepseek/deepseek-v4-pro in the fixture repeats six untagged, unconditioned
    // completion/prompt entries with duplicate values -- there is no way to know
    // which entry is "the" price, so the adapter must skip the model rather than
    // silently picking the first one.
    const offers = parseModels(fixture('zenmux-models.json'));
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain(
      'deepseek/deepseek-v4-pro',
    );
  });

  it('rejects non-text output modalities (embeddings, image)', () => {
    const offers = parseModels(fixture('zenmux-models.json'));
    const ids = offers.map((offer) => offer.provider_model_id);
    expect(ids).not.toContain('google/gemini-embedding-2');
    expect(ids).not.toContain('meta/muse-image-1.0');
  });

  it('rejects a model with no price at all', () => {
    expect(() => parseModels(fixture('zenmux-missing-price.json'))).toThrow(
      /no priced text-token models/i,
    );
  });

  it('fails closed when the perMTokens unit changes', () => {
    expect(() => parseModels(fixture('zenmux-bad-unit.json'))).toThrow(/unit changed/i);
  });

  it('fails closed when the USD currency changes', () => {
    expect(() => parseModels(fixture('zenmux-bad-currency.json'))).toThrow(/currency changed/i);
  });

  it('throws on a malformed or empty payload rather than returning zero offers silently', () => {
    expect(() => parseModels(null)).toThrow(/missing data array/i);
    expect(() => parseModels({})).toThrow(/missing data array/i);
    expect(() => parseModels({ data: 'nope' })).toThrow(/missing data array/i);
    expect(() => parseModels({ data: [] })).toThrow(/no priced text-token models/i);
  });
});
