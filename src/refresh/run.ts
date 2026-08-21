import { ADAPTERS } from '@/adapters';
import type { Adapter, RawOffer } from '@/adapters';
import { canonicalModelId, describeModel } from '@/lib/models';
import { offerDiscountPct } from '@/lib/money';
import { PROVIDERS, PROVIDERS_BY_ID } from '@/lib/providers';
import { compareOffers } from '@/lib/score';
import { emptyDataset } from '@/lib/dataset';
import type { Dataset, Model, Offer, ProviderStatus } from '@/lib/types';

/**
 * The refresh pipeline.
 *
 * Adapters run concurrently and in isolation. A provider that times out, 500s
 * or changes its page layout produces a recorded error and keeps whatever
 * offers the previous run captured — it never blanks the other four providers
 * and never aborts the run. That is the whole reliability model: no retries, no
 * queue, no partial-write window.
 */

export interface RefreshResult {
  dataset: Dataset;
  statuses: ProviderStatus[];
}

/** Per-adapter timeout guard. `fetchText`/`fetchJson` also time out; this covers seeds and parsing. */
const ADAPTER_TIMEOUT_MS = 45_000;

type AdapterOutcome =
  | { ok: true; provider_id: string; offers: RawOffer[] }
  | { ok: false; provider_id: string; error: string };

async function runAdapter(adapter: Adapter): Promise<AdapterOutcome> {
  try {
    const offers = await Promise.race([
      adapter.fetchOffers(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`adapter exceeded ${ADAPTER_TIMEOUT_MS}ms`)),
          ADAPTER_TIMEOUT_MS,
        ).unref?.(),
      ),
    ]);
    return { ok: true, provider_id: adapter.provider_id, offers };
  } catch (error) {
    return {
      ok: false,
      provider_id: adapter.provider_id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Turn one adapter row into a stored offer: canonical model id, discount, timestamps. */
function normalise(raw: RawOffer, providerId: string, observedAt: string): Offer | null {
  const provider = PROVIDERS_BY_ID.get(providerId);
  if (!provider) return null;

  const canonical = canonicalModelId(raw.display_name ?? raw.provider_model_id);
  if (!canonical.id) return null;

  const offer: Offer = {
    provider_id: providerId,
    model_id: canonical.id,
    input_usd_per_1m: raw.input_usd_per_1m,
    output_usd_per_1m: raw.output_usd_per_1m,
    cache_read_usd_per_1m: raw.cache_read_usd_per_1m ?? null,
    cache_write_usd_per_1m: raw.cache_write_usd_per_1m ?? null,
    reference_input_usd_per_1m: raw.reference_input_usd_per_1m ?? null,
    reference_output_usd_per_1m: raw.reference_output_usd_per_1m ?? null,
    discount_pct: null,
    observed_at: observedAt,
    source_url: raw.source_url ?? provider.pricing_source_url,
    provider_model_id: raw.provider_model_id,
    // An explicit tier from the adapter wins; otherwise use the reasoning-effort
    // variant folded out of the model id.
    tier: raw.tier ?? canonical.tier,
  };
  offer.discount_pct = offerDiscountPct(offer);
  return offer;
}

/**
 * Collapse duplicate rows for the same provider/model/tier.
 *
 * Catalogues list the same model more than once (dated snapshots, aliases). The
 * cheapest comparable row wins, because that is the price the user can actually
 * get from that provider.
 */
function dedupe(offers: Offer[]): Offer[] {
  const best = new Map<string, Offer>();
  for (const offer of offers) {
    const key = `${offer.provider_id}::${offer.model_id}::${offer.tier ?? ''}`;
    const existing = best.get(key);
    if (!existing || compareOffers(offer, existing) < 0) best.set(key, offer);
  }

  // A catalogue often lists a reasoning variant at exactly the base model's
  // price ("claude-haiku-4-5" and "claude-haiku-4-5-thinking", both $0.80/$4).
  // Showing both is pure noise, so a tiered row is dropped when the same
  // provider already sells the same model at the same price untiered. Tiers
  // that are genuinely priced differently are always kept.
  const untieredPrice = new Map<string, string>();
  for (const offer of best.values()) {
    if (offer.tier === null) {
      untieredPrice.set(
        `${offer.provider_id}::${offer.model_id}`,
        `${offer.input_usd_per_1m}/${offer.output_usd_per_1m}`,
      );
    }
  }
  return [...best.values()].filter(
    (offer) =>
      offer.tier === null ||
      untieredPrice.get(`${offer.provider_id}::${offer.model_id}`) !==
        `${offer.input_usd_per_1m}/${offer.output_usd_per_1m}`,
  );
}

/** Build the `Model` records for every model id present in the offers. */
function collectModels(offers: Offer[]): Model[] {
  const ids = [...new Set(offers.map((offer) => offer.model_id))];
  return ids.map(describeModel).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export interface RefreshOptions {
  /** Previous dataset, used to carry offers forward when an adapter fails. */
  previous?: Dataset;
  adapters?: Adapter[];
  /** Injectable for deterministic tests. */
  now?: () => Date;
  onProgress?: (message: string) => void;
}

export async function refresh(options: RefreshOptions = {}): Promise<RefreshResult> {
  const previous = options.previous ?? emptyDataset();
  const adapters = options.adapters ?? ADAPTERS;
  const now = options.now ?? (() => new Date());
  const observedAt = now().toISOString();
  const log = options.onProgress ?? (() => {});

  const outcomes = await Promise.all(adapters.map(runAdapter));

  const offers: Offer[] = [];
  const statuses: ProviderStatus[] = [];

  for (const outcome of outcomes) {
    const previousStatus = previous.provider_status.find(
      (status) => status.provider_id === outcome.provider_id,
    );

    if (outcome.ok) {
      const normalised = dedupe(
        outcome.offers
          .map((raw) => normalise(raw, outcome.provider_id, observedAt))
          .filter((offer): offer is Offer => offer !== null),
      );
      offers.push(...normalised);
      statuses.push({
        provider_id: outcome.provider_id,
        ok: true,
        offer_count: normalised.length,
        last_success_at: observedAt,
        error: null,
        stale: false,
      });
      log(`ok    ${outcome.provider_id}: ${normalised.length} offers`);
      continue;
    }

    // Failure: keep the previous run's offers for this provider so one broken
    // parser does not empty the comparison table.
    const carried = previous.offers.filter((offer) => offer.provider_id === outcome.provider_id);
    offers.push(...carried);
    statuses.push({
      provider_id: outcome.provider_id,
      ok: false,
      offer_count: carried.length,
      last_success_at: previousStatus?.last_success_at ?? null,
      error: outcome.error,
      stale: carried.length > 0,
    });
    log(
      `FAIL  ${outcome.provider_id}: ${outcome.error}` +
        (carried.length > 0 ? ` (kept ${carried.length} offers from the previous run)` : ''),
    );
  }

  const sortedOffers = offers.sort(
    (a, b) => a.model_id.localeCompare(b.model_id) || compareOffers(a, b),
  );

  return {
    dataset: {
      version: 1,
      generated_at: observedAt,
      providers: PROVIDERS,
      models: collectModels(sortedOffers),
      offers: sortedOffers,
      provider_status: statuses.sort((a, b) => a.provider_id.localeCompare(b.provider_id)),
    },
    statuses,
  };
}
