import { buildSearchText } from './search';
import type { ModelView, ProviderRef } from './view';

export interface ProviderSummary {
  id: string;
  name: string;
  visit_url: string;
  source_kind: string;
  model_count: number;
  offer_count: number;
  cheapest_count: number;
  latest_observed_at: string | null;
  search_text: string;
}

/**
 * Build a provider-centric view from the same normalized model data used by the
 * main comparison. No second dataset or ranking system is introduced: coverage
 * counts unique models, while `cheapest_count` simply counts existing best rows.
 */
export function buildProviderSummaries(
  models: ModelView[],
  providers: Record<string, ProviderRef>,
): ProviderSummary[] {
  const summaries = new Map<string, ProviderSummary>();

  for (const provider of Object.values(providers)) {
    summaries.set(provider.id, {
      id: provider.id,
      name: provider.name,
      visit_url: provider.visit_url,
      source_kind: provider.source_kind,
      model_count: 0,
      offer_count: 0,
      cheapest_count: 0,
      latest_observed_at: null,
      search_text: buildSearchText([provider.name, provider.id]),
    });
  }

  for (const model of models) {
    const countedForModel = new Set<string>();

    for (const offer of model.offers) {
      const summary = summaries.get(offer.provider_id);
      if (!summary) continue;

      summary.offer_count += 1;
      if (!countedForModel.has(offer.provider_id)) {
        summary.model_count += 1;
        countedForModel.add(offer.provider_id);
      }
      if (offer.is_best) summary.cheapest_count += 1;
      if (summary.latest_observed_at === null || offer.observed_at > summary.latest_observed_at) {
        summary.latest_observed_at = offer.observed_at;
      }
    }
  }

  return [...summaries.values()]
    .filter((provider) => provider.offer_count > 0)
    .sort(
      (a, b) =>
        b.model_count - a.model_count ||
        b.cheapest_count - a.cheapest_count ||
        a.name.localeCompare(b.name),
    );
}
