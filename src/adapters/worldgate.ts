import { fetchText } from '@/lib/http';
import { rowCells, tableRows } from '@/lib/html';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

/**
 * WorldGate — public homepage parser.
 *
 * The homepage carries the full catalogue as one server-rendered table per
 * model family (Claude, GPT, Kimi, GLM, DeepSeek, Qwen, MiniMax), all with the
 * same columns:
 *
 *   Model | Input | Output | Cache R | Cache W | Official I/O | Discount
 *
 * Prices are read from the cells' `data-price-usd` attributes, never from their
 * text. The site ships a small script that rewrites every price cell from that
 * attribute on load — first to convert into the visitor's billing currency, so
 * the text can read "€0,24" where the attribute holds the canonical USD figure,
 * and second because the server-rendered text is not always current: at capture
 * time "Qwen 3.7 Max" shipped `data-price-usd="1.3"` inside a cell reading
 * "$1.56", and a visitor sees $1.30. The attribute is what the provider
 * actually charges, so that is what gets compared.
 *
 * The "Official I/O" column is the provider's own comparison against list
 * pricing. It currently renders as "—" for every model, so those rows simply
 * carry no reference price and show no discount badge. The same script
 * populates that cell from `data-official-input-usd` / `data-official-output-usd`
 * when WorldGate does publish a comparison, so the parser reads those
 * attributes and picks up the reference price the day they appear.
 */

const PRICING_URL = 'https://worldgateapi.com/';

/** Read one attribute out of a captured start tag. */
function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(tag);
  return match ? (match[1] ?? null) : null;
}

/** List price the row compares against, when the row publishes one. */
function officialPair(rowHtml: string): [number | null, number | null] {
  const cell = /<td\b[^>]*\bdata-official-input-usd="[^"]*"[^>]*>/i.exec(rowHtml);
  if (!cell) return [null, null];
  return [
    parseUsd(attr(cell[0], 'data-official-input-usd')),
    parseUsd(attr(cell[0], 'data-official-output-usd')),
  ];
}

export function parseHomepage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];

  for (const row of tableRows(html)) {
    // A real model row always carries at least an input and an output cell.
    // Header rows and the page's non-pricing tables have none, so this is
    // also what keeps them out.
    const prices = [...row.matchAll(/<td\b[^>]*\bdata-price-usd="([^"]*)"[^>]*>/gi)].map((match) =>
      parseUsd(match[1]),
    );
    if (prices.length < 2) continue;

    const name = rowCells(row)[0]?.trim();
    if (!name) continue;

    const [input = null, output = null, cacheRead = null, cacheWrite = null] = prices;
    if (input === null && output === null) continue;

    const [referenceInput, referenceOutput] = officialPair(row);

    offers.push({
      provider_model_id: name,
      display_name: name,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: cacheRead,
      cache_write_usd_per_1m: cacheWrite,
      reference_input_usd_per_1m: referenceInput,
      reference_output_usd_per_1m: referenceOutput,
    });
  }

  if (offers.length === 0) {
    throw new Error('WorldGate: pricing tables not found or empty (page layout may have changed)');
  }
  return offers;
}

export const worldgateAdapter: Adapter = {
  provider_id: 'worldgate',
  source_kind: 'html',
  async fetchOffers() {
    return parseHomepage(await fetchText(PRICING_URL));
  },
};
