/**
 * Tiny HTML helpers for the page-scraping adapters.
 *
 * A real DOM parser would be more robust, but two of the three scraped pages are
 * plain server-rendered tables and the third is a flat `<div>` grid. Regex over
 * the markup keeps the dependency list empty, and every adapter validates the
 * shape of what it extracted, so a page redesign fails loudly instead of
 * producing silent nonsense.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  minus: '−',
  ndash: '–',
  mdash: '—',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/** Strip tags and comments from an HTML fragment and collapse whitespace. */
export function textOf(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const withoutTags = withoutComments.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

/** All `<tr>` inner fragments in document order. */
export function tableRows(html: string): string[] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1] ?? '');
}

/** Cell texts of one `<tr>` fragment, `<td>` first and `<th>` as a fallback. */
export function rowCells(rowHtml: string): string[] {
  const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
  const source = cells.length > 0 ? cells : [...rowHtml.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)];
  return source.map((match) => textOf(match[1] ?? ''));
}

/**
 * Inner fragments of every `<div class="…name…">` block, matched by brace
 * counting on nested `<div>`s so a wrapper does not swallow its siblings.
 */
export function divsWithClass(html: string, className: string): string[] {
  const opener = new RegExp(`<div\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'gi');
  const results: string[] = [];
  for (const match of html.matchAll(opener)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let cursor = start;
    const scanner = /<div\b[^>]*>|<\/div>/gi;
    scanner.lastIndex = start;
    for (let token = scanner.exec(html); token; token = scanner.exec(html)) {
      depth += token[0].startsWith('</') ? -1 : 1;
      if (depth === 0) {
        cursor = token.index;
        break;
      }
    }
    results.push(html.slice(start, cursor));
  }
  return results;
}
