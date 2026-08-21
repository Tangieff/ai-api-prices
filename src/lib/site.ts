/**
 * Site-level constants.
 *
 * The OXWeb link is configurable because the ecosystem site and this tracker
 * are meant to cross-link, and the destination is not fixed yet.
 */
export const SITE = {
  name: 'OXWeb Prices',
  tagline: 'Compare AI inference prices across discount providers',
  description:
    'Search an AI model and compare what discount inference providers currently charge per million tokens. Published prices only, refreshed from each provider’s public pricing source.',
  url: 'https://prices.oxweb.xyz',
  oxwebUrl: process.env.NEXT_PUBLIC_OXWEB_URL ?? 'https://oxweb.xyz',
} as const;
