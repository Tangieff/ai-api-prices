import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE } from '@/lib/site';

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

describe('public site identity', () => {
  it('pins the renamed product and canonical URL', () => {
    expect(SITE.name).toBe('AI API Prices');
    expect(SITE.url).toBe('https://ai-prices.oxweb.xyz');
    expect(SITE.tagline).toBe('A live AI inference price index for humans and agents');
    expect(SITE.description).toBe(
      'Compare normalized AI API prices across a curated set of public inference providers. WebMCP lets AI agents search models, compare providers and calculate workload costs from the same data shown on the site.',
    );
  });

  it('presents the homepage as a human and agent utility without adding another mode', () => {
    const explorer = read('src/app/components/PriceExplorer.tsx').replace(/\s+/g, ' ');

    expect(explorer).toContain('For humans and AI agents');
    expect(explorer).toContain('Compare the AI inference market or let your agent do it');
    expect(explorer).toContain(
      'Fresh, normalized pricing across a curated set of public AI inference providers.',
    );
    expect(explorer).toContain('Through WebMCP, AI agents can search models, compare providers');
    expect(explorer).toContain('WebMCP enabled');
    expect(explorer).toContain(
      'Ask your agent: Compare Claude Opus 5 and GPT-5.6 Sol for 50M input + 10M output tokens.',
    );
    expect(explorer).not.toContain("'verification'");
  });

  it('publishes the new product identity to machine readers', () => {
    const llms = read('public/llms.txt');

    expect(llms).toContain('# AI API Prices');
    expect(llms).toContain('Canonical site: https://ai-prices.oxweb.xyz/');
    expect(llms).not.toContain('https://prices.oxweb.xyz');
  });

  it('carries the product monogram, not the old house mark, in the app icon', () => {
    const icon = read('src/app/icon.svg');

    expect(icon).toContain('>AI<');
    expect(icon).not.toContain('>OX<');
  });
});
