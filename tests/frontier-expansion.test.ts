import { describe, expect, it } from 'vitest';
import { ADAPTERS } from '@/adapters';
import { PROVIDERS, PROVIDERS_BY_ID, visitUrl } from '@/lib/providers';
import { canonicalModelId } from '@/lib/models';
import { OFFICIAL_PRICE_BASELINES } from '@/lib/official-prices';
import { PRIMARY_FEATURED_MODEL_IDS } from '@/lib/featured-models';
import { VERIFICATION_RECORDS_BY_PROVIDER } from '@/lib/verification/records';

/**
 * The frontier-gateway expansion: six gateways, each with a retrievable customer
 * price and either a public operator or a registered company behind it.
 */
const ADDED_PROVIDER_IDS = [
  'evolink',
  'gptproto',
  'ohmygpt',
  'quicksilver-pro',
  'teamorouter',
  'zenmux',
];

/**
 * Implemented, tested and kept as history, but removed from the active set by
 * the product owner. An adapter existing must never activate a provider.
 */
const IMPLEMENTED_BUT_INACTIVE = ['atlas-cloud', 'vercel-ai-gateway'];

/** Referral destinations supplied by the product owner. */
const REFERRAL_DESTINATIONS: Record<string, string> = {
  zenmux: 'https://zenmux.ai/invite/3DVZPH',
  gptproto: 'https://gptproto.com/?r=U00VN917',
  'quicksilver-pro': 'https://quicksilverpro.io/?ref=8B8UFVYL',
};

/** No referral link was found for these, so Visit falls back to the site. */
const NO_REFERRAL = ['evolink', 'ohmygpt', 'teamorouter'];

/**
 * An earlier, abandoned experiment added these four as "discount" providers.
 * They pass through at list price or add a funding fee, so they were removed.
 * If one reappears in the registry it is that experiment leaking back in.
 */
const ABANDONED_EXPERIMENT = ['openrouter', 'requesty', 'nanogpt', 'venice'];

describe('frontier provider expansion', () => {
  it('activates exactly the six gateways the product owner kept', () => {
    for (const id of ADDED_PROVIDER_IDS) {
      expect(PROVIDERS_BY_ID.has(id), id).toBe(true);
    }
    expect(PROVIDERS).toHaveLength(12);
  });

  it('keeps the two withdrawn gateways implemented but inactive', () => {
    // `ADAPTERS` is derived from the registry, so an adapter that still exists
    // in the codebase must not put its provider into the refresh set.
    const refreshed = ADAPTERS.map((adapter) => adapter.provider_id);
    for (const id of IMPLEMENTED_BUT_INACTIVE) {
      expect(PROVIDERS_BY_ID.has(id), id).toBe(false);
      expect(refreshed, id).not.toContain(id);
    }
  });

  it('routes Visit through the supplied referral links and nowhere else', () => {
    for (const [id, url] of Object.entries(REFERRAL_DESTINATIONS)) {
      const provider = PROVIDERS_BY_ID.get(id);
      expect(provider?.affiliate_url, id).toBe(url);
      expect(visitUrl(provider!), id).toBe(url);
      // A referral must never reach the price source.
      expect(provider?.pricing_source_url, id).not.toContain('ref=');
      expect(provider?.pricing_source_url, id).not.toContain('invite');
    }
    for (const id of NO_REFERRAL) {
      const provider = PROVIDERS_BY_ID.get(id);
      expect(provider?.affiliate_url, id).toBeNull();
      expect(visitUrl(provider!), id).toBe(provider!.website_url);
    }
  });

  it('does not resurrect the abandoned four-provider experiment', () => {
    for (const id of ABANDONED_EXPERIMENT) {
      expect(PROVIDERS_BY_ID.has(id), id).toBe(false);
    }
  });

  it('keeps the provider registry the only activation source', () => {
    expect(ADAPTERS.map((adapter) => adapter.provider_id).sort()).toEqual(
      PROVIDERS.map((provider) => provider.id).sort(),
    );
  });

  it('gives every newly activated provider a researched transparency record', () => {
    for (const id of ADDED_PROVIDER_IDS) {
      const record = VERIFICATION_RECORDS_BY_PROVIDER.get(id);
      expect(record, id).toBeDefined();
      expect(record?.review_status, id).toBe('reviewed');
    }
  });

});

/**
 * The gateways namespace their catalogues. An unrecognised namespace is glued
 * onto the slug rather than dropped, producing a model with no official
 * baseline — which also silently drops it out of the featured-model gate,
 * because that gate requires a savings figure.
 */
describe('gateway model ids reach their official baseline', () => {
  const GATEWAY_IDS: Record<string, string> = {
    'anthropic/claude-fable-5': 'claude-fable-5',
    'anthropic/claude-opus-5': 'claude-opus-5',
    'anthropic/claude-sonnet-5': 'claude-sonnet-5',
    'openai/gpt-5.6-sol': 'gpt-5.6-sol',
    'openai/gpt-5.6-terra': 'gpt-5.6-terra',
    'openai/gpt-5.6-luna': 'gpt-5.6-luna',
    'google/gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
    'spacexai/grok-4.6': 'grok-4.6',
    'xai/grok-4.6': 'grok-4.6',
    'zai/glm-5.2': 'glm-5.2',
    'zai-org/glm-5.3': 'glm-5.3',
    'alibaba:zhipu/glm-5.2': 'glm-5.2',
    'fireworks/deepseek-v4-pro': 'deepseek-v4-pro',
  };

  it('canonicalises every gateway spelling onto the maker id', () => {
    for (const [raw, expected] of Object.entries(GATEWAY_IDS)) {
      expect(canonicalModelId(raw).id, raw).toBe(expected);
    }
  });

  it('preserves the exact preview and GPT-5.6 variant ids rather than folding them', () => {
    expect(canonicalModelId('google/gemini-3.1-pro-preview').id).toBe('gemini-3.1-pro-preview');
    expect(canonicalModelId('gemini-3.1-pro-preview').id).not.toBe('gemini-3.1-pro');
    const sol = canonicalModelId('openai/gpt-5.6-sol').id;
    const terra = canonicalModelId('openai/gpt-5.6-terra').id;
    const luna = canonicalModelId('openai/gpt-5.6-luna').id;
    expect(new Set([sol, terra, luna]).size).toBe(3);
  });

  it('has an official baseline for every featured primary model', () => {
    for (const id of PRIMARY_FEATURED_MODEL_IDS) {
      expect(OFFICIAL_PRICE_BASELINES.get(id), id).toBeDefined();
    }
  });
});
