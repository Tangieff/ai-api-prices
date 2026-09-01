import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePricingPage } from '@/adapters/ohmygpt';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('OhMyGPT adapter', () => {
  it('parses USD-priced text token models from the server-rendered model cards', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));

    expect(offers).toHaveLength(10);
    expect(offers.map((o) => o.provider_model_id).sort()).toEqual(
      [
        'alibaba:zhipu/glm-5.2',
        'claude-fable-5',
        'claude-opus-5',
        'claude-sonnet-5',
        'fireworks/deepseek-v4-pro',
        'gemini-3.1-pro-preview',
        'gpt-5.6-luna',
        'gpt-5.6-sol',
        'gpt-5.6-terra',
        'grok-4.6',
      ].sort(),
    );
  });

  it('reads exact input/output USD-per-1M prices for the primary frontier models', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));
    const byId = Object.fromEntries(offers.map((o) => [o.provider_model_id, o]));

    expect(byId['claude-fable-5']).toMatchObject({
      input_usd_per_1m: 11,
      output_usd_per_1m: 55,
    });
    expect(byId['claude-opus-5']).toMatchObject({
      input_usd_per_1m: 5.5,
      output_usd_per_1m: 27.5,
    });
    expect(byId['claude-sonnet-5']).toMatchObject({
      input_usd_per_1m: 2.2,
      output_usd_per_1m: 11,
    });
    expect(byId['gpt-5.6-sol']).toMatchObject({
      input_usd_per_1m: 4.4,
      output_usd_per_1m: 22,
    });
    expect(byId['grok-4.6']).toMatchObject({
      input_usd_per_1m: 2.2,
      output_usd_per_1m: 6.6,
    });
    expect(byId['gpt-5.6-terra']).toMatchObject({
      input_usd_per_1m: 2.2,
      output_usd_per_1m: 13.2,
    });
    expect(byId['gpt-5.6-luna']).toMatchObject({
      input_usd_per_1m: 0.22,
      output_usd_per_1m: 1.32,
    });
    expect(byId['fireworks/deepseek-v4-pro']).toMatchObject({
      input_usd_per_1m: 1.74,
      output_usd_per_1m: 3.48,
    });
  });

  it('reads the sale price shown behind a promotional discount badge, without ingesting a reference/list price', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));
    const byId = Object.fromEntries(offers.map((o) => [o.provider_model_id, o]));

    // gemini-3.1-pro-preview and alibaba:zhipu/glm-5.2 both carry a "-X%"
    // badge in the same tabular-nums price div. The adapter must read only
    // the two real price spans and must never invent a reference price from
    // the badge, since OhMyGPT does not publish an official/list price here.
    expect(byId['gemini-3.1-pro-preview']).toMatchObject({
      input_usd_per_1m: 1.8,
      output_usd_per_1m: 10.8,
    });
    expect(byId['gemini-3.1-pro-preview']?.reference_input_usd_per_1m).toBeUndefined();
    expect(byId['gemini-3.1-pro-preview']?.reference_output_usd_per_1m).toBeUndefined();

    expect(byId['alibaba:zhipu/glm-5.2']).toMatchObject({
      input_usd_per_1m: 0.66,
      output_usd_per_1m: 2.3106,
    });
    expect(byId['alibaba:zhipu/glm-5.2']?.reference_input_usd_per_1m).toBeUndefined();
    expect(byId['alibaba:zhipu/glm-5.2']?.reference_output_usd_per_1m).toBeUndefined();

    for (const offer of offers) {
      expect(offer.reference_input_usd_per_1m).toBeUndefined();
      expect(offer.reference_output_usd_per_1m).toBeUndefined();
    }
  });

  it('never converts CNY-priced cards into USD offers', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));
    const ids = offers.map((o) => o.provider_model_id);

    // tencent/glm-5.3 (¥7.20/¥25.20) and the bare deepseek-v4-pro (¥4.50/¥13.50)
    // are only published in CNY on this page and must be skipped rather than
    // converted with an invented exchange rate.
    expect(ids).not.toContain('tencent/glm-5.3');
    expect(ids).not.toContain('deepseek-v4-pro');
  });

  it('rejects a non-text product even when it carries a dash placeholder price', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));
    expect(offers.map((o) => o.provider_model_id)).not.toContain('omni-moderation-latest');
  });

  it('rejects a card with no numeric price ("Free")', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));
    expect(offers.map((o) => o.provider_model_id)).not.toContain('glm-4.7-flash');
  });

  it('rejects a malformed card with no price block at all', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));
    expect(offers.map((o) => o.provider_model_id)).not.toContain('mystery-model');
  });

  /**
   * Two USD routes to DeepSeek V4 Pro at different prices both canonicalise to
   * `deepseek-v4-pro`, so without the route as a tier the dedupe key collides
   * and one real, buyable price disappears from the table.
   */
  it('keeps the upstream route as a tier and deep-links each card', () => {
    const offers = parsePricingPage(fixture('ohmygpt-models.html'));
    const byId = new Map(offers.map((offer) => [offer.provider_model_id, offer]));

    expect(byId.get('alibaba:zhipu/glm-5.2')?.tier).toBe('alibaba:zhipu');
    expect(byId.get('fireworks/deepseek-v4-pro')?.tier).toBe('fireworks');
    expect(byId.get('claude-opus-5')?.tier).toBeNull();
    expect(byId.get('alibaba:zhipu/glm-5.2')?.source_url).toBe(
      'https://www.ohmygpt.com/models/alibaba%3Azhipu%2Fglm-5.2',
    );
  });

  it('throws when the page has no model cards at all (shape change)', () => {
    expect(() => parsePricingPage('<html><body>no cards here</body></html>')).toThrow(
      /no model cards/i,
    );
  });

  it('throws when every card is unpriced, non-USD, or non-text (zero offers)', () => {
    const html = `<article><a href="/models/glm-5.3">GLM-5.3</a><div class="flex items-baseline gap-2 text-sm mb-2"><span class="tabular-nums">¥7.20</span><span class="tabular-nums">¥25.20</span></div></article>`;
    expect(() => parsePricingPage(html)).toThrow(/no USD-priced text token models/i);
  });
});
