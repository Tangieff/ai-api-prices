import { rowCells, tableRows } from '@/lib/html';
import { fetchText } from '@/lib/http';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

const PRICING_URL = 'https://zrelay.net/prices.html';
const ENTRY_TIER = '$16 → $100 credit';
const ENTRY_CREDITS_PER_USD = { numerator: 25, denominator: 4 } as const;

function perMillionPrices(cells: string[]): number[] {
  return cells
    .flatMap((cell) => [...cell.matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*M\b/gi)])
    .map((match) => parseUsd(match[1]))
    .filter((value): value is number => value !== null && value > 0);
}

export function parsePricingPage(html: string): RawOffer[] {
  if (!/Starter\s*(?:·|&middot;)?\s*trial[\s\S]*?\$16[\s\S]*?\$100\s+credit/i.test(html)) {
    throw new Error('Zrelay: $16 to $100 entry credit tier not found');
  }

  const offers: RawOffer[] = [];
  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    const model = cells[0];
    if (
      !model ||
      !/^(?:claude|gpt|grok)-[a-z0-9.-]+$/i.test(model) ||
      /(?:^|-)(?:image|video|audio|tts|embedding|whisper|sora|veo)(?:-|$)/i.test(model)
    ) {
      continue;
    }
    const prices = perMillionPrices(cells.slice(1));
    if (prices.length !== 2 && prices.length !== 3) continue;
    const [input, second, third] = prices;
    const output = prices.length === 3 ? third! : second!;
    const cacheRead = prices.length === 3 ? second! : null;
    offers.push({
      provider_model_id: model,
      input_usd_per_1m: input!,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: cacheRead,
      effective_cost: { credits_per_usd: ENTRY_CREDITS_PER_USD },
      reference_input_usd_per_1m: input!,
      reference_output_usd_per_1m: output,
      tier: ENTRY_TIER,
      source_url: PRICING_URL,
    });
  }
  if (offers.length === 0) throw new Error('Zrelay: per-model token debit table not found');
  return offers;
}

export const zrelayAdapter: Adapter = {
  provider_id: 'zrelay',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
