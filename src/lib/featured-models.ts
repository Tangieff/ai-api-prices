import { PROVIDERS_BY_ID } from './providers';
import type { ModelView, OfferView } from './view';

/**
 * Models promoted on the homepage when there is no active search.
 *
 * Keep this list intentionally small and product-curated. The full provider
 * catalogue stays in `models` and remains searchable; adding a provider/model
 * must never make it appear on the homepage automatically.
 */
export const PRIMARY_FEATURED_MODEL_IDS = [
  'claude-fable-5',
  'gpt-5.6-sol',
  'claude-opus-5',
  'claude-sonnet-5',
  'gemini-3.1-pro-preview',
  'grok-4.6',
] as const;

export const FALLBACK_FEATURED_MODEL_IDS = [
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'claude-opus-4.8',
  'claude-sonnet-4.6',
  'glm-5.3',
  'glm-5.2',
] as const;

export const FEATURED_MODEL_IDS = [
  ...PRIMARY_FEATURED_MODEL_IDS,
  ...FALLBACK_FEATURED_MODEL_IDS,
] as const;

export const MAX_FEATURED_MODELS = 6;

function isQualifyingOffer(offer: OfferView): boolean {
  return (
    PROVIDERS_BY_ID.has(offer.provider_id) &&
    !offer.stale &&
    offer.input_usd_per_1m !== null &&
    offer.output_usd_per_1m !== null &&
    offer.discount_pct !== null
  );
}

function qualifyingProviderCount(model: ModelView): number {
  return new Set(
    model.offers.filter(isQualifyingOffer).map((offer) => offer.provider_id),
  ).size;
}

export function pickFeaturedModels(models: ModelView[]): ModelView[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  const candidates = FEATURED_MODEL_IDS.flatMap((id) => {
    const model = byId.get(id);
    if (!model) return [];
    const providerCount = qualifyingProviderCount(model);
    return providerCount > 0 ? [{ model, providerCount }] : [];
  });

  // Prefer actual cross-provider comparisons. A single-provider quote remains
  // eligible only when fewer than six curated multi-provider models qualify.
  const multiProvider = candidates.filter((candidate) => candidate.providerCount >= 2);
  const singleProvider = candidates.filter((candidate) => candidate.providerCount === 1);

  return [...multiProvider, ...singleProvider]
    .slice(0, MAX_FEATURED_MODELS)
    .map((candidate) => candidate.model);
}
