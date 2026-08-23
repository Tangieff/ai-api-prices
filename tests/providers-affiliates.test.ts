import { describe, expect, it } from 'vitest';
import { PROVIDERS_BY_ID, visitUrl } from '@/lib/providers';
import { REFERRAL_URLS, referralUrl } from '@/lib/referrals';

const EXPECTED_REFERRALS = {
  derouter: 'https://derouter.ai?ref=mZxRdS1y',
  worldgate: 'https://worldgateapi.com/register?ref=WG-8FDD9C91C9&redirect=%2Freferral',
  getgoapi: 'https://api.getgoapi.com/register?aff=i3VT',
  frugalrelay: 'https://frugalrelay.me/register?aff=iaCy',
  neokens: 'https://neokens.com/signup?ref=LLABUQ9',
  'surplus-intelligence': 'https://www.surplusintelligence.ai/?ref=avraam',
  cometapi: 'https://www.cometapi.com/console/login?aff=fEWl',
  boundlessapi: 'https://oneapi.boundlessapi.com/register?aff=311A',
  claudexia: 'https://claudexia.tech/?ref=WJWU79',
  llmsrelay: 'https://llmsrelay.com/auth?mode=signup&lang=ru&ref=BDF0002E42C7',
  packyapi: 'https://www.packyapi.ai/register?aff=fF9b',
  omniakey: 'https://omniakey.com/ru/register?aff=iCpK2i0Z',
} as const;

describe('provider affiliate destinations', () => {
  it('stores the full supplied referral list verbatim', () => {
    expect(REFERRAL_URLS).toEqual(EXPECTED_REFERRALS);
    for (const [id, url] of Object.entries(EXPECTED_REFERRALS)) {
      expect(referralUrl(id)).toBe(url);
    }
  });

  it('routes integrated providers through a referral when one is registered', () => {
    expect(PROVIDERS_BY_ID.size).toBe(13);
    for (const provider of PROVIDERS_BY_ID.values()) {
      const expected = EXPECTED_REFERRALS[provider.id as keyof typeof EXPECTED_REFERRALS];
      expect(provider.affiliate_url).toBe(expected ?? null);
      expect(visitUrl(provider)).toBe(expected ?? provider.website_url);
    }
  });

  it('keeps future-provider referrals without activating those providers prematurely', () => {
    for (const id of ['neokens', 'claudexia', 'packyapi']) {
      expect(referralUrl(id)).not.toBeNull();
      expect(PROVIDERS_BY_ID.has(id)).toBe(false);
    }
  });
});
