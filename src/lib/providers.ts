import type { Provider } from './types';
import { referralUrl } from './referrals';

/**
 * Providers currently included by the refresh pipeline.
 *
 * Referral destinations are resolved from the canonical referral registry. They
 * affect outbound navigation only and never enter price ingestion,
 * normalization or sorting.
 */
export const PROVIDERS: Provider[] = [
  {
    id: 'surplus-intelligence',
    name: 'Surplus Intelligence',
    website_url: 'https://www.surplusintelligence.ai/',
    affiliate_url: referralUrl('surplus-intelligence'),
    pricing_source_url: 'https://api.surplusintelligence.ai/api/markets',
    source_kind: 'api',
    blurb: 'Marketplace where sellers bid down inference capacity; prices move with the order book.',
  },
  {
    id: 'derouter',
    name: 'derouter.ai',
    website_url: 'https://derouter.ai/',
    affiliate_url: referralUrl('derouter'),
    pricing_source_url: 'https://derouter.ai/pricing',
    source_kind: 'html',
    blurb: 'Fixed-rate gateway for Claude and GPT models with a published discount against list price.',
  },
  {
    id: 'worldgate',
    name: 'WorldGate',
    website_url: 'https://worldgateapi.com/',
    affiliate_url: referralUrl('worldgate'),
    pricing_source_url: 'https://worldgateapi.com/',
    source_kind: 'html',
    blurb: 'OpenAI-compatible gateway routing Claude, GPT and open-weight models at prepaid per-token rates.',
  },
  {
    id: 'getgoapi',
    name: 'GetGoAPI',
    website_url: 'https://getgoapi.com/',
    affiliate_url: referralUrl('getgoapi'),
    pricing_source_url: 'https://getgoapi.com/en/models',
    source_kind: 'html',
    blurb: 'Relay catalogue covering OpenAI, Anthropic, Google and xAI models at a flat discount.',
  },
  {
    id: 'boundlessapi',
    name: 'Boundless API',
    website_url: 'https://www.boundlessapi.com/',
    affiliate_url: referralUrl('boundlessapi'),
    pricing_source_url: 'https://www.boundlessapi.com/en/models.html',
    source_kind: 'html',
    blurb: 'OpenAI-compatible multi-model API publishing live availability and side-by-side discounted token rates.',
  },
  {
    id: 'llmsrelay',
    name: 'LLMsRelay',
    website_url: 'https://llmsrelay.com/',
    affiliate_url: referralUrl('llmsrelay'),
    pricing_source_url: 'https://llmsrelay.com/docs/billing/pricing/',
    source_kind: 'html',
    blurb: 'Claude relay whose effective cash price comes from discounted prepaid usage packs.',
  },
  {
    id: 'frugalrelay',
    name: 'Frugal Relay',
    website_url: 'https://frugalrelay.me/',
    affiliate_url: referralUrl('frugalrelay'),
    pricing_source_url: 'https://frugalrelay.me/api/pricing',
    source_kind: 'api',
    blurb: 'Route-priced OpenAI/Claude relay; each offer keeps its account route visible because eligibility varies.',
  },
];

export const PROVIDERS_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

/** Where provider-name and Visit links send the user. */
export function visitUrl(provider: Provider): string {
  return provider.affiliate_url ?? provider.website_url;
}
