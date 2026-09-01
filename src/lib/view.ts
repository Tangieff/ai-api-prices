import type { Dataset, Offer, ProviderStatus } from './types';
import { offerDiscountAgainstOfficial } from './money';
import {
  officialPriceComparison,
  type OfficialPriceBaseline,
} from './official-prices';
import { PROVIDERS_BY_ID, visitUrl } from './providers';
import { compareOffers, costScoreMicros } from './score';
import { buildSearchText } from './search';

/**
 * The shape the page actually renders.
 *
 * Built once on the server so the browser never sees the raw dataset: provider
 * records are already resolved onto each row, offers are already sorted, and
 * the search blob is precomputed. That keeps the client component to filtering
 * and rendering.
 */

/**
 * Provider fields an offer row needs, sent once per provider rather than copied
 * onto all 300-odd offers. Offers reference it by `provider_id`.
 */
export interface ProviderRef {
  id: string;
  name: string;
  /** Already resolved through `affiliate_url ?? website_url`. */
  visit_url: string;
  source_kind: string;
}

export interface OfferView {
  provider_id: string;
  input_usd_per_1m: number | null;
  output_usd_per_1m: number | null;
  cache_read_usd_per_1m: number | null;
  cache_write_usd_per_1m: number | null;
  discount_pct: number | null;
  /** Signed price difference versus the official baseline: negative is cheaper. */
  official_price_delta_pct?: number | null;
  /** Why a public comparison is unavailable, used by the accessible dash. */
  discount_unavailable_reason: string | null;
  observed_at: string;
  tier: string | null;
  /** True when this is the cheapest comparable offer for the model. */
  is_best: boolean;
  /** True when the provider's last refresh failed and this row is carried over. */
  stale: boolean;
}

export interface ModelView {
  id: string;
  display_name: string;
  maker: string | null;
  offers: OfferView[];
  /** Lowercased text the client filters against. */
  search_text: string;
  provider_count: number;
  /** Cheapest input price across providers, used for the summary line. */
  best_input_usd_per_1m: number | null;
  best_output_usd_per_1m: number | null;
  /** Largest saving versus the official standard API baseline, when comparable. */
  best_discount_pct: number | null;
  /** Auditable first-party maker price used by every comparable offer. */
  official_baseline: OfficialPriceBaseline | null;
}

export interface ProviderStatusView extends ProviderStatus {
  name: string;
  website_url: string;
  visit_url: string;
  pricing_source_url: string;
  source_kind: string;
  blurb: string;
}

export interface PageData {
  models: ModelView[];
  /** Provider lookup for offer rows, keyed by `provider_id`. */
  providers: Record<string, ProviderRef>;
  provider_status: ProviderStatusView[];
  generated_at: string | null;
  total_offers: number;
}

