import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePricingPage } from '@/adapters/gptproto';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('GPTProto adapter', () => {
  const offers = parsePricingPage(fixture('gptproto-model.html'));

  it('reads GPTProto\'s own live USD-per-1M price for each primary model card', () => {
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider_model_id: 'claude-opus-5',
          display_name: 'Claude Opus 5',
          input_usd_per_1m: 4.5,
          output_usd_per_1m: 22.5,
          source_url: 'https://gptproto.com/model/claude/claude-opus-5',
        }),
        expect.objectContaining({
          provider_model_id: 'gpt-5.6-sol',
          display_name: 'GPT 5.6 Sol',
          input_usd_per_1m: 4,
          output_usd_per_1m: 24,
          source_url: 'https://gptproto.com/model/openai/gpt-5.6-sol',
        }),
        expect.objectContaining({
          provider_model_id: 'gemini-3.1-pro-preview',
          display_name: 'Gemini 3.1 Pro Preview',
          input_usd_per_1m: 1.2,
          output_usd_per_1m: 7.2,
          source_url: 'https://gptproto.com/model/google/gemini-3.1-pro-preview',
        }),
      ]),
    );
  });

  it('never ingests GPTProto\'s own "official" price sentence or "% OFF" badge', () => {
    // The Sol card's description text explicitly claims a 20% discount off a
    // fabricated $5/$30 "official" price while GPTProto's real output rate
    // ($24) is above the real official rate ($20) -- proof the claim is
    // unreliable marketing copy, not a usable reference price.
    for (const offer of offers) {
      expect(offer.reference_input_usd_per_1m).toBeUndefined();
      expect(offer.reference_output_usd_per_1m).toBeUndefined();
    }
  });

  it('drops a row whose model link is malformed instead of throwing', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('claude-mystery-9');
  });

  it('rejects a row that is missing its output price', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain(
      'gpt-5.6-atlas-preview',
    );
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain(
      'text-embedding-3-small',
    );
  });

  it('rejects a non-text media route priced per unit instead of per token', () => {
    expect(offers.map((offer) => offer.provider_model_id)).not.toContain('seedream-5-0-260128');
  });

  it('produces exactly the priced, comparable rows the fixture supports', () => {
    expect(offers).toHaveLength(3);
  });

  it('fails closed when the page no longer contains any catalogue cards', () => {
    expect(() => parsePricingPage('<html><body>Not found</body></html>')).toThrow(
      /no model catalogue cards/i,
    );
  });

  it('fails closed when cards exist but none carry a usable USD-per-1M price pair', () => {
    const onlyMediaRow = fixture('gptproto-model.html')
      .split('\n')
      .filter((line) => line.includes('catalog-model-bytedance-seedream-5-0-260128'))
      .join('\n');
    expect(() => parsePricingPage(`<ul>${onlyMediaRow}</ul>`)).toThrow(
      /no comparable USD-per-1M-token model prices/i,
    );
  });
});
