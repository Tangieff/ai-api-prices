import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseModels, atlasCloudAdapter } from '@/adapters/atlas-cloud';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('Atlas Cloud adapter', () => {
  it('registers with the api source kind', () => {
    expect(atlasCloudAdapter.provider_id).toBe('atlas-cloud');
    expect(atlasCloudAdapter.source_kind).toBe('api');
  });

  it('parses comparable text-token models with exact per-1M prices', () => {
    const offers = parseModels(JSON.parse(fixture('atlas-cloud-models.json')));
    const ids = offers.map((o) => o.provider_model_id);

    // Claude entry: per-token strings converted to exact USD-per-1M.
    const opus = offers.find((o) => o.provider_model_id === 'anthropic/claude-opus-5');
    expect(opus).toBeDefined();
    expect(opus?.input_usd_per_1m).toBe(5);
    expect(opus?.output_usd_per_1m).toBe(25);
    expect(opus?.cache_read_usd_per_1m).toBe(0.5);
    expect(opus?.display_name).toBe('Claude Opus 5');
    expect(opus?.tier).toBeNull(); // baseline fp8, not flagged

    const sonnet = offers.find((o) => o.provider_model_id === 'anthropic/claude-sonnet-5');
    expect(sonnet?.input_usd_per_1m).toBe(2);
    expect(sonnet?.output_usd_per_1m).toBe(10);

    // -aws hosting duplicate is dropped, not given its own row.
    expect(ids).not.toContain('anthropic/claude-opus-5-aws');

    // Reduced-precision (fp4) route is tagged distinctly from the fp8 route of
    // "the same" model, at its own, different, price.
    const fp4 = offers.find((o) => o.provider_model_id === 'deepseek-ai/deepseek-v4-pro');
    const fp8 = offers.find((o) => o.provider_model_id === 'deepseek-ai/deepseek-v4-pro-0813');
    expect(fp4?.tier).toBe('fp4');
    expect(fp4?.input_usd_per_1m).toBeCloseTo(1.68, 10);
    expect(fp4?.output_usd_per_1m).toBeCloseTo(3.38, 10);
    expect(fp8?.tier).toBeNull();
    expect(fp8?.input_usd_per_1m).toBeCloseTo(1.32, 10);
    expect(fp8?.output_usd_per_1m).toBeCloseTo(3.96, 10);

    // Image-output and zero-priced entries never enter the comparison.
    expect(ids).not.toContain('stability/stable-diffusion-xl');
    expect(ids).not.toContain('openai/gpt-5.6-preview-free');
  });

  it('converts per-token decimal strings to per-1M without float multiplication error', () => {
    // Number('0.00000396') * 1_000_000 === 3.9600000000000004 in plain JS float
    // math; the adapter must not reproduce that artefact.
    const offers = parseModels(JSON.parse(fixture('atlas-cloud-models.json')));
    const fp8 = offers.find((o) => o.provider_model_id === 'deepseek-ai/deepseek-v4-pro-0813');
    expect(fp8?.output_usd_per_1m).toBe(3.96);
    expect(Number('0.00000396') * 1_000_000).not.toBe(3.96); // documents the trap being avoided
  });

  it('fails closed when the code/msg/data envelope shape changes', () => {
    expect(() => parseModels(JSON.parse(fixture('atlas-cloud-bad-envelope.json')))).toThrow();
    expect(() => parseModels({ code: 200, msg: 'succeed', data: 'not-an-array' })).toThrow();
    expect(() => parseModels({ code: 500, msg: 'error', data: [] })).toThrow();
    expect(() => parseModels(null)).toThrow();
    expect(() => parseModels('nope')).toThrow();
  });

  it('excludes non-text-only output modalities even when isComparableTextTokenModel would pass', () => {
    const offers = parseModels({
      code: 200,
      msg: 'succeed',
      data: [
        {
          id: 'some-vendor/multimodal-out',
          name: 'Multimodal output model',
          quantization: 'fp8',
          output_modalities: ['text', 'image'],
          pricing: { prompt: '0.000001', completion: '0.000002' },
        },
        {
          id: 'some-vendor/text-ok',
          name: 'Text ok',
          quantization: 'fp8',
          output_modalities: ['text'],
          pricing: { prompt: '0.000001', completion: '0.000002' },
        },
      ],
    });
    expect(offers.map((o) => o.provider_model_id)).toEqual(['some-vendor/text-ok']);
  });

  it('rejects missing or zero prices on either side', () => {
    // A "control" valid row proves the invalid rows below were filtered, not
    // that the whole payload was rejected for an unrelated reason.
    const build = (bad: { id: string; pricing: Record<string, string> }) =>
      parseModels({
        code: 200,
        msg: 'succeed',
        data: [
          { output_modalities: ['text'], ...bad },
          {
            id: 'vendor/valid-control',
            output_modalities: ['text'],
            pricing: { prompt: '0.000001', completion: '0.000002' },
          },
        ],
      }).map((o) => o.provider_model_id);

    expect(build({ id: 'vendor/missing-completion', pricing: { prompt: '0.000001' } })).toEqual([
      'vendor/valid-control',
    ]);
    expect(
      build({ id: 'vendor/zero-prompt', pricing: { prompt: '0', completion: '0.000002' } }),
    ).toEqual(['vendor/valid-control']);
    expect(
      build({
        id: 'vendor/negative-ish',
        pricing: { prompt: '-0.000001', completion: '0.000002' },
      }),
    ).toEqual(['vendor/valid-control']);
    expect(
      build({ id: 'vendor/nan', pricing: { prompt: 'abc', completion: '0.000002' } }),
    ).toEqual(['vendor/valid-control']);
  });

  it('tags a non-baseline quantization as tier but leaves fp8 untagged', () => {
    const offers = parseModels({
      code: 200,
      msg: 'succeed',
      data: [
        {
          id: 'vendor/fp8-model',
          quantization: 'fp8',
          output_modalities: ['text'],
          pricing: { prompt: '0.000001', completion: '0.000002' },
        },
        {
          id: 'vendor/bf16-model',
          quantization: 'bf16',
          output_modalities: ['text'],
          pricing: { prompt: '0.000001', completion: '0.000002' },
        },
        {
          id: 'vendor/no-quant-field',
          output_modalities: ['text'],
          pricing: { prompt: '0.000001', completion: '0.000002' },
        },
      ],
    });
    expect(offers.find((o) => o.provider_model_id === 'vendor/fp8-model')?.tier).toBeNull();
    expect(offers.find((o) => o.provider_model_id === 'vendor/bf16-model')?.tier).toBe('bf16');
    expect(offers.find((o) => o.provider_model_id === 'vendor/no-quant-field')?.tier).toBeNull();
  });

  it('throws when zero offers survive filtering', () => {
    expect(() =>
      parseModels({
        code: 200,
        msg: 'succeed',
        data: [
          {
            id: 'vendor/image-only',
            output_modalities: ['image'],
            pricing: { prompt: '0.000001', completion: '0.000002' },
          },
        ],
      }),
    ).toThrow();
    expect(() => parseModels({ code: 200, msg: 'succeed', data: [] })).toThrow();
  });
});
