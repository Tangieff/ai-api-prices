import { fetchText } from '@/lib/http';
import { divsWithClass, textOf } from '@/lib/html';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

/**
 * ClawHive — public homepage parser.
 *
 * The pricing block is a static `<div class="price-grid">` of `price-row`s:
 *
 *   <div class="model-name">Claude Haiku 4.5</div>
 *   <div class="old-price">$1 / $5</div>       <- direct API price
 *   <div class="new-price">$0.50 / $2.50</div> <- ClawHive price
 *
 * Both price cells are `"$input / $output"` pairs. Rows where ClawHive simply
 * resells at market rate still list a price, so they are kept — the discount
 * calculation drops the badge on its own when there is no saving.
 */

const PRICING_URL = 'https://clawhive.io/';

/** `"$0.50 / $2.50"` -> `[0.5, 2.5]`. */
function parsePricePair(cell: string): [number | null, number | null] {
  const parts = cell.split('/');
  if (parts.length < 2) return [parseUsd(cell), null];
  return [parseUsd(parts[0]), parseUsd(parts[1])];
}

function firstDivText(html: string, className: string): string | null {
  const [first] = divsWithClass(html, className);
  return first === undefined ? null : textOf(first);
}

export function parseHomepage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];

  for (const row of divsWithClass(html, 'price-row')) {
    const name = firstDivText(row, 'model-name');
    const priceCell = firstDivText(row, 'new-price');
    if (!name || !priceCell) continue;

    const [input, output] = parsePricePair(priceCell);
    if (input === null && output === null) continue;

    const [referenceInput, referenceOutput] = parsePricePair(
      firstDivText(row, 'old-price') ?? '',
    );

    offers.push({
      provider_model_id: name,
      display_name: name,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      reference_input_usd_per_1m: referenceInput,
      reference_output_usd_per_1m: referenceOutput,
    });
  }

  if (offers.length === 0) {
    throw new Error('ClawHive: price grid not found or empty (page layout may have changed)');
  }
  return offers;
}

export const clawhiveAdapter: Adapter = {
  provider_id: 'clawhive',
  source_kind: 'html',
  async fetchOffers() {
    return parseHomepage(await fetchText(PRICING_URL));
  },
};
