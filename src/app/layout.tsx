import type { Metadata, Viewport } from 'next';
import { Instrument_Sans } from 'next/font/google';
import { SITE } from '@/lib/site';
import './globals.css';

/**
 * Typography.
 *
 * Instrument Sans carries the whole interface — headings, body, figures and
 * metadata alike. It is a working grotesque, not a marketing face, which is
 * what this product is: a price index someone reads to make a purchasing
 * decision.
 *
 * Figures are not set in a second, monospaced face. Instrument Sans ships
 * tabular numerals, so `font-variant-numeric: tabular-nums` gives every digit
 * the same advance width and a column of prices still reads as a column — the
 * alignment the table needs, without a change of typeface to announce it.
 *
 * next/font self-hosts it at build time, so there is no third-party request at
 * runtime and no layout shift beyond the declared fallback metrics.
 */
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-sans',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: {
    card: 'summary',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body>{children}</body>
    </html>
  );
}
