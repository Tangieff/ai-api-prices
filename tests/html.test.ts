import { describe, expect, it } from 'vitest';
import { decodeEntities, divsWithClass, rowCells, tableRows, textOf } from '@/lib/html';

/**
 * The scraping helpers are the fragile part of the ingest path, so the awkward
 * shapes the real provider pages contain are pinned here.
 */

describe('decodeEntities', () => {
  it('decodes the entities the provider pages actually emit', () => {
    expect(decodeEntities('$10&nbsp;/&nbsp;$50')).toBe('$10 / $50');
    expect(decodeEntities('&minus;77%')).toBe('−77%');
    expect(decodeEntities('A&amp;B &lt;x&gt;')).toBe('A&B <x>');
    expect(decodeEntities('&#36;5 &#x24;6')).toBe('$5 $6');
  });

  it('leaves unknown entities untouched rather than mangling them', () => {
    expect(decodeEntities('&notanentity;')).toBe('&notanentity;');
  });
});

describe('textOf', () => {
  it('strips tags and collapses whitespace', () => {
    expect(textOf('<span>  Claude   Opus\n4.5 </span>')).toBe('Claude Opus 4.5');
  });

  it('drops HTML comments, which React injects between text nodes', () => {
    // derouter renders "−<!-- -->77<!-- -->%" for its savings cell. Comments
    // are removed before tags, so the number is not split by stray spaces.
    expect(textOf('<span>&minus;<!-- -->77<!-- -->%</span>')).toBe('−77%');
  });
});

describe('tableRows / rowCells', () => {
  const table = `
    <table><thead><tr><th>Model</th><th>Input</th></tr></thead>
    <tbody>
      <tr><td><span>Claude Opus 4.8</span></td><td>$1.16</td></tr>
      <tr><td>Claude Sonnet 5</td><td>$0.46</td></tr>
    </tbody></table>`;

  it('returns every row in document order', () => {
    expect(tableRows(table)).toHaveLength(3);
  });

  it('reads td cells, falling back to th for the header row', () => {
    const rows = tableRows(table);
    expect(rowCells(rows[0]!)).toEqual(['Model', 'Input']);
    expect(rowCells(rows[1]!)).toEqual(['Claude Opus 4.8', '$1.16']);
  });

  it('handles attributes and multi-line markup', () => {
    const row = '<tr class="x" data-y="1">\n<td\nclass="a">Foo</td>\n<td>Bar</td>\n</tr>';
    expect(rowCells(tableRows(row)[0]!)).toEqual(['Foo', 'Bar']);
  });
});

describe('divsWithClass', () => {
  it('extracts each block without swallowing its siblings', () => {
    const html = `
      <div class="price-row header"><div>Model</div></div>
      <div class="price-row"><div class="model-name">Haiku</div><div class="new-price">$0.50</div></div>
      <div class="price-row"><div class="model-name">Sonnet</div><div class="new-price">$1.50</div></div>`;
    const rows = divsWithClass(html, 'price-row');
    expect(rows).toHaveLength(3);
    expect(textOf(divsWithClass(rows[1]!, 'model-name')[0]!)).toBe('Haiku');
    expect(textOf(divsWithClass(rows[2]!, 'new-price')[0]!)).toBe('$1.50');
  });

  it('counts nested divs so a wrapper stops at its own close tag', () => {
    const html =
      '<div class="row"><div class="inner"><div>deep</div></div></div><div class="row">second</div>';
    const rows = divsWithClass(html, 'row');
    expect(rows).toHaveLength(2);
    expect(textOf(rows[0]!)).toBe('deep');
    expect(textOf(rows[1]!)).toBe('second');
  });

  it('matches a class among several and ignores partial names', () => {
    const html = '<div class="a price-row b">yes</div><div class="price-rows">no</div>';
    const rows = divsWithClass(html, 'price-row');
    expect(rows).toHaveLength(1);
    expect(textOf(rows[0]!)).toBe('yes');
  });

  it('returns nothing when the class is absent', () => {
    expect(divsWithClass('<div class="other">x</div>', 'price-row')).toEqual([]);
  });
});
