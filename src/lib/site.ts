/**
 * Site-level constants.
 *
 * The OXWeb link is configurable because the ecosystem site and this tracker
 * are meant to cross-link, and the destination is not fixed yet.
 */
export const SITE = {
  name: 'AI API Prices',
  tagline: 'A live AI inference price index for humans and agents',
  description:
    'Compare normalized AI API prices across a curated set of public inference providers. WebMCP lets AI agents search models, compare providers and calculate workload costs from the same data shown on the site.',
  url: 'https://ai-prices.oxweb.xyz',
  oxwebUrl: process.env.NEXT_PUBLIC_OXWEB_URL ?? 'https://oxweb.xyz',
} as const;
