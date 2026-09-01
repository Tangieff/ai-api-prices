import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePricingPage, teamorouterAdapter } from '@/adapters/teamorouter';

const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('TeamoRouter adapter', () => {
  it('registers with the html source kind', () => {
    expect(teamorouterAdapter.provider_id).toBe('teamorouter');
    expect(teamorouterAdapter.source_kind).toBe('html');
  });

  it('parses the price table with exact customer prices', () => {
    const offers = parsePricingPage(fixture('teamorouter-pricing.html'));
    const ids = offers.map((o) => o.provider_model_id);
    expect(ids).toContain('GPT-5.6 Sol');
    expect(ids).toContain('Claude Sonnet 5');
    expect(ids).toContain('DeepSeek V4 Pro');

    const sonnet = offers.find((o) => o.provider_model_id === 'Claude Sonnet 5');
    expect(sonnet?.input_usd_per_1m).toBe(0.5);
    expect(sonnet?.output_usd_per_1m).toBe(2.52);
    expect(sonnet?.source_url).toBe('https://teamorouter.com/pricing');
  });

  it('ingests only the actual customer price, never the struck-through reference or the % off badge', () => {
    const offers = parsePricingPage(fixture('teamorouter-pricing.html'));

    // GPT-5.6 Sol's markup carries BOTH a struck-through "List" reference
    // ($5.00 / $30.00) and a "90% off" badge next to the real charge. The
    // parsed offer must land on the $0.53/$3.18 TeamoRouter price, not the
    // $5.00/$30.00 reference, and must not surface the badge anywhere.
    const sol = offers.find((o) => o.provider_model_id === 'GPT-5.6 Sol');
    expect(sol).toBeDefined();
    expect(sol?.input_usd_per_1m).toBe(0.53);
    expect(sol?.output_usd_per_1m).toBe(3.18);
    expect(sol?.input_usd_per_1m).not.toBe(5);
    expect(sol?.output_usd_per_1m).not.toBe(30);
    expect(sol?.reference_input_usd_per_1m).toBeUndefined();
    expect(sol?.reference_output_usd_per_1m).toBeUndefined();

    // No offer anywhere in the parsed set carries a reference price — the
    // adapter must never populate that field, even when the source publishes
    // one right next to the real price.
    for (const offer of offers) {
      expect(offer.reference_input_usd_per_1m).toBeUndefined();
      expect(offer.reference_output_usd_per_1m).toBeUndefined();
    }
  });

  it('rejects a malformed row missing one of the two off/tr price pairs', () => {
    const offers = parsePricingPage(fixture('teamorouter-pricing.html'));
    // "Kimi K3 Broken" in the fixture has only 3 off/tr cells (one "off" cell
    // dropped) instead of the required off,off,tr,tr quartet.
    expect(offers.map((o) => o.provider_model_id)).not.toContain('Kimi K3 Broken');
  });

  it('rejects a row missing an actual price', () => {
    const offers = parsePricingPage(fixture('teamorouter-pricing.html'));
    // "Gemini 3.1 Pro (Preview) No Price" has an empty class="tr" input cell.
    expect(offers.map((o) => o.provider_model_id)).not.toContain(
      'Gemini 3.1 Pro (Preview) No Price',
    );
  });

  it('excludes non-text-token products', () => {
    const offers = parsePricingPage(fixture('teamorouter-pricing.html'));
    // "Whisper-1" is a transcription product; it must never enter the
    // per-1M-text-token comparison even though it has a well-formed price row.
    expect(offers.map((o) => o.provider_model_id)).not.toContain('Whisper-1');
  });

  it('throws when the price table markup is missing', () => {
    expect(() => parsePricingPage('<html><body>no pricing here</body></html>')).toThrow();
  });

  it('throws when the List/TeamoRouter column headers are gone (shape change)', () => {
    const html = `
      <table class="price-table">
        <thead><tr><th>Model</th><th>Price</th></tr></thead>
        <tbody>
          <tr><td class="model"><span class="ent-name">Claude Sonnet 5</span></td><td class="off">$3.00</td><td class="tr">$0.50</td></tr>
        </tbody>
      </table>`;
    expect(() => parsePricingPage(html)).toThrow();
  });

  it('throws when zero offers survive parsing', () => {
    const html = `
      <table class="price-table">
        <thead>
          <tr>
            <th>Input (List)</th><th>Output (List)</th>
            <th class="tr">Input (TeamoRouter)</th><th class="tr">Output (TeamoRouter)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="model"><span class="ent-name">Whisper-1</span></td>
            <td class="off">$0.006</td><td class="off">$0.006</td>
            <td class="tr">$0.006</td><td class="tr">$0.006</td>
          </tr>
        </tbody>
      </table>`;
    expect(() => parsePricingPage(html)).toThrow();
  });
});
