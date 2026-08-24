import { loadDataset } from '@/lib/dataset';
import { COST_SCORE_LABEL } from '@/lib/score';
import { buildPageData } from '@/lib/view';

export const revalidate = 300;

/**
 * Read-only machine-facing view of the same normalized dataset rendered by the
 * homepage. There is no second ingestion path and no mutable API surface.
 */
export async function GET(): Promise<Response> {
  const data = buildPageData(await loadDataset());
  const models = data.models.map((model) => ({
    id: model.id,
    display_name: model.display_name,
    maker: model.maker,
    offers: model.offers,
    provider_count: model.provider_count,
    best_input_usd_per_1m: model.best_input_usd_per_1m,
    best_output_usd_per_1m: model.best_output_usd_per_1m,
    best_discount_pct: model.best_discount_pct,
    official_baseline: model.official_baseline,
  }));
  const providers = Object.values(data.providers).sort((a, b) => a.name.localeCompare(b.name));

  return Response.json(
    {
      schema_version: 2,
      generated_at: data.generated_at,
      price_unit: 'USD per 1M tokens',
      ranking: COST_SCORE_LABEL,
      discount_basis: 'Official model-maker standard API price; input + 3× output weighting',
      total_offers: data.total_offers,
      providers,
      models,
    },
    {
      headers: {
        'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
      },
    },
  );
}
