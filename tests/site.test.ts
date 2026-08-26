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
