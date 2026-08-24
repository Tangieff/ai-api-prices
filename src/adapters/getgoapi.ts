import { fetchText } from '@/lib/http';
import { rowCells, tableRows } from '@/lib/html';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

/**
 * GetGoAPI — public model catalogue parser.
 *
 * `/en/models` server-renders one table row per model:
 *
 *   Status | Model Name | Provider | Context Window | Input Price | Output Price
 *
 * Two details matter:
 *
 *  - Image and video entries are priced per request (`$0.056 /次`) rather than
 *    per 1M tokens. Only rows whose price cell says "1M tokens" are taken, so
 *    per-job prices are never mixed into a per-token column.
 *  - The catalogue publishes no direct/official comparison column, so these
 *    offers carry no provider reference. Public savings use the independent
 *    official model-maker baseline layer instead.
 */

const MODELS_URL = 'https://getgoapi.com/en/models';

/** Only per-1M-token prices belong in the comparison table. */
function parseTokenPrice(cell: string | undefined): number | null {
  if (!cell || !/1M\s*tokens/i.test(cell)) return null;
  return parseUsd(cell);
}

export function parseModelsPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];

  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length < 6) continue;

    const name = cells[1]?.trim();
    if (!name || !isComparableTextTokenModel(name)) continue;

    const input = parseTokenPrice(cells[4]);
    const output = parseTokenPrice(cells[5]);
    if (input === null && output === null) continue;

    offers.push({
      provider_model_id: name,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      source_url: `https://getgoapi.com/en/models/${encodeURIComponent(name)}`,
    });
  }

  if (offers.length === 0) {
    throw new Error('GetGoAPI: model table not found or empty (page layout may have changed)');
  }
  return offers;
}

export const getgoapiAdapter: Adapter = {
  provider_id: 'getgoapi',
  source_kind: 'html',
  async fetchOffers() {
    return parseModelsPage(await fetchText(MODELS_URL));
  },
};
