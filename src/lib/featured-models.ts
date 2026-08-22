import type { ModelView } from './view';

/**
 * Models promoted on the homepage when there is no active search.
 *
 * Keep this list intentionally small and product-curated. The full provider
 * catalogue stays in `models` and remains searchable; adding a provider/model
 * must never make it appear on the homepage automatically.
 */
export const FEATURED_MODEL_IDS = [
  'claude-fable-5',
  'gpt-5.6-sol',
  'claude-opus-5',
  'claude-sonnet-5',
  'glm-5.2',
  'grok-4.6',
] as const;

export function pickFeaturedModels(models: ModelView[]): ModelView[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  return FEATURED_MODEL_IDS.flatMap((id) => {
    const model = byId.get(id);
    return model ? [model] : [];
  });
}
