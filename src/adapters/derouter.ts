import { fetchText } from '@/lib/http';
import { rowCells, tableRows } from '@/lib/html';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

/**
 * derouter.ai — public pricing page parser.
 *
 * The pricing table is server-rendered, so a plain fetch is enough. Columns:
 *
 *   Model | Input | Output | Cache R | Cache W | Official I/O | Save
 *
 * "Official I/O" is published as a single `"$10 / $50"` cell and is the
 * provider's own comparison against Anthropic/OpenAI list pricing, so it
 * becomes the reference price. The "Save" column is ignored: the discount is
 * recomputed from the numbers so every provider's badge means the same thing.
 */

const PRICING_URL = 'https://derouter.ai/pricing';

/** `"$10 / $50"` -> `[10, 50]`; a missing or malformed side yields null. */
export function parseOfficialPair(cell: string): [number | null, number | null] {
  const parts = cell.split('/');
  if (parts.length < 2) return [null, null];
  return [parseUsd(parts[0]), parseUsd(parts[1])];
}

export function parsePricingPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];

  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length < 6) continue;

    const name = cells[0]?.trim();
    // Skip the header and any decorative row: a real row always starts with a
    // model name and carries a "$" input price.
    if (!name || !cells[1]?.includes('$')) continue;

    const input = parseUsd(cells[1]);
    const output = parseUsd(cells[2]);
    if (input === null && output === null) continue;

    const [referenceInput, referenceOutput] = parseOfficialPair(cells[5] ?? '');

    offers.push({
      provider_model_id: name,
      display_name: name,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: parseUsd(cells[3]),
      cache_write_usd_per_1m: parseUsd(cells[4]),
      reference_input_usd_per_1m: referenceInput,
      reference_output_usd_per_1m: referenceOutput,
    });
  }

  if (offers.length === 0) {
    throw new Error('derouter.ai: pricing table not found or empty (page layout may have changed)');
  }
  return offers;
}

export const derouterAdapter: Adapter = {
  provider_id: 'derouter',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
