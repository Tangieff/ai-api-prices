import { fetchText } from '@/lib/http';
import { rowCells, tableRows } from '@/lib/html';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

/**
 * LLMsRelay — public pricing-docs parser.
 *
 * LLMsRelay bills usage at Anthropic-equivalent per-token rates, then sells
 * prepaid usage balances at a large cash discount. The price index therefore publishes an
 * effective cash price rather than pretending the nominal usage rate is what a
 * customer pays out of pocket.
 *
 * To keep the comparison honest and accessible, we always use the smallest
 * public pack found on the page (currently $45 -> $500 usage). Larger packs can
 * have an even better effective rate but require much more upfront spend.
 */
const PRICING_URL = 'https://llmsrelay.com/docs/billing/pricing/';
const USD_PRECISION = 1_000_000;

export interface EntryPack {
  pay_usd: number;
  usage_usd: number;
  multiplier: number;
  tier: string;
}

function compactUsd(value: number): string {
  return String(value);
}

export function parseEntryPack(html: string): EntryPack {
  let best: { pay: number; usage: number } | null = null;

  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length < 2) continue;

    const payCell = cells[0]?.trim() ?? '';
    const usageCell = cells[1]?.trim() ?? '';
    if (!payCell.startsWith('$') || !/(?:balance|usage)/i.test(usageCell)) continue;

    const pay = parseUsd(payCell);
    const usage = parseUsd(usageCell);
    if (pay === null || usage === null || pay <= 0 || usage <= pay) continue;

    if (!best || pay < best.pay) best = { pay, usage };
  }

  if (!best) {
    throw new Error('LLMsRelay: public usage pack not found (pricing page layout may have changed)');
  }

  return {
    pay_usd: best.pay,
    usage_usd: best.usage,
    multiplier: best.pay / best.usage,
    tier: `$${compactUsd(best.pay)} → $${compactUsd(best.usage)} usage`,
  };
}

function effectiveUsd(platformRate: number | null, multiplier: number): number | null {
  if (platformRate === null) return null;
  return Math.round(platformRate * multiplier * USD_PRECISION) / USD_PRECISION;
}

export function parsePricingPage(html: string): RawOffer[] {
  const pack = parseEntryPack(html);
  const offers: RawOffer[] = [];

  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length < 5) continue;

    const name = cells[0]?.trim();
    if (!name || !/^claude-/i.test(name)) continue;

    const platformInput = parseUsd(cells[1]);
    const platformOutput = parseUsd(cells[2]);
    const platformCacheWrite = parseUsd(cells[3]);
    const platformCacheRead = parseUsd(cells[4]);
    if (platformInput === null || platformOutput === null) continue;

    offers.push({
      provider_model_id: name,
      input_usd_per_1m: effectiveUsd(platformInput, pack.multiplier),
      output_usd_per_1m: effectiveUsd(platformOutput, pack.multiplier),
      cache_write_usd_per_1m: effectiveUsd(platformCacheWrite, pack.multiplier),
      cache_read_usd_per_1m: effectiveUsd(platformCacheRead, pack.multiplier),
      reference_input_usd_per_1m: platformInput,
      reference_output_usd_per_1m: platformOutput,
      tier: pack.tier,
      source_url: PRICING_URL,
    });
  }

  if (offers.length === 0) {
    throw new Error('LLMsRelay: model rate table not found or empty (page layout may have changed)');
  }
  return offers;
}

export const llmsrelayAdapter: Adapter = {
  provider_id: 'llmsrelay',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
