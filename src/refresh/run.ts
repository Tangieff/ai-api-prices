import { ADAPTERS } from '@/adapters';
import type { Adapter, RawOffer } from '@/adapters';
import { canonicalModelId, describeModel } from '@/lib/models';
import { effectiveUsdPer1m } from '@/lib/effective-cost';
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
 * offers the previous run captured. A failed source gets two bounded retries;
 * there is still no queue and no partial-write window.
 */

export interface RefreshResult {
  dataset: Dataset;
  statuses: ProviderStatus[];
}

/** Per-adapter timeout guard. `fetchText`/`fetchJson` also time out; this covers seeds and parsing. */
const ADAPTER_TIMEOUT_MS = 45_000;
const RETRY_BACKOFF_MS = [250, 750] as const;

type AdapterOutcome =
  | { ok: true; provider_id: string; offers: RawOffer[] }
  | { ok: false; provider_id: string; error: string };

async function attemptAdapter(adapter: Adapter): Promise<RawOffer[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      adapter.fetchOffers(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`adapter exceeded ${ADAPTER_TIMEOUT_MS}ms`)),
          ADAPTER_TIMEOUT_MS,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runAdapter(
  adapter: Adapter,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<AdapterOutcome> {
  let lastError = 'unknown adapter error';
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      return { ok: true, provider_id: adapter.provider_id, offers: await attemptAdapter(adapter) };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const delay = RETRY_BACKOFF_MS[attempt];
      if (delay !== undefined) await sleep(delay);
    }
  }
  return {
    ok: false,
    provider_id: adapter.provider_id,
    error: `failed after ${RETRY_BACKOFF_MS.length + 1} attempts: ${lastError}`,
  };
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
    input_usd_per_1m: effectiveUsdPer1m(raw.input_usd_per_1m, raw.effective_cost),
    output_usd_per_1m: effectiveUsdPer1m(raw.output_usd_per_1m, raw.effective_cost),
    cache_read_usd_per_1m: effectiveUsdPer1m(raw.cache_read_usd_per_1m, raw.effective_cost),
    cache_write_usd_per_1m: effectiveUsdPer1m(raw.cache_write_usd_per_1m, raw.effective_cost),
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
  /** Injectable so retry tests do not wait on wall-clock backoff. */
  sleep?: (milliseconds: number) => Promise<void>;
}

export async function refresh(options: RefreshOptions = {}): Promise<RefreshResult> {
  const previous = options.previous ?? emptyDataset();
  const adapters = options.adapters ?? ADAPTERS;
  const now = options.now ?? (() => new Date());
  const observedAt = now().toISOString();
  const log = options.onProgress ?? (() => {});
  const sleep =
    options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  const outcomes = await Promise.all(adapters.map((adapter) => runAdapter(adapter, sleep)));

  const offers: Offer[] = [];
  const statuses: ProviderStatus[] = [];

  for (const outcome of outcomes) {
    const previousStatus = previous.provider_status.find(
      (status) => status.provider_id === outcome.provider_id,
    );

    let failureError = outcome.ok ? null : outcome.error;
    if (outcome.ok) {
      try {
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
      } catch (error) {
        failureError = `normalization failed: ${error instanceof Error ? error.message : String(error)}`;
      }
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
      error: failureError,
      stale: carried.length > 0,
    });
    log(
      `FAIL  ${outcome.provider_id}: ${failureError}` +
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
