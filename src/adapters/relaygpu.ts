import { fetchText } from '@/lib/http';
import { rowCells, tableRows, textOf } from '@/lib/html';
import type { Adapter, RawOffer } from './types';

const PRICING_URL = 'https://relaygpu.com/pricing';

function prices(cell: string): number[] {
  return [...cell.matchAll(/\$([\d.]+)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function parsePricingPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];
  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length < 3) continue;
    const name = textOf(
      row.match(/<[^>]*class="[^"]*ModelTable_modelName[^>]*>([\s\S]*?)<\//i)?.[1] ??
        cells[0] ??
        '',
    );
    const inputs = prices(cells[1] ?? '');
    const outputs = prices(cells[2] ?? '');
    const cacheReads = prices(cells[3] ?? '');
    if (!name || inputs.length === 0 || outputs.length === 0) continue;

    offers.push({
      provider_model_id: name,
      input_usd_per_1m: inputs[0]!,
      output_usd_per_1m: outputs[0]!,
      cache_read_usd_per_1m: cacheReads[0] ?? null,
      tier: inputs.length > 1 || outputs.length > 1 ? 'standard route' : null,
      source_url: PRICING_URL,
    });

    if (inputs.length > 1 && outputs.length > 1) {
      offers.push({
        provider_model_id: name,
        input_usd_per_1m: inputs[1]!,
        output_usd_per_1m: outputs[1]!,
        cache_read_usd_per_1m: cacheReads[1] ?? null,
        tier: 'OpenGPU network',
        source_url: PRICING_URL,
      });
    }
  }
  if (offers.length === 0) throw new Error('RelayGPU: token pricing table not found');
  return offers;
}

export const relaygpuAdapter: Adapter = {
  provider_id: 'relaygpu',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
