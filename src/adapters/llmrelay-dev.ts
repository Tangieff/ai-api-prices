import { divsWithClass, textOf } from '@/lib/html';
import { fetchText } from '@/lib/http';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';

const PRICING_URL = 'https://llmrelay.dev/pricing/';

function positiveUsd(text: string): number | null {
  const value = parseUsd(text);
  return value !== null && value > 0 ? value : null;
}

function isTextModel(id: string): boolean {
  return !/(?:^|[-/])(?:image|video|audio|tts|embedding|whisper|sora|veo)(?:[-/.]|$)/i.test(id);
}

export function parsePricingPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];
  for (const block of divsWithClass(html, 'grid-cols-5')) {
    const model = /<a\b[^>]*href="\/models\/[^"]+"[^>]*>([^<]+)<\/a>/i.exec(block)?.[1]?.trim();
    if (!model || !isTextModel(model)) continue;
    const prices = [...textOf(block).matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g)].map(
      (match) => positiveUsd(match[1] ?? ''),
    );
    if (prices.length < 3 || prices[0] === null || prices[1] === null) continue;
    offers.push({
      provider_model_id: model,
      input_usd_per_1m: prices[0]!,
      output_usd_per_1m: prices[1]!,
      reference_input_usd_per_1m: prices[2],
      source_url: PRICING_URL,
    });
  }
  if (offers.length === 0) throw new Error('llmrelay: pricing catalogue rows not found');
  return offers;
}

export const llmrelayDevAdapter: Adapter = {
  provider_id: 'llmrelay-dev',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
