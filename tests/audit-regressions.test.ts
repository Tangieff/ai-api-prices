import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { generateMetadata } from '@/app/models/[id]/page';
import { canonicalModelId } from '@/lib/models';
import { loadDataset } from '@/lib/dataset';
import { buildPageData } from '@/lib/view';

/**
 * Regressions found by the pre-deploy audit of `main` at 54776c4.
 */

describe('model detail pages resolve every URL the site publishes', () => {
  /**
   * Next gives a *page* its dynamic segment percent-encoded (a route handler
   * gets it decoded). Model ids may contain characters `encodeURIComponent`
   * escapes, so before the fix every `…:web` model 404ed while still being
   * linked from the index and listed in the sitemap.
   */
  it('resolves a model id containing an escaped character', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: encodeURIComponent('glm-4.7-thinking:web') }),
    });
    // Either the model is in the current dataset and resolves, or it is absent
    // entirely — what must never happen is the encoded form failing while the
    // decoded one succeeds.
    const decoded = await generateMetadata({
      params: Promise.resolve({ id: 'glm-4.7-thinking:web' }),
    });
    expect(metadata.title).toBe(decoded.title);
  });

  it('resolves every model URL published in the sitemap', async () => {
    const entries = await sitemap();
    const modelUrls = entries
      .map((entry) => entry.url)
      .filter((url) => url.includes('/models/'));
    expect(modelUrls.length).toBeGreaterThan(0);

    const data = buildPageData(await loadDataset());
    const known = new Set(data.models.map((model) => model.id));

    const unresolved: string[] = [];
    for (const url of modelUrls) {
      const segment = url.slice(url.lastIndexOf('/models/') + '/models/'.length);
      // The page decodes the segment before looking the model up; anything the
      // sitemap advertises has to survive that round trip.
      if (!known.has(decodeURIComponent(segment))) unresolved.push(url);
    }
    expect(unresolved).toEqual([]);
  });

  it('treats a malformed escape sequence as not-found rather than an error', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: '%E0%A4%A' }) });
    expect(metadata.title).toBe('Model not found');
  });
});

describe('negated reasoning suffixes are peeled whole', () => {
  it('does not leave "non" behind on the model id', () => {
    expect(canonicalModelId('glm-5.1-non-thinking')).toEqual({
      id: 'glm-5.1',
      tier: 'non-thinking',
    });
  });

  it('groups the non-thinking variant with the base model', () => {
    expect(canonicalModelId('glm-5.1-non-thinking').id).toBe(canonicalModelId('glm-5.1').id);
    expect(canonicalModelId('glm-5.1-thinking').id).toBe(canonicalModelId('glm-5.1').id);
  });

  it('still distinguishes the plain thinking suffix', () => {
    expect(canonicalModelId('glm-5.1-thinking').tier).toBe('thinking');
    expect(canonicalModelId('glm-4.7-thinking').id).toBe('glm-4.7');
  });

  it('leaves no canonical id ending in a bare negation', async () => {
    const data = buildPageData(await loadDataset());
    const dangling = data.models.map((model) => model.id).filter((id) => /-(non|no)$/.test(id));
    expect(dangling).toEqual([]);
  });
});
