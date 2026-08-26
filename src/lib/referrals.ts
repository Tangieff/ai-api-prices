/**
 * Canonical AI API Prices referral destinations.
 *
 * Keep referral configuration separate from provider ingestion so links can be
 * recorded before a provider is integrated. Referral status must never affect
 * price collection, normalization, eligibility or ranking.
 */
export const REFERRAL_URLS = {
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
  'relay-fast': 'https://relay.fast/sign-up?aff=H9hI',
} as const;

export type ReferralProviderId = keyof typeof REFERRAL_URLS;

export function referralUrl(providerId: string): string | null {
  return REFERRAL_URLS[providerId as ReferralProviderId] ?? null;
}
