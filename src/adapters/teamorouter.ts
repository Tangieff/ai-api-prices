import { tableRows } from '@/lib/html';
import { fetchText } from '@/lib/http';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

/**
 * TeamoRouter — public pricing table parser.
 *
 * `/pricing` redirects to the homepage's `#pricing` anchor, which
 * server-renders one `<table class="price-table">` with two prices per
 * model:
 *
 *   <td class="off">$3.00</td>   <!-- "Input (List)" -- struck-through reference -->
 *   <td class="off">$15.00</td>  <!-- "Output (List)" -->
 *   <td class="tr">$0.50 <span class="disc">-84%</span></td>  <!-- "Input (TeamoRouter)" -- actual charge -->
 *   <td class="tr">$2.52</td>    <!-- "Output (TeamoRouter)" -->
 *
 * The "List" (`off`) column is a maker-comparison reference that TeamoRouter
 * itself sometimes inflates above the real official rate (their own copy
 * shows Claude Sonnet 5 compared against $3/$15 when Anthropic's published
 * price is $2/$10), and the adjacent "% off" badge is derived from that same
 * inflated figure. Neither is a price anyone is charged, so this parser
 * reads only the "TeamoRouter" (`tr`) cells — the actual customer price —
 * and never stores the `off` figures or the discount badge text anywhere in
 * the returned offers.
 */

const PRICING_URL = 'https://teamorouter.com/pricing';

/** First dollar amount appearing in a price cell's markup, in document order. */
function firstPrice(cellHtml: string): number | null {
  const match = /\$\s*([0-9]+(?:\.[0-9]+)?)/.exec(cellHtml);
  return match ? parseUsd(match[1]) : null;
}

export function parsePricingPage(html: string): RawOffer[] {
  const tableMatch = /<table class="price-table">([\s\S]*?)<\/table>/.exec(html);
  if (!tableMatch) {
    throw new Error('TeamoRouter: price-table not found (page layout may have changed)');
  }
  const tableHtml = tableMatch[1]!;

  // Anchor on the column headers so a silent reorder of List vs TeamoRouter
  // columns (or a rename that would flip which class means what) fails loudly
  // instead of quietly swapping the reference price in for the real one.
  if (!/Input \(List\)/.test(tableHtml) || !/Input \(TeamoRouter\)/.test(tableHtml)) {
    throw new Error('TeamoRouter: expected "Input (List)" / "Input (TeamoRouter)" columns not found');
  }

  const offers: RawOffer[] = [];
  for (const row of tableRows(tableHtml)) {
    const nameMatch = /class="ent-name">([^<]+)</.exec(row);
    if (!nameMatch) continue; // header row or a row without the model-name markup

    const name = nameMatch[1]!.trim();
    if (!name || !isComparableTextTokenModel(name)) continue;

    const priceCells = [...row.matchAll(/<td class="(off|tr)">([\s\S]*?)<\/td>/g)];
    // A real row always carries the reference pair followed by the
    // customer-charged pair, in that exact order. Anything else — missing
    // cells, a reordered pair, a merged/split cell from a layout change — is
    // rejected rather than guessed at.
    if (priceCells.length !== 4 || priceCells.map((cell) => cell[1]).join(',') !== 'off,off,tr,tr') {
      continue;
    }

    const input = firstPrice(priceCells[2]![2]!);
    const output = firstPrice(priceCells[3]![2]!);
    if (input === null || input <= 0 || output === null || output <= 0) continue;

    offers.push({
      provider_model_id: name,
      display_name: name,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      source_url: PRICING_URL,
    });
  }

  if (offers.length === 0) {
    throw new Error('TeamoRouter: no customer-priced model rows found');
  }
  return offers;
}

export const teamorouterAdapter: Adapter = {
  provider_id: 'teamorouter',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
