import type { Provider } from './types';

/**
 * The five launch providers.
 *
 * `affiliate_url` is null everywhere for now — there are no referral deals yet.
 * The field exists so a link can be dropped in later without touching the UI:
 * `visitUrl()` is the single place that decides where `Visit` points.
 */
export const PROVIDERS: Provider[] = [
  {
    id: 'surplus-intelligence',
    name: 'Surplus Intelligence',
    website_url: 'https://www.surplusintelligence.ai/',
    affiliate_url: null,
    pricing_source_url: 'https://api.surplusintelligence.ai/api/markets',
    source_kind: 'api',
    blurb: 'Marketplace where sellers bid down inference capacity; prices move with the order book.',
  },
  {
    id: 'derouter',
    name: 'derouter.ai',
    website_url: 'https://derouter.ai/',
    affiliate_url: null,
    pricing_source_url: 'https://derouter.ai/pricing',
    source_kind: 'html',
    blurb: 'Fixed-rate gateway for Claude and GPT models with a published discount against list price.',
  },
  {
    id: 'clawhive',
    name: 'ClawHive',
    website_url: 'https://clawhive.io/',
    affiliate_url: null,
    pricing_source_url: 'https://clawhive.io/',
    source_kind: 'html',
    blurb: 'OpenAI-compatible gateway advertising Claude models at half the direct API price.',
  },
  {
    id: 'worldgate',
    name: 'WorldGate',
    website_url: 'https://worldgateapi.com/',
    affiliate_url: null,
    pricing_source_url: 'https://worldgateapi.com/',
    source_kind: 'html',
    blurb: 'OpenAI-compatible gateway routing Claude, GPT and open-weight models at prepaid per-token rates.',
  },
  {
    id: 'getgoapi',
    name: 'GetGoAPI',
    website_url: 'https://getgoapi.com/',
    affiliate_url: null,
    pricing_source_url: 'https://getgoapi.com/en/models',
    source_kind: 'html',
    blurb: 'Relay catalogue covering OpenAI, Anthropic, Google and xAI models at a flat discount.',
  },
];

export const PROVIDERS_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

/**
 * Where the `Visit` button sends the user.
 *
 * Referral link when one is configured, plain provider site otherwise. This is
 * the only referral behaviour in the MVP.
 */
export function visitUrl(provider: Provider): string {
  return provider.affiliate_url ?? provider.website_url;
}
