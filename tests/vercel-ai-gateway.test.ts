import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseModels } from '@/adapters/vercel-ai-gateway';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('Vercel AI Gateway adapter', () => {
  const offers = parseModels(JSON.parse(fixture('vercel-ai-gateway-models.json')));

  it('converts published per-token USD strings to per-1M numbers', () => {
    // pricing.input "0.000005" * 1_000_000 = 5, pricing.output "0.000025" * 1_000_000 = 25
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider_model_id: 'anthropic/claude-opus-5',
          display_name: 'Claude Opus 5',
          input_usd_per_1m: 5,
          output_usd_per_1m: 25,
          source_url: 'https://ai-gateway.vercel.sh/v1/models',
        }),
      ]),
    );
  });

  it('reads the remaining primary-model prices correctly', () => {
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider_model_id: 'anthropic/claude-sonnet-5',
          input_usd_per_1m: 2,
          output_usd_per_1m: 10,
        }),
        expect.objectContaining({
          provider_model_id: 'anthropic/claude-fable-5',
          input_usd_per_1m: 10,
          output_usd_per_1m: 50,
        }),
        expect.objectContaining({
          provider_model_id: 'openai/gpt-5.6-sol',
          input_usd_per_1m: 2,
          output_usd_per_1m: 10,
        }),
        expect.objectContaining({
          provider_model_id: 'google/gemini-3.1-pro-preview',
          input_usd_per_1m: 2,
          output_usd_per_1m: 12,
        }),
        expect.objectContaining({
          provider_model_id: 'spacexai/grok-4.6',
          input_usd_per_1m: 2,
          output_usd_per_1m: 6,
        }),
      ]),
    );
  });

  it('reads secondary-model prices correctly, including sub-cent per-token rates', () => {
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider_model_id: 'zai/glm-5.3',
          input_usd_per_1m: 1.4,
          output_usd_per_1m: 4.4,
        }),
        expect.objectContaining({
          provider_model_id: 'zai/glm-5.2',
          input_usd_per_1m: 0.8,
          output_usd_per_1m: 2.55,
        }),
        expect.objectContaining({
          provider_model_id: 'deepseek/deepseek-v4-pro',
          input_usd_per_1m: 0.66,
          output_usd_per_1m: 1.98,
        }),
        expect.objectContaining({
          provider_model_id: 'openai/gpt-5.6-terra',
          input_usd_per_1m: 2,
          output_usd_per_1m: 12,
        }),
        expect.objectContaining({
          provider_model_id: 'openai/gpt-5.6-luna',
          input_usd_per_1m: 0.2,
          output_usd_per_1m: 1.2,
        }),
      ]),
    );
  });

  it('ignores nested regional/fast/tiered pricing and uses only the base rate', () => {
    // anthropic/claude-opus-5 carries pricing.fast (input "0.00001") and
    // pricing.regional.us (input "0.0000055", itself with a nested .fast at
    // "0.000011"). None of those numbers should appear as the ingested rate;
    // only the top-level base pricing.input/.output ($5/$25 per 1M) should.
    const opus = offers.find((o) => o.provider_model_id === 'anthropic/claude-opus-5');
    expect(opus?.input_usd_per_1m).toBe(5);
    expect(opus?.output_usd_per_1m).toBe(25);
    expect(offers.some((o) => o.input_usd_per_1m === 10 && o.output_usd_per_1m === 50 && o.provider_model_id === 'anthropic/claude-opus-5')).toBe(false);

    // openai/gpt-5.6-sol carries long-context input_tiers/output_tiers and a
    // service_tiers.priority variant; the base rate ($2/$10) must win.
    const sol = offers.find((o) => o.provider_model_id === 'openai/gpt-5.6-sol');
    expect(sol?.input_usd_per_1m).toBe(2);
    expect(sol?.output_usd_per_1m).toBe(10);
  });

  it('does not emit separate rows for regional/fast/tiered variants', () => {
    const ids = offers.map((o) => o.provider_model_id);
    expect(ids).toEqual([...new Set(ids)]);
    expect(ids).not.toContain('anthropic/claude-opus-5:fast');
    expect(ids).not.toContain('anthropic/claude-opus-5:us');
  });

  it('excludes embedding, image-output, video, empty-priced and zero-priced entries', () => {
    const ids = offers.map((o) => o.provider_model_id);
    expect(ids).not.toContain('alibaba/qwen3-embedding-0.6b');
    expect(ids).not.toContain('google/gemini-3-pro-image');
    expect(ids).not.toContain('bfl/flux-3-video');
    expect(ids).not.toContain('perplexity/sonar');
    expect(ids).not.toContain('minimax/minimax-m3-free');
  });

  it('throws on a payload missing the data array', () => {
    expect(() => parseModels({ object: 'list' })).toThrow(/data array/i);
    expect(() => parseModels(null)).toThrow();
    expect(() => parseModels('not json')).toThrow();
    expect(() => parseModels([])).toThrow();
  });

  it('throws when every row is non-text, unpriced or zero-priced', () => {
    expect(() =>
      parseModels(JSON.parse(fixture('vercel-ai-gateway-zero-offers.json'))),
    ).toThrow(/no comparable text-token models/i);
  });

  it('skips a language row missing one of the two required prices', () => {
    const result = parseModels({
      object: 'list',
      data: [
        {
          id: 'acme/incomplete',
          name: 'Incomplete',
          type: 'language',
          modalities: { input: ['text'], output: ['text'] },
          pricing: { input: '0.000001' }, // no output price
        },
        {
          id: 'acme/complete',
          name: 'Complete',
          type: 'language',
          modalities: { input: ['text'], output: ['text'] },
          pricing: { input: '0.000001', output: '0.000002' },
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ provider_model_id: 'acme/complete' });
  });
});
