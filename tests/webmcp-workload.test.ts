import { describe, expect, it } from 'vitest';
import { MAX_TOKENS_PER_FIELD, estimateWorkloadCost, validateWorkload } from '@/lib/webmcp/catalog';
import { buildWebMcpTools } from '@/lib/webmcp/tools';
import { buildFixture } from './webmcp-fixture';

const data = buildFixture();

describe('estimateWorkloadCost arithmetic', () => {
  it('prices the documented example exactly', () => {
    // Beta sells Opus 5 at $2 in / $10 out per 1M tokens.
    // 50M input  -> 50 x $2  = $100
    // 10M output -> 10 x $10 = $100
    const result = estimateWorkloadCost(data, {
      models: ['Claude Opus 5'],
      input_tokens: 50_000_000,
      output_tokens: 10_000_000,
    });
    if (!result.ok) throw new Error(result.error);

    const cheapest = result.models[0]?.cheapest;
    expect(cheapest?.provider_id).toBe('beta');
    expect(cheapest?.input_usd).toBe(100);
    expect(cheapest?.output_usd).toBe(100);
    expect(cheapest?.total_usd).toBe(200);
  });

  it('keeps the published components adding up to the published total exactly', () => {
    const result = estimateWorkloadCost(data, {
      models: ['Claude Opus 5', 'GPT-5.6 Sol'],
      input_tokens: 3_333_333,
      output_tokens: 777_777,
    });
    if (!result.ok) throw new Error(result.error);

    const micros = (usd: number) => Math.round(usd * 1_000_000);
    for (const model of result.models) {
      for (const provider of model.providers) {
        // Compared as integer micro-USD, so this is exact equality, not a
        // tolerance that would hide a rounding fault.
        expect(micros(provider.input_usd) + micros(provider.output_usd)).toBe(micros(provider.total_usd));
      }
    }
  });

  it('rounds a half micro-USD up, deterministically', () => {
    // $0.000001 per 1M x 500,000 tokens = 0.5 micro-USD, which must round to 1.
    const halfMicro = estimateWorkloadCost(
      {
        ...data,
        models: [
          {
            ...data.models[0]!,
            id: 'half-micro',
            display_name: 'Half Micro',
            offers: [{ ...data.models[0]!.offers[0]!, input_usd_per_1m: 0.000001, output_usd_per_1m: 0 }],
          },
        ],
      },
      { models: ['Half Micro'], input_tokens: 500_000, output_tokens: 0 },
    );
    if (!halfMicro.ok) throw new Error(halfMicro.error);
    expect(halfMicro.models[0]?.cheapest?.total_usd).toBe(0.000001);
  });

  it('refuses to report a total it cannot represent exactly', () => {
    // $10,000,000 per 1M x 1e12 tokens is far past Number.MAX_SAFE_INTEGER in
    // micro-USD, so it is reported as not costable rather than silently wrong.
    const huge = estimateWorkloadCost(
      {
        ...data,
        models: [
          {
            ...data.models[0]!,
            id: 'huge',
            display_name: 'Huge',
            offers: [
              { ...data.models[0]!.offers[0]!, input_usd_per_1m: 10_000_000, output_usd_per_1m: 10_000_000 },
            ],
          },
        ],
      },
      { models: ['Huge'], input_tokens: MAX_TOKENS_PER_FIELD, output_tokens: MAX_TOKENS_PER_FIELD },
    );
    if (!huge.ok) throw new Error(huge.error);
    expect(huge.models[0]?.cheapest).toBeNull();
    expect(huge.models[0]?.not_costable[0]?.reason).toContain('too large');
  });

  it('stays exact where double-precision multiplication would not', () => {
    // 1.234567 USD/1M x 1e12 tokens = 1,234,567 USD exactly. The intermediate
    // (1.234567e18 micro-USD) is past Number.MAX_SAFE_INTEGER, which is why the
    // multiplication happens in BigInt.
    const result = estimateWorkloadCost(data, {
      models: ['Precision Model'],
      input_tokens: MAX_TOKENS_PER_FIELD,
      output_tokens: 0,
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.models[0]?.cheapest?.total_usd).toBe(1_234_567);
  });

  it('never renders a sub-cent workload as $0.00', () => {
    // Alpha sells Tiny Model at $0.10 in / $0.20 out per 1M. 100k in + 20k out
    // is $0.014 — a two-decimal format would print "$0.01", and a smaller job
    // "$0.00", on a site whose whole premise is precise price comparison.
    const tool = buildWebMcpTools({ data }).find((t) => t.name === 'estimate_ai_workload_cost');
    if (!tool) throw new Error('missing tool');

    return tool
      .execute({ models: ['Tiny Model'], input_tokens: 100_000, output_tokens: 20_000 })
      .then((result) => {
        const text = result.content[0]?.text ?? '';
        // formatUsd widens precision as the figure shrinks, so this reads $0.014.
        expect(text).toContain('$0.014');
        expect(text).not.toContain('$0.00');
        const structured = result.structuredContent as { models: { cheapest: { total_usd: number } | null }[] };
        expect(structured.models[0]?.cheapest?.total_usd).toBe(0.014);
      });
  });

  it('names the cheapest provider and the cheapest model overall', () => {
    const result = estimateWorkloadCost(data, {
      models: ['Claude Opus 5', 'GPT-5.6 Sol'],
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.models[0]?.providers.map((p) => p.provider_id)).toEqual(['beta', 'alpha']);
    expect(result.cheapest_overall).toEqual({
      model_id: 'gpt-5.6-sol',
      display_name: 'GPT-5.6 Sol',
      provider_id: 'beta',
      provider_name: 'Beta Gateway',
      total_usd: 6,
    });
  });

  it('never lets a stale provider win on price', () => {
    const result = estimateWorkloadCost(data, {
      models: ['Claude Opus 5'],
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.models[0]?.providers.map((p) => p.provider_id)).not.toContain('gamma');
  });

  it('reports offers that cannot be costed instead of treating a null price as zero', () => {
    const result = estimateWorkloadCost(data, {
      models: ['Partial Model'],
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.models[0]?.providers).toEqual([]);
    expect(result.models[0]?.cheapest).toBeNull();
    expect(result.models[0]?.not_costable).toHaveLength(1);
    expect(result.cheapest_overall).toBeNull();
  });

  it('reports an unresolved model without failing the whole call', () => {
    const result = estimateWorkloadCost(data, {
      models: ['Claude Opus 5', 'not-a-model'],
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.unresolved).toEqual(['not-a-model']);
    expect(result.cheapest_overall?.model_id).toBe('claude-opus-5');
  });
});

describe('workload validation', () => {
  const invalidTokenValues: [string, unknown][] = [
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a numeric string', '1000'],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
    ['over the cap', MAX_TOKENS_PER_FIELD + 1],
  ];

  for (const [label, value] of invalidTokenValues) {
    it(`rejects ${label} input_tokens`, () => {
      const result = validateWorkload(value, 1000);
      expect(result.ok).toBe(false);
    });

    it(`rejects ${label} output_tokens`, () => {
      const result = validateWorkload(1000, value);
      expect(result.ok).toBe(false);
    });
  }

  it('rejects a workload of nothing at all', () => {
    expect(validateWorkload(0, 0).ok).toBe(false);
  });

  it('accepts a one-sided workload', () => {
    expect(validateWorkload(1000, 0).ok).toBe(true);
    expect(validateWorkload(0, 1000).ok).toBe(true);
  });

  it('rounds fractional token counts rather than rejecting them', () => {
    const result = validateWorkload(10.4, 10.6);
    if (!result.ok) throw new Error(result.error);
    expect(result.input_tokens).toBe(10);
    expect(result.output_tokens).toBe(11);
  });
});

describe('estimateWorkloadCost input guards', () => {
  it('returns a structured error and never throws on bad input', () => {
    const cases: unknown[] = [
      { models: [], input_tokens: 1, output_tokens: 1 },
      { models: ['a', 'b', 'c', 'd', 'e', 'f'], input_tokens: 1, output_tokens: 1 },
      { models: 'Claude Opus 5', input_tokens: 1, output_tokens: 1 },
      { models: ['Claude Opus 5', 7], input_tokens: 1, output_tokens: 1 },
      { models: ['Claude Opus 5'], input_tokens: -5, output_tokens: 1 },
      { models: ['Claude Opus 5'], input_tokens: Number.NaN, output_tokens: 1 },
      { models: ['Claude Opus 5'], input_tokens: 0, output_tokens: 0 },
      {},
    ];

    for (const params of cases) {
      const result = estimateWorkloadCost(data, params as Record<string, unknown>);
      expect(result.ok, JSON.stringify(params)).toBe(false);
      if (result.ok) continue;
      expect(typeof result.error).toBe('string');
    }
  });
});
