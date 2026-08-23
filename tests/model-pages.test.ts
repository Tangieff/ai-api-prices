import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { generateMetadata } from '@/app/models/[id]/page';

describe('model discovery pages', () => {
  it('builds model-specific metadata from the normalized dataset', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'claude-opus-5' }) });

    expect(metadata.title).toBe('Claude Opus 5 API prices');
    expect(metadata.description).toContain('Claude Opus 5 API prices');
    expect(metadata.alternates).toEqual({ canonical: '/models/claude-opus-5' });
  });

  it('returns a not-found title for an unknown model', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'definitely-not-a-model' }) });
    expect(metadata.title).toBe('Model not found');
  });

  it('publishes the homepage and current model detail URLs in the sitemap', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls[0]).toBe('https://prices.oxweb.xyz/');
    expect(urls).toContain('https://prices.oxweb.xyz/models/claude-opus-5');
    expect(urls.length).toBeGreaterThan(100);
  });
});
