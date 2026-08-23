import { describe, expect, it } from 'vitest';
import { PROVIDERS_BY_ID, visitUrl } from '@/lib/providers';

describe('provider affiliate destinations', () => {
  const expected = new Map([
    ['surplus-intelligence', 'https://www.surplusintelligence.ai/?ref=avraam'],
    ['derouter', 'https://derouter.ai?ref=mZxRdS1y'],
    ['worldgate', 'https://worldgateapi.com/register?ref=WG-8FDD9C91C9&redirect=%2Freferral'],
    ['getgoapi', 'https://api.getgoapi.com/register?aff=i3VT'],
    ['boundlessapi', 'https://oneapi.boundlessapi.com/register?aff=311A'],
    ['llmsrelay', 'https://llmsrelay.com/auth?mode=signup&lang=ru&ref=BDF0002E42C7'],
  ]);

  it('resolves each configured A-group provider to the supplied referral URL', () => {
    for (const [id, url] of expected) {
      const provider = PROVIDERS_BY_ID.get(id);
      expect(provider).toBeDefined();
      expect(visitUrl(provider!)).toBe(url);
    }
  });

  it('keeps the normal website fallback for providers without an affiliate deal', () => {
    const clawhive = PROVIDERS_BY_ID.get('clawhive');
    expect(clawhive).toBeDefined();
    expect(visitUrl(clawhive!)).toBe(clawhive!.website_url);
  });
});
