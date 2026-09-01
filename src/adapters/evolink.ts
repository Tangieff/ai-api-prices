import { fetchText } from '@/lib/http';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

const PRICING_URL = 'https://evolink.ai/pricing';

/**
 * EvoLink's pricing page renders its live catalogue (video, image, audio and
 * text/chat models) client-side from a single JSON array embedded in the
 * page's Next.js RSC payload, rather than a static HTML table or a public
 * JSON endpoint (`api.evolink.ai/v1/models` requires an API key). The array
 * is reachable at the literal `"rows":[` marker inside the page, escaped as
 * part of a JS string, so we locate it by bracket-balanced scanning, unescape
 * it, and JSON.parse the result.
 */
const ROWS_MARKER = '\\"rows\\":[';

interface TierRates {
  input?: unknown;
  output?: unknown;
  cacheWrite?: unknown;
  cacheHit?: unknown;
}

interface CatalogRow {
  id?: unknown;
  name?: unknown;
  modality?: unknown;
  apiName?: unknown;
  /**
   * The rate EvoLink actually charges right now (per 1K tokens). `tiers` /
   * `textInUSD` / `officialUSD` on the same row are the vendor's undiscounted
   * list price EvoLink compares itself against — never ingest those.
   */
  fallbackTiers?: unknown;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function extractRows(html: string): unknown[] {
  const markerIndex = html.indexOf(ROWS_MARKER);
  if (markerIndex === -1) {
    throw new Error('EvoLink: pricing catalog rows not found in page');
  }
  const arrayStart = markerIndex + ROWS_MARKER.length - 1;
  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < html.length; i += 1) {
    const char = html[i];
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }
  if (arrayEnd === -1) {
    throw new Error('EvoLink: pricing catalog array was not properly closed');
  }

  const raw = html.slice(arrayStart, arrayEnd + 1);
  const unescaped = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  let parsed: unknown;
  try {
    parsed = JSON.parse(unescaped);
  } catch {
    throw new Error('EvoLink: pricing catalog was not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('EvoLink: pricing catalog root was not an array');
  }
  return parsed;
}

export function parsePricingPage(html: string): RawOffer[] {
  const rows = extractRows(html);
  const offers: RawOffer[] = [];

  for (const entry of rows) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as CatalogRow;
    if (row.modality !== 'text') continue;

    const modelId =
      typeof row.apiName === 'string' && row.apiName
        ? row.apiName
        : typeof row.id === 'string'
          ? row.id
          : null;
    if (!modelId || !isComparableTextTokenModel(modelId)) continue;

    const rates = row.fallbackTiers;
    if (!rates || typeof rates !== 'object') continue;
    const tierRates = rates as TierRates;

    const input = positive(tierRates.input);
    const output = positive(tierRates.output);
    if (input === null || output === null) continue;

    const cacheRead = positive(tierRates.cacheHit);
    const cacheWrite = positive(tierRates.cacheWrite);

    offers.push({
      provider_model_id: modelId,
      display_name: typeof row.name === 'string' ? row.name : undefined,
      // Source values are USD per 1K tokens; the dataset wants USD per 1M.
      input_usd_per_1m: input * 1000,
      output_usd_per_1m: output * 1000,
      cache_read_usd_per_1m: cacheRead !== null ? cacheRead * 1000 : undefined,
      cache_write_usd_per_1m: cacheWrite !== null ? cacheWrite * 1000 : undefined,
      source_url: PRICING_URL,
    });
  }

  if (offers.length === 0) {
    throw new Error('EvoLink: no priced text token models found in catalog');
  }
  return offers;
}

export const evolinkAdapter: Adapter = {
  provider_id: 'evolink',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
