import { fetchText } from '@/lib/http';
import { rowCells, tableRows } from '@/lib/html';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

/**
 * Boundless API — full public catalogue parser.
 *
 * `/en/models.html` lists every catalogued model together with its Boundless,
 * official and OpenRouter rates plus a lifecycle status. AI API Prices only
 * publishes rows whose status is `Live`; "Coming soon" prices are useful
 * product metadata but are not offers a visitor can actually buy yet.
 *
 * The page mixes token-priced LLMs with per-second video and per-image models.
 * Only plain input/output token pairs belong in the comparison table.
 */
const MODELS_URL = 'https://www.boundlessapi.com/en/models.html';

/** `"$1.25 / $7.5"` -> `[1.25, 7.5]`. */
export function parsePricePair(cell: string): [number | null, number | null] {
  const parts = cell.split('/');
  if (parts.length < 2) return [null, null];
  return [parseUsd(parts[0]), parseUsd(parts[1])];
}

function isTokenPair(cell: string): boolean {
  if (/\/(?:s|sec|second|img|image|request|min|minute)\b/i.test(cell)) return false;
  const [input, output] = parsePricePair(cell);
  return input !== null && output !== null;
}

export function parseModelsPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];

  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length < 7) continue;

    const name = cells[0]?.trim();
    const status = cells[6]?.trim().toLowerCase();
    const priceCell = cells[2] ?? '';
    if (!name || status !== 'live' || !isTokenPair(priceCell)) continue;

    const [input, output] = parsePricePair(priceCell);
    const [referenceInput, referenceOutput] = parsePricePair(cells[3] ?? '');

    offers.push({
      provider_model_id: name,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      reference_input_usd_per_1m: referenceInput,
      reference_output_usd_per_1m: referenceOutput,
      source_url: MODELS_URL,
    });
  }

  if (offers.length === 0) {
    throw new Error('Boundless API: live token-price table not found or empty (page layout may have changed)');
  }
  return offers;
}

export const boundlessAdapter: Adapter = {
  provider_id: 'boundlessapi',
  source_kind: 'html',
  async fetchOffers() {
    return parseModelsPage(await fetchText(MODELS_URL));
  },
};
