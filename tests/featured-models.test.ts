import { describe, expect, it } from 'vitest';
import { FEATURED_MODEL_IDS, pickFeaturedModels } from '@/lib/featured-models';
import type { ModelView } from '@/lib/view';

function model(id: string): ModelView {
  return {
    id,
    display_name: id,
    maker: null,
    offers: [],
    search_text: id,
    provider_count: 1,
    best_input_usd_per_1m: null,
    best_output_usd_per_1m: null,
    best_discount_pct: null,
    official_baseline: null,
  };
}

describe('pickFeaturedModels', () => {
  it('keeps the homepage focused on current flagships with live provider coverage', () => {
    expect(FEATURED_MODEL_IDS).toEqual([
      'claude-fable-5',
      'gpt-5.6-sol',
      'claude-opus-5',
      'claude-sonnet-5',
      'gemini-3.1-pro',
      'grok-4.6',
      'glm-5.3',
      'deepseek-v4-pro',
    ]);
  });

  it('shows only the curated homepage models in product order', () => {
    const catalogue = [
      model('qwen3.8-max'),
      model('gpt-4o'),
      model('grok-4.6'),
      model('deepseek-v4-pro'),
      model('claude-sonnet-4.6'),
      model('claude-opus-5'),
      model('glm-5.3'),
      model('claude-fable-5'),
      model('gemini-3.1-pro'),
      model('claude-sonnet-5'),
      model('gpt-5.6-sol'),
      model('gemini-2.5-pro'),
    ];

    expect(pickFeaturedModels(catalogue).map((item) => item.id)).toEqual(FEATURED_MODEL_IDS);
  });

  it('skips a featured model when no provider currently has an offer for it', () => {
    const catalogue = FEATURED_MODEL_IDS.filter((id) => id !== 'grok-4.6').map(model);

    expect(pickFeaturedModels(catalogue).map((item) => item.id)).not.toContain('grok-4.6');
    expect(pickFeaturedModels(catalogue)).toHaveLength(FEATURED_MODEL_IDS.length - 1);
  });
});
