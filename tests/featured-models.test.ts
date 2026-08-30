import { describe, expect, it } from 'vitest';
import {
  FALLBACK_FEATURED_MODEL_IDS,
  FEATURED_MODEL_IDS,
  MAX_FEATURED_MODELS,
  PRIMARY_FEATURED_MODEL_IDS,
  pickFeaturedModels,
} from '@/lib/featured-models';
import { matches } from '@/lib/search';
import type { ModelView, OfferView } from '@/lib/view';

function offer(overrides: Partial<OfferView> = {}): OfferView {
  return {
    provider_id: 'surplus-intelligence',
    input_usd_per_1m: 1,
    output_usd_per_1m: 5,
    cache_read_usd_per_1m: null,
    cache_write_usd_per_1m: null,
    discount_pct: 80,
    discount_unavailable_reason: null,
    observed_at: '2026-08-30T00:00:00.000Z',
    tier: null,
    is_best: true,
    stale: false,
    ...overrides,
  };
}

function qualifyingOffers(providerCount = 2): OfferView[] {
  const providerIds = ['surplus-intelligence', 'cometapi', 'midrelay'];
  return providerIds.slice(0, providerCount).map((provider_id) => offer({ provider_id }));
}

function model(id: string, offers: OfferView[] = qualifyingOffers()): ModelView {
  return {
    id,
    display_name: id,
    maker: null,
    offers,
    search_text: id,
    provider_count: new Set(offers.map((item) => item.provider_id)).size,
    best_input_usd_per_1m: 1,
    best_output_usd_per_1m: 5,
    best_discount_pct: 80,
    official_baseline: null,
  };
}

describe('pickFeaturedModels', () => {
  it('defines deterministic primary and fallback priorities with the exact Gemini Preview id', () => {
    expect(PRIMARY_FEATURED_MODEL_IDS).toEqual([
      'claude-fable-5',
      'gpt-5.6-sol',
      'claude-opus-5',
      'claude-sonnet-5',
      'gemini-3.1-pro-preview',
      'grok-4.6',
    ]);
    expect(FALLBACK_FEATURED_MODEL_IDS).toEqual([
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'claude-opus-4.8',
      'claude-sonnet-4.6',
      'glm-5.3',
      'glm-5.2',
    ]);
    expect(FEATURED_MODEL_IDS).toEqual([
      ...PRIMARY_FEATURED_MODEL_IDS,
      ...FALLBACK_FEATURED_MODEL_IDS,
    ]);
    expect(FEATURED_MODEL_IDS).not.toContain('gemini-3.1-pro');
    expect(FEATURED_MODEL_IDS).not.toContain('deepseek-v4-pro');
  });

  it('rejects a static candidate with no complete input and output price', () => {
    const incomplete = model('claude-fable-5', [offer({ output_usd_per_1m: null })]);
    expect(pickFeaturedModels([incomplete])).toEqual([]);
  });

  it('rejects a candidate whose only otherwise-qualifying offer is stale', () => {
    const stale = model('claude-fable-5', [offer({ stale: true })]);
    expect(pickFeaturedModels([stale])).toEqual([]);
  });

  it('rejects complete pricing when no saving versus official can be shown', () => {
    const noSaving = model('claude-fable-5', [offer({ discount_pct: null })]);
    expect(pickFeaturedModels([noSaving])).toEqual([]);
  });

  it('rejects offers from providers outside the active registry', () => {
    const inactive = model('claude-fable-5', [offer({ provider_id: 'retired-provider' })]);
    expect(pickFeaturedModels([inactive])).toEqual([]);
  });

  it('accepts a fresh complete active-provider offer with a real saving', () => {
    const qualifying = model('claude-fable-5', qualifyingOffers(1));
    expect(pickFeaturedModels([qualifying]).map((item) => item.id)).toEqual(['claude-fable-5']);
  });

  it('keeps primary ordering deterministic regardless of catalogue order', () => {
    const catalogue = [
      model('glm-5.3'),
      ...[...PRIMARY_FEATURED_MODEL_IDS].reverse().map((id) => model(id)),
      model('qwen3.8-max'),
    ];

    expect(pickFeaturedModels(catalogue).map((item) => item.id)).toEqual(PRIMARY_FEATURED_MODEL_IDS);
  });

  it('activates the next curated fallback when a primary fails the gate', () => {
    const failedPrimary = 'claude-opus-5';
    const catalogue = [
      ...PRIMARY_FEATURED_MODEL_IDS.map((id) =>
        id === failedPrimary ? model(id, [offer({ discount_pct: null })]) : model(id),
      ),
      model('gpt-5.6-terra'),
    ];

    expect(pickFeaturedModels(catalogue).map((item) => item.id)).toEqual([
      'claude-fable-5',
      'gpt-5.6-sol',
      'claude-sonnet-5',
      'gemini-3.1-pro-preview',
      'grok-4.6',
      'gpt-5.6-terra',
    ]);
  });

  it('prefers a multi-provider fallback over a one-provider primary when six stronger comparisons exist', () => {
    const catalogue = [
      model('claude-fable-5', qualifyingOffers(1)),
      ...PRIMARY_FEATURED_MODEL_IDS.slice(1).map((id) => model(id)),
      model('gpt-5.6-terra'),
    ];
    const selected = pickFeaturedModels(catalogue).map((item) => item.id);

    expect(selected).toHaveLength(MAX_FEATURED_MODELS);
    expect(selected).not.toContain('claude-fable-5');
    expect(selected).toContain('gpt-5.6-terra');
  });

  it('never returns more than six models', () => {
    const catalogue = FEATURED_MODEL_IDS.map((id) => model(id));
    expect(pickFeaturedModels(catalogue)).toHaveLength(MAX_FEATURED_MODELS);
  });

  it('features Gemini Preview exactly and never substitutes shorthand or DeepSeek V4 Pro', () => {
    const catalogue = [
      model('gemini-3.1-pro'),
      model('gemini-3.1-pro-preview'),
      model('deepseek-v4-pro'),
    ];

    expect(pickFeaturedModels(catalogue).map((item) => item.id)).toEqual([
      'gemini-3.1-pro-preview',
    ]);
  });

  it('leaves non-featured catalogue models available to normal search', () => {
    const nonFeatured = model('qwen3.8-max');
    const catalogue = [model('claude-fable-5'), nonFeatured];

    expect(pickFeaturedModels(catalogue)).not.toContain(nonFeatured);
    expect(catalogue.filter((item) => matches(item.search_text, 'qwen 3.8 max'))).toEqual([
      nonFeatured,
    ]);
  });
});
