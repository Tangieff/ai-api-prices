import { fetchText } from '@/lib/http';
import { textOf } from '@/lib/html';
import type { Adapter, RawOffer } from './types';

const MODELS_URL = 'https://relayrouter.io/models';

/** Only explicit USD-per-token direct routes; pool ratios lack an official base rate. */
export function parseModelsPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const row = textOf(match[1] ?? '');
    const priced = row.match(
      /^(.+?)\s+text\s+\$([\d.]+)\s+in\b.*?\$([\d.]+)\s+out\s*\/\s*1M$/i,
    );
    if (!priced) continue;
    const input = Number(priced[2]);
    const output = Number(priced[3]);
    if (!Number.isFinite(input) || !Number.isFinite(output) || input <= 0 || output <= 0) continue;
    offers.push({
      provider_model_id: priced[1]!.trim(),
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      tier: 'direct route',
      source_url: MODELS_URL,
    });
  }
  if (offers.length === 0) throw new Error('RelayRouter: explicit direct-route prices not found');
  return offers;
}

export const relayrouterAdapter: Adapter = {
  provider_id: 'relayrouter',
  source_kind: 'html',
  async fetchOffers() {
    return parseModelsPage(await fetchText(MODELS_URL));
  },
};
