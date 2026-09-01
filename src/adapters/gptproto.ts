import { fetchText } from '@/lib/http';
import { parseUsd } from '@/lib/money';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

/**
 * GPTProto — public model catalogue.
 *
 * `/model` server-renders one `<li id="catalog-model-{provider}-{id}">` card
 * per model, each ending in a `by <Provider> · $X/1M tokens input ·
 * $Y/1M tokens output` line. That trailing pair is GPTProto's own live price
 * and the only thing this adapter trusts.
 *
 * The same card also carries a "% OFF" marketing badge and a body sentence
 * claiming an "official" per-token price for comparison. Both are GPTProto's
 * own unaudited claims — the Sol row above alone contradicts them (it claims
 * a 20% discount off a made-up $5/$30 "official" price while its own output
 * rate is *above* the real $20 official rate) — so neither is ever read here.
 * `reference_*` is intentionally left undefined for every row.
 *
 * Non-text products (image/video/embedding/speech cards) publish only a
 * single "$X per time" or "$X/1M tokens input" line with no output rate, so
 * the require-both-prices rule below drops them without needing modality
 * detection beyond `isComparableTextTokenModel`.
 */
const CATALOGUE_URL = 'https://gptproto.com/model';

const CARD_RE = /<li id="catalog-model-[\s\S]*?<\/li>/g;
const MODEL_HREF_RE = /href="\/model\/([a-z0-9_-]+)\/([a-zA-Z0-9._-]+)"/;
const NAME_RE = /font-semibold[^>]*>([^<]*)</;
const INPUT_PRICE_RE = /\$([0-9]+(?:\.[0-9]+)?)\/1M tokens input/;
const OUTPUT_PRICE_RE = /\$([0-9]+(?:\.[0-9]+)?)\/1M tokens output/;

export function parsePricingPage(html: string): RawOffer[] {
  const cards = html.match(CARD_RE) ?? [];
  if (cards.length === 0) {
    throw new Error('GPTProto: no model catalogue cards found (page layout may have changed)');
  }

  const offers: RawOffer[] = [];
  for (const card of cards) {
    const hrefMatch = MODEL_HREF_RE.exec(card);
    if (!hrefMatch) continue;
    const [, providerSlug, modelId] = hrefMatch;
    if (!modelId || !isComparableTextTokenModel(modelId)) continue;

    const input = parseUsd(INPUT_PRICE_RE.exec(card)?.[1]);
    const output = parseUsd(OUTPUT_PRICE_RE.exec(card)?.[1]);
    if (input === null || input <= 0 || output === null || output <= 0) continue;

    const name = NAME_RE.exec(card)?.[1]?.trim();

    offers.push({
      provider_model_id: modelId,
      display_name: name && name.length > 0 ? name : undefined,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      // GPTProto's own "official" price and "% OFF" badge are unaudited
      // marketing claims (see module comment) — never ingested.
      reference_input_usd_per_1m: undefined,
      reference_output_usd_per_1m: undefined,
      source_url: `https://gptproto.com/model/${providerSlug}/${modelId}`,
    });
  }

  if (offers.length === 0) {
    throw new Error('GPTProto: no comparable USD-per-1M-token model prices found');
  }
  return offers;
}

export const gptprotoAdapter: Adapter = {
  provider_id: 'gptproto',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(CATALOGUE_URL));
  },
};
