import type { Provider } from './types';

/**
 * Providers currently included by the refresh pipeline.
 *
 * `affiliate_url` affects only the outbound `Visit` destination. It never enters
 * price ingestion, normalization or sorting; `visitUrl()` is the single place
 * that resolves referral links.
 */
export const PROVIDERS: Provider[] = [
  {
    id: 'surplus-intelligence',
    name: 'Surplus Intelligence',
    website_url: 'https://www.surplusintelligence.ai/',
    affiliate_url: 'https://www.surplusintelligence.ai/?ref=avraam',
    pricing_source_url: 'https://api.surplusintelligence.ai/api/markets',
    source_kind: 'api',
    blurb: 'Marketplace where sellers bid down inference capacity; prices move with the order book.',
  },
  {
    id: 'derouter',
    name: 'derouter.ai',
    website_url: 'https://derouter.ai/',
    affiliate_url: 'https://derouter.ai?ref=mZxRdS1y',
    pricing_source_url: 'https://derouter.ai/pricing',
    source_kind: 'html',
    blurb: 'Fixed-rate gateway for Claude and GPT models with a published discount against list price.',
  },
  {
    id: 'worldgate',
    name: 'WorldGate',
    website_url: 'https://worldgateapi.com/',
    affiliate_url: 'https://worldgateapi.com/register?ref=WG-8FDD9C91C9&redirect=%2Freferral',
    pricing_source_url: 'https://worldgateapi.com/',
    source_kind: 'html',
    blurb: 'OpenAI-compatible gateway routing Claude, GPT and open-weight models at prepaid per-token rates.',
  },
  {
    id: 'getgoapi',
    name: 'GetGoAPI',
    website_url: 'https://getgoapi.com/',
    affiliate_url: 'https://api.getgoapi.com/register?aff=i3VT',
    pricing_source_url: 'https://getgoapi.com/en/models',
    source_kind: 'html',
    blurb: 'Relay catalogue covering OpenAI, Anthropic, Google and xAI models at a flat discount.',
  },
  {
    id: 'boundlessapi',
    name: 'Boundless API',
    website_url: 'https://www.boundlessapi.com/',
    affiliate_url: 'https://oneapi.boundlessapi.com/register?aff=311A',
    pricing_source_url: 'https://www.boundlessapi.com/en/models.html',
    source_kind: 'html',
    blurb: 'OpenAI-compatible multi-model API publishing live availability and side-by-side discounted token rates.',
  },
  {
    id: 'llmsrelay',
    name: 'LLMsRelay',
    website_url: 'https://llmsrelay.com/',
    affiliate_url: 'https://llmsrelay.com/auth?mode=signup&lang=ru&ref=BDF0002E42C7',
    pricing_source_url: 'https://llmsrelay.com/docs/billing/pricing/',
    source_kind: 'html',
    blurb: 'Claude relay whose effective cash price comes from discounted prepaid usage packs.',
  },
  {
    id: 'frugalrelay',
    name: 'Frugal Relay',
    website_url: 'https://frugalrelay.me/',
    affiliate_url: 'https://frugalrelay.me/register?aff=iaCy',
    pricing_source_url: 'https://frugalrelay.me/api/pricing',
    source_kind: 'api',
    blurb: 'Route-priced OpenAI/Claude relay; each offer keeps its account route visible because eligibility varies.',
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