function officialPriceDeltaPct(
  offer: Pick<Offer, 'input_usd_per_1m' | 'output_usd_per_1m'>,
  baseline: OfficialPriceBaseline,
): number | null {
  const offerScore = costScoreMicros(offer);
  const baselineScore = costScoreMicros(baseline);
  if (offerScore === null || baselineScore === null || baselineScore <= 0) return null;
  const pct = ((offerScore - baselineScore) / baselineScore) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function toOfferView(offer: Offer, isBest: boolean, stale: boolean, now: Date): OfferView | null {
  if (!PROVIDERS_BY_ID.has(offer.provider_id)) return null;
  const comparison = officialPriceComparison(offer, now);
  const discount =
    comparison.comparable && comparison.baseline
      ? offerDiscountAgainstOfficial(offer, comparison.baseline)
      : null;
  const officialPriceDelta =
    comparison.comparable && comparison.baseline
      ? officialPriceDeltaPct(offer, comparison.baseline)
      : null;
  const discountUnavailableReason =
    comparison.unavailable_reason ??
    (discount === null
      ? offer.input_usd_per_1m === null || offer.output_usd_per_1m === null
        ? 'Comparable input and output prices unavailable'
        : 'No saving vs official standard API price'
      : null);
  return {
    provider_id: offer.provider_id,
    input_usd_per_1m: offer.input_usd_per_1m,
    output_usd_per_1m: offer.output_usd_per_1m,
    cache_read_usd_per_1m: offer.cache_read_usd_per_1m,
    cache_write_usd_per_1m: offer.cache_write_usd_per_1m,
    discount_pct: discount,
    official_price_delta_pct: officialPriceDelta,
    discount_unavailable_reason: discountUnavailableReason,
    observed_at: offer.observed_at,
    tier: offer.tier,
    is_best: isBest,
    stale,
  };
}

/** Transform the stored dataset into everything the homepage needs. */
export function buildPageData(dataset: Dataset, now: Date = new Date()): PageData {
  const staleProviders = new Set(
    dataset.provider_status.filter((status) => status.stale).map((status) => status.provider_id),
  );

  const offersByModel = new Map<string, Offer[]>();
  for (const offer of dataset.offers) {
    const bucket = offersByModel.get(offer.model_id);
    if (bucket) bucket.push(offer);
    else offersByModel.set(offer.model_id, [offer]);
  }

  const models: ModelView[] = [];
  for (const model of dataset.models) {
    const sorted = [...(offersByModel.get(model.id) ?? [])].sort((a, b) => {
      const staleOrder =
        Number(staleProviders.has(a.provider_id)) - Number(staleProviders.has(b.provider_id));
      return staleOrder || compareOffers(a, b);
    });
    if (sorted.length === 0) continue;

    // "Best" means cheapest on the documented cost score. An offer missing a
    // price is not comparable, so it can never be the best even if it sorts
    // first in an all-incomplete group.
    const cheapest = sorted.find(
      (offer) => !staleProviders.has(offer.provider_id) && costScoreMicros(offer) !== null,
    );

    const offers = sorted
      .map((offer) =>
        toOfferView(offer, offer === cheapest, staleProviders.has(offer.provider_id), now),
      )
      .filter((offer): offer is OfferView => offer !== null);
    if (offers.length === 0) continue;

    const freshOffers = offers.filter((offer) => !offer.stale);
    const prices = freshOffers
      .map((offer) => offer.input_usd_per_1m)
      .filter((p): p is number => p !== null);
    const outputs = freshOffers
      .map((offer) => offer.output_usd_per_1m)
      .filter((p): p is number => p !== null);
    const discounts = freshOffers
      .map((offer) => offer.discount_pct)
      .filter((d): d is number => d !== null);

    models.push({
      id: model.id,
      display_name: model.display_name,
      maker: model.maker,
      offers,
      search_text: buildSearchText([
        model.display_name,
        model.id,
        model.maker,
        model.family,
        ...model.aliases,
        ...offers.map((offer) => PROVIDERS_BY_ID.get(offer.provider_id)?.name ?? ''),
      ]),
      provider_count: new Set(offers.map((offer) => offer.provider_id)).size,
      best_input_usd_per_1m: prices.length > 0 ? Math.min(...prices) : null,
      best_output_usd_per_1m: outputs.length > 0 ? Math.min(...outputs) : null,
      best_discount_pct: discounts.length > 0 ? Math.max(...discounts) : null,
      official_baseline: officialPriceComparison({ model_id: model.id, tier: null }, now).baseline,
    });
  }

  // Models comparable across several providers are the point of the product, so
  // they lead. Within the same provider count, alphabetical keeps the order
  // stable between refreshes.
  models.sort(
    (a, b) => b.provider_count - a.provider_count || a.display_name.localeCompare(b.display_name),
  );

  const provider_status: ProviderStatusView[] = dataset.provider_status.flatMap((status) => {
    const provider = PROVIDERS_BY_ID.get(status.provider_id);
    if (!provider) return [];
    return [
      {
        ...status,
        name: provider.name,
        website_url: provider.website_url,
        visit_url: visitUrl(provider),
        pricing_source_url: provider.pricing_source_url,
        source_kind: provider.source_kind,
        blurb: provider.blurb,
      },
    ];
  });

  const providers: Record<string, ProviderRef> = {};
  for (const provider of PROVIDERS_BY_ID.values()) {
    providers[provider.id] = {
      id: provider.id,
      name: provider.name,
      visit_url: visitUrl(provider),
      source_kind: provider.source_kind,
    };
  }

  const totalOffers = models.reduce((total, model) => total + model.offers.length, 0);

  return {
    models,
    providers,
    provider_status,
    generated_at: totalOffers > 0 ? dataset.generated_at : null,
    total_offers: totalOffers,
  };
}