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
];

export const PROVIDERS_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

/** Where provider-name and Visit links send the user. */
export function visitUrl(provider: Provider): string {
  return provider.affiliate_url ?? provider.website_url;
}
