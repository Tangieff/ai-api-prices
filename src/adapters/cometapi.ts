import { fetchText } from '@/lib/http';
import type { PriceRatio } from '@/lib/effective-cost';
import type { Adapter, RawOffer } from './types';

const PRICING_URL = 'https://www.cometapi.com/pricing/';

interface CometPrice {
  input?: unknown;
  output?: unknown;
  per_request?: unknown;
  per_second?: unknown;
  ratio?: unknown;
}

interface CometModel {
  id?: unknown;
  name?: unknown;
  model_type?: unknown;
  pricing?: unknown;
  official_pricing?: unknown;
}

function finitePositive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Convert a decimal published by JSON into an exact bounded rational. */
function decimalRatio(value: number): PriceRatio {
  const denominator = 1_000_000;
  const numerator = Math.round(value * denominator);
  let a = numerator;
  let b = denominator;
  while (b !== 0) [a, b] = [b, a % b];
  return { numerator: numerator / a, denominator: denominator / a };
}

function rscValues(html: string): Map<string, unknown> {
  let stream = '';
  for (const match of html.matchAll(/<script>self\.__next_f\.push\((\[1,"(?:\\.|[^"\\])*"\])\)<\/script>/g)) {
    try {
      const frame = JSON.parse(match[1]!) as [number, string];
      if (typeof frame[1] === 'string') stream += frame[1];
    } catch {
      // Ignore unrelated or partial hydration frames; validation below fails closed.
    }
  }
  const values = new Map<string, unknown>();
  for (const line of stream.split('\n')) {
    const match = line.match(/^([0-9a-z]+):([\[{].*)$/i);
    if (!match) continue;
    try {
      values.set(match[1]!, JSON.parse(match[2]!));
    } catch {
      // A non-JSON React protocol record is not a pricing object.
    }
  }
  return values;
}

function resolve(value: unknown, values: Map<string, unknown>): unknown {
  if (typeof value === 'string' && /^\$[0-9a-z]+$/i.test(value)) {
    return values.get(value.slice(1));
  }
  return value;
}

export function parsePricingPage(html: string): RawOffer[] {
  const values = rscValues(html);
  const offers: RawOffer[] = [];
  for (const candidate of values.values()) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const model = candidate as CometModel;
    if (typeof model.id !== 'string' || model.model_type !== 'text') continue;
    const pricing = resolve(model.pricing, values) as CometPrice | undefined;
    if (!pricing || typeof pricing !== 'object') continue;
    const input = finitePositive(pricing.input);
    const output = finitePositive(pricing.output);
    const ratio = finitePositive(pricing.ratio) ?? 1;
    if (input === null || output === null || ratio > 1) continue;
    if (finitePositive(pricing.per_request) !== null || finitePositive(pricing.per_second) !== null) continue;

    const official = resolve(model.official_pricing, values) as CometPrice | undefined;
    offers.push({
      provider_model_id: model.id,
      display_name: typeof model.name === 'string' ? model.name : undefined,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      effective_cost: ratio < 1 ? { route_multiplier: decimalRatio(ratio) } : undefined,
      reference_input_usd_per_1m: finitePositive(official?.input) ?? input,
      reference_output_usd_per_1m: finitePositive(official?.output) ?? output,
      tier: ratio < 1 ? `${Math.round(ratio * 100)}% route` : null,
      source_url: PRICING_URL,
    });
  }
  if (offers.length === 0) throw new Error('CometAPI: text-model pricing records not found');
  return offers;
}

export const cometapiAdapter: Adapter = {
  provider_id: 'cometapi',
  source_kind: 'html',
  async fetchOffers() {
    return parsePricingPage(await fetchText(PRICING_URL));
  },
};
