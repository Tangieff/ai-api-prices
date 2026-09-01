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
    id: 'cometapi',
    name: 'CometAPI',
    website_url: 'https://www.cometapi.com/',
    affiliate_url: referralUrl('cometapi'),
    pricing_source_url: 'https://www.cometapi.com/pricing/',
    source_kind: 'html',
    blurb: 'Multi-model API publishing token prices and route discounts in its public catalogue.',
  },
  {
    id: 'relayrouter',
    name: 'RelayRouter',
    website_url: 'https://relayrouter.io/',
    affiliate_url: referralUrl('relayrouter'),
    pricing_source_url: 'https://relayrouter.io/models',
    source_kind: 'html',
    blurb: 'Relay catalogue; OXP includes only direct routes with explicit USD token prices.',
  },
  {
    id: 'tokenmix',
    name: 'TokenMix',
    website_url: 'https://tokenmix.ai/',
    affiliate_url: referralUrl('tokenmix'),
    pricing_source_url: 'https://api.tokenmix.ai/api/models',
    source_kind: 'api',
    blurb: 'Public paginated catalogue with model and long-context token pricing tiers.',
  },
  {
    id: 'relaygpu',
    name: 'RelayGPU',
    website_url: 'https://relaygpu.com/',
    affiliate_url: referralUrl('relaygpu'),
    pricing_source_url: 'https://relaygpu.com/pricing',
    source_kind: 'html',
    blurb: 'GPU inference gateway with public token rates and optional OpenGPU routes.',
  },
  {
    id: 'midrelay',
    name: 'MidRelay',
    website_url: 'https://midrelay.com/en',
    affiliate_url: referralUrl('midrelay'),
    pricing_source_url: 'https://midrelay.com/en',
    source_kind: 'html',
    blurb: 'Claude and GPT relay with a compact public USD token price table.',
  },
  {
    id: 'zenmux',
    name: 'ZenMux',
    website_url: 'https://zenmux.ai/',
    affiliate_url: referralUrl('zenmux'),
    pricing_source_url: 'https://zenmux.ai/api/v1/models',
    source_kind: 'api',
    blurb: 'Router publishing USD per-million rates, cache reads and long-context tiers.',
  },
  {
    id: 'gptproto',
    name: 'GPTProto',
    website_url: 'https://gptproto.com/',
    affiliate_url: referralUrl('gptproto'),
    pricing_source_url: 'https://gptproto.com/model',
    source_kind: 'html',
    blurb: 'Hong Kong gateway publishing one flat USD token rate per model in a public catalogue.',
  },
  {
    id: 'evolink',
    name: 'EvoLink',
    website_url: 'https://evolink.ai/',
    affiliate_url: referralUrl('evolink'),
    pricing_source_url: 'https://evolink.ai/pricing',
    source_kind: 'html',
    blurb: 'Prepaid-credit gateway publishing a dated catalogue of the rates it actually charges.',
  },
  {
    id: 'ohmygpt',
    name: 'OhMyGPT',
    website_url: 'https://www.ohmygpt.com/',
    affiliate_url: referralUrl('ohmygpt'),
    pricing_source_url: 'https://www.ohmygpt.com/models',
    source_kind: 'html',
    blurb: 'Unified-balance gateway; only its USD-priced routes enter the comparison, never its CNY ones.',
  },
  {
    id: 'quicksilver-pro',
    name: 'QuickSilver Pro',
    website_url: 'https://quicksilverpro.io/',
    affiliate_url: referralUrl('quicksilver-pro'),
    pricing_source_url: 'https://quicksilverpro.io/pricing.json',
    source_kind: 'api',
    blurb: 'Publishes its own price file as the billing source of truth, including long-context tiers.',
  },
  {
    id: 'teamorouter',
    name: 'TeamoRouter',
    website_url: 'https://teamorouter.com/',
    affiliate_url: referralUrl('teamorouter'),
    pricing_source_url: 'https://teamorouter.com/pricing',
    source_kind: 'html',
    blurb: 'Prepaid-credit relay; the charged rate is read, never its struck-through list column.',
  },
];

export const PROVIDERS_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

/** Where provider-name and Visit links send the user. */
export function visitUrl(provider: Provider): string {
  return provider.affiliate_url ?? provider.website_url;
}
