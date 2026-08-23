import { fetchText } from '@/lib/http';
import { textOf } from '@/lib/html';
import type { Adapter, RawOffer } from './types';

const MODELS_URL = 'https://omniakey.com/models';

export function parseModelsPage(html: string): RawOffer[] {
  const offers: RawOffer[] = [];
  const cards = /<a\b(?=[^>]*class="[^"]*\bgroup\b[^"]*\bgrid\b)[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(cards)) {
    const body = match[2] ?? '';
    const name = textOf(body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
    const id = textOf(body.match(/<p\b[^>]*font-mono[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
    const values = [...textOf(body).matchAll(/\$([\d.]+)\s*USD/gi)].map((item) => Number(item[1]));
    if (!name || !id || values.length < 4 || values.some((value) => !Number.isFinite(value))) continue;
    offers.push({
      provider_model_id: id,
      display_name: name,
      input_usd_per_1m: values[0]!,
      output_usd_per_1m: values[2]!,
      reference_input_usd_per_1m: values[1]!,
      reference_output_usd_per_1m: values[3]!,
      source_url: new URL(match[1]!, 'https://omniakey.com').href,
    });
  }
  if (offers.length === 0) throw new Error('OmniaKey: model price cards not found');
  return offers;
}

export const omniakeyAdapter: Adapter = {
  provider_id: 'omniakey',
  source_kind: 'html',
  async fetchOffers() {
    return parseModelsPage(await fetchText(MODELS_URL));
  },
};
