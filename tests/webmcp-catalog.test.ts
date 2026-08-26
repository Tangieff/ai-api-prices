import { describe, expect, it } from 'vitest';
import {
  clampLimit,
  compareModels,
  compareProvidersForModel,
  resolveModel,
  searchModels,
} from '@/lib/webmcp/catalog';
import { buildFixture } from './webmcp-fixture';

const data = buildFixture();

describe('resolveModel', () => {
  it('prefers an exact canonical id', () => {
    expect(resolveModel(data, 'claude-opus-5')?.id).toBe('claude-opus-5');
  });

  it('accepts an exact display name, case-insensitively', () => {
    expect(resolveModel(data, 'gpt-5.6 sol')?.id).toBe('gpt-5.6-sol');
    expect(resolveModel(data, 'CLAUDE OPUS 5')?.id).toBe('claude-opus-5');
  });

  it('falls back to the site search predicate', () => {
    expect(resolveModel(data, 'opus')?.id).toBe('claude-opus-5');
  });

  it('rejects an empty or non-string query rather than guessing', () => {
    expect(resolveModel(data, '')).toBeNull();
    expect(resolveModel(data, '   ')).toBeNull();
    expect(resolveModel(data, undefined)).toBeNull();
    expect(resolveModel(data, 42)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(resolveModel(data, 'llama-9000')).toBeNull();
  });
});

describe('clampLimit', () => {
  it('bounds a caller-supplied row count', () => {
    expect(clampLimit(3, 10)).toBe(3);
    expect(clampLimit(0, 10)).toBe(1);
    expect(clampLimit(9999, 10)).toBe(25);
    expect(clampLimit(Number.NaN, 10)).toBe(10);
    expect(clampLimit('20', 10)).toBe(10);
    expect(clampLimit(undefined, 7)).toBe(7);
  });
});

describe('searchModels', () => {
  it('orders results cheapest first on the documented cost score', () => {
    const result = searchModels(data, {});
    expect(result.models[0]?.id).toBe('tiny-model');
    expect(result.price_unit).toBe('USD per 1M tokens');
  });

  it('never reports a stale offer as the cheapest', () => {
    // Gamma sells Opus 5 at $0.50/$1.00 but its refresh failed.
    const result = searchModels(data, { query: 'opus' });
    expect(result.models[0]?.cheapest?.provider_id).toBe('beta');
    expect(result.models[0]?.cheapest?.input_usd_per_1m).toBe(2);
  });

  it('applies both price ceilings together', () => {
    const cheapInput = searchModels(data, { max_input_usd_per_1m: 1 });
    expect(cheapInput.models.map((model) => model.id)).toContain('tiny-model');
    expect(cheapInput.models.map((model) => model.id)).not.toContain('claude-opus-5');

    // Opus 5 has an offer at $2 in, but none at $2 in AND $1 out.
    const both = searchModels(data, { query: 'opus', max_input_usd_per_1m: 2, max_output_usd_per_1m: 1 });
    expect(both.total_matched).toBe(0);
  });

  it('filters by maker and by provider count', () => {
    expect(searchModels(data, { maker: 'anthropic' }).models.map((m) => m.id)).toEqual(['claude-opus-5']);
    expect(searchModels(data, { min_providers: 3 }).models.map((m) => m.id)).toEqual(['claude-opus-5']);
  });

  it('clamps the returned row count', () => {
    const result = searchModels(data, { limit: 1 });
    expect(result.returned).toBe(1);
    expect(result.total_matched).toBeGreaterThan(1);
  });

  it('reports models with no comparable price without crashing', () => {
    const result = searchModels(data, { query: 'partial' });
    expect(result.models[0]?.id).toBe('partial-model');
    expect(result.models[0]?.cheapest).toBeNull();
  });
});

describe('compareProvidersForModel', () => {
  it('ranks providers cheapest first and flags the winner', () => {
    const result = compareProvidersForModel(data, { model: 'claude-opus-5' });
    if (!('found' in result) || result.found !== true) throw new Error('expected a match');
    expect(result.providers.map((provider) => provider.provider_id)).toEqual(['beta', 'alpha']);
    expect(result.cheapest?.provider_id).toBe('beta');
    expect(result.providers[0]?.is_cheapest).toBe(true);
    expect(result.providers[0]?.provider_name).toBe('Beta Gateway');
  });

  it('excludes stale providers by default and includes them on request', () => {
    const fresh = compareProvidersForModel(data, { model: 'claude-opus-5' });
    if (fresh.found !== true) throw new Error('expected a match');
    expect(fresh.providers.map((p) => p.provider_id)).not.toContain('gamma');

    const withStale = compareProvidersForModel(data, { model: 'claude-opus-5', include_stale: true });
    if (withStale.found !== true) throw new Error('expected a match');
    expect(withStale.providers.map((p) => p.provider_id)).toContain('gamma');
    // Still not the winner, even though it is numerically cheapest.
    expect(withStale.cheapest?.provider_id).toBe('beta');
  });

  it('never lists a stale row above a fresh one under a "cheapest first" caption', () => {
    // Gamma scores 0.5 + 3x1 = 3.5 against Beta's 2 + 3x10 = 32, so a
    // price-only sort would put the unbuyable row first.
    const result = compareProvidersForModel(data, { model: 'claude-opus-5', include_stale: true });
    if (result.found !== true) throw new Error('expected a match');
    const staleIndex = result.providers.findIndex((provider) => provider.stale);
    const lastFreshIndex = result.providers.map((p) => p.stale).lastIndexOf(false);
    expect(staleIndex).toBeGreaterThan(lastFreshIndex);
    expect(result.providers[0]?.provider_id).toBe('beta');
  });

  it('still reports the cheapest provider when the returned page is truncated', () => {
    // The winner must come from the full ranking, not from the sliced rows.
    const result = compareProvidersForModel(data, {
      model: 'claude-opus-5',
      include_stale: true,
      limit: 1,
    });
    if (result.found !== true) throw new Error('expected a match');
    expect(result.providers).toHaveLength(1);
    expect(result.cheapest?.provider_id).toBe('beta');
  });

  it('carries the auditable official baseline through', () => {
    const result = compareProvidersForModel(data, { model: 'claude-opus-5' });
    if (result.found !== true) throw new Error('expected a match');
    expect(result.official_baseline?.input_usd_per_1m).toBe(5);
  });

  it('returns a structured not-found rather than throwing', () => {
    const result = compareProvidersForModel(data, { model: 'nonexistent-model' });
    expect(result.found).toBe(false);
    if (result.found !== false) throw new Error('expected a miss');
    expect(result.requested).toBe('nonexistent-model');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('treats a missing model name as a miss, not a crash', () => {
    expect(compareProvidersForModel(data, {}).found).toBe(false);
  });
});

describe('compareModels', () => {
  it('compares on published prices without a workload', () => {
    const result = compareModels(data, { models: ['Claude Opus 5', 'GPT-5.6 Sol'] });
    if (!result.ok) throw new Error(result.error);
    expect(result.workload).toBeNull();
    expect(result.models.map((entry) => entry.resolved?.id)).toEqual(['claude-opus-5', 'gpt-5.6-sol']);
    expect(result.models[0]?.cheapest_provider?.provider_name).toBe('Beta Gateway');
  });

  it('quotes the winning provider\'s own prices, not independent market minima', () => {
    const result = compareModels(data, { models: ['Claude Opus 5', 'GPT-5.6 Sol'] });
    if (!result.ok) throw new Error(result.error);
    const opus = result.models[0];
    // Beta really does charge $2/$10; the market lows are reported separately.
    expect(opus?.cheapest_provider?.input_usd_per_1m).toBe(2);
    expect(opus?.cheapest_provider?.output_usd_per_1m).toBe(10);
    expect(opus?.market_low_input_usd_per_1m).toBe(2);
    expect(opus?.market_low_output_usd_per_1m).toBe(10);
  });

  it('reports unresolved names instead of dropping them', () => {
    const result = compareModels(data, { models: ['Claude Opus 5', 'not-a-model'] });
    if (!result.ok) throw new Error(result.error);
    expect(result.unresolved).toEqual(['not-a-model']);
    expect(result.models[1]?.resolved).toBeNull();
  });

  it('adds workload costs and picks an overall winner when volumes are given', () => {
    const result = compareModels(data, {
      models: ['Claude Opus 5', 'GPT-5.6 Sol'],
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    if (!result.ok) throw new Error(result.error);
    // Opus 5 cheapest is $2 + $10 = $12; Sol cheapest is $1 + $5 = $6.
    expect(result.models[0]?.workload?.total_usd).toBe(12);
    expect(result.models[1]?.workload?.total_usd).toBe(6);
    expect(result.cheapest_overall?.model_id).toBe('gpt-5.6-sol');
    expect(result.cheapest_overall?.total_usd).toBe(6);
  });

  it('refuses half a workload rather than assuming the other half is zero', () => {
    const result = compareModels(data, { models: ['Claude Opus 5', 'GPT-5.6 Sol'], input_tokens: 1000 });
    expect(result.ok).toBe(false);
  });

  it('enforces the two-to-five model bounds', () => {
    expect(compareModels(data, { models: ['Claude Opus 5'] }).ok).toBe(false);
    expect(compareModels(data, { models: ['a', 'b', 'c', 'd', 'e', 'f'] }).ok).toBe(false);
    expect(compareModels(data, { models: 'Claude Opus 5' }).ok).toBe(false);
  });
});
