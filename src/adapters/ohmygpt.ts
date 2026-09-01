import { fetchText } from '@/lib/http';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

const PRICING_URL = 'https://www.ohmygpt.com/models';

/**
 * OhMyGPT renders its model catalogue as server-rendered `<article>` cards
 * (a flat grid, one card per model) rather than a `<table>`, so this adapter
 * walks `<article>` boundaries itself instead of the shared table helpers.
 *
 * Each card publishes a price pair as
 * `<div class="flex items-baseline …"><span class="… tabular-nums">$X</span>…
 * <span class="… tabular-nums">$Y</span>…/M<span class="… tabular-nums">-10%</span></div>`
 * — input, output, then (optionally) OhMyGPT's own promotional discount badge
 * sharing the same `tabular-nums` class. Only the first two tabular-nums
 * values inside that div are ever read; the badge, and the ctx/max/avail/tps
 * stats in the sibling div, are ignored. The badge is never treated as a
 * reference/list price — OhMyGPT does not publish one on this page.
 *
 * Some cards price in CNY (¥) rather than USD. This adapter only accepts
 * `$`-prefixed pairs; a CNY-only card is skipped rather than converted, since
 * no exchange rate is published anywhere on the source.
 */

function articleBlocks(html: string): string[] {
  return html
    .split('<article')
    .slice(1)
    .map((chunk) => chunk.split('</article>')[0] ?? '');
}

function usdPrice(text: string | undefined): number | null {
  if (!text) return null;
  const match = /^\$\s*([0-9]+(?:\.[0-9]+)?)$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function priceBlock(article: string): string | null {
  const match = /<div class="flex items-baseline[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(article);
  return match ? match[1] ?? null : null;
}

function firstTwoTabularNums(block: string): [string | undefined, string | undefined] {
  const values = [...block.matchAll(/tabular-nums[^>]*>([^<]*)</g)].map((m) => m[1]);
  return [values[0], values[1]];
}

/**
 * OhMyGPT sells the same model through several upstream routes and prices them
 * differently — "fireworks/deepseek-v4-pro" and "alibaba:deepseek/deepseek-v4-pro"
 * are both DeepSeek V4 Pro at different rates. The namespace canonicalises away,
 * so without a tier the rows would collapse into one and hide a real price the
 * customer can choose. Keep the route as the tier label; a bare id has none.
 */
function upstreamRoute(modelId: string): string | null {
  const slash = modelId.lastIndexOf('/');
  return slash > 0 ? modelId.slice(0, slash) : null;
}

export function parsePricingPage(html: string): RawOffer[] {
  const articles = articleBlocks(html);
  if (articles.length === 0) {
    throw new Error('OhMyGPT: no model cards found on the pricing page');
  }

  const offers: RawOffer[] = [];
  for (const article of articles) {
    const hrefMatch = /href="\/models\/([^"]+)"/.exec(article);
    if (!hrefMatch) continue;
    let modelId: string;
    try {
      modelId = decodeURIComponent(hrefMatch[1]!);
    } catch {
      continue;
    }
    if (!modelId || !isComparableTextTokenModel(modelId)) continue;

    const block = priceBlock(article);
    if (!block) continue;
    const [inputText, outputText] = firstTwoTabularNums(block);
    const input = usdPrice(inputText);
    const output = usdPrice(outputText);
    if (input === null || output === null) continue;

    offers.push({
      provider_model_id: modelId,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      tier: upstreamRoute(modelId),
      source_url: `${PRICING_URL}/${hrefMatch[1]!}`,
    });
  }

  if (offers.length === 0) {
    throw new Error('OhMyGPT: no USD-priced text token models found');
  }
  return offers;
}

export const ohmygptAdapter: Adapter = {
  provider_id: 'ohmygpt',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
