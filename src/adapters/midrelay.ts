import { rowCells, tableRows } from '@/lib/html';
import { fetchText } from '@/lib/http';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

const PRICING_URL = 'https://midrelay.com/en';

function pricePair(text: string): [number | null, number | null] {
  const values = [...text.matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g)].map((match) =>
    parseUsd(match[1]),
  );
  return [values[0] ?? null, values[1] ?? null];
}

export function parsePricingPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];
  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length < 4 || cells[0] === 'Model') continue;
    const [input, output] = pricePair(cells[1] ?? '');
    const [referenceInput, referenceOutput] = pricePair(cells[2] ?? '');
    if (input === null || input <= 0 || output === null || output <= 0) continue;
    if (referenceInput === null || referenceOutput === null) continue;
    offers.push({
      provider_model_id: cells[0]!,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      reference_input_usd_per_1m: referenceInput,
      reference_output_usd_per_1m: referenceOutput,
      source_url: PRICING_URL,
    });
  }
  if (offers.length === 0) throw new Error('MidRelay: USD per-token pricing table not found');
  return offers;
}

export const midrelayAdapter: Adapter = {
  provider_id: 'midrelay',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
