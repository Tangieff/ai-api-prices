/**
 * Model search.
 *
 * Deliberately not a search service: the catalogue is a few hundred models, so
 * matching happens in the browser against a pre-built text blob per model.
 *
 * The one trick is normalisation. People type "gpt 5.6", "gpt-5.6" and
 * "gpt5.6" for the same thing, so both the query and the haystack collapse to
 * bare alphanumerics before comparison. That makes punctuation irrelevant while
 * keeping digits significant, so "opus 5" does not match "Opus 4.5".
 */

/** Lowercase and drop everything that is not a letter or digit. */
export function normalise(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Build the searchable text for one model. Joined with spaces so word-by-word
 * matching still works, and normalised once at build time rather than per
 * keystroke.
 */
export function buildSearchText(parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ').toLowerCase();
}

/**
 * Split text into comparable tokens.
 *
 * Separators are whitespace, hyphens, slashes and underscores — but *not* the
 * dot, so a version stays one token: "claude-opus-4.5" becomes
 * ["claude", "opus", "4.5"]. That distinction is what keeps "4.5" from being
 * read as a "4" next to a "5".
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_/,]+/)
    .map((token) => token.replace(/[^a-z0-9.]/g, '').replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

/**
 * Does `haystack` match `query`?
 *
 * Two ways to match:
 *
 *  1. The whole query, punctuation removed, appears as one run — this is what
 *     makes "gpt5.6sol", "gpt-5.6-sol" and "GPT 5.6 SOL" equivalent.
 *  2. For multi-word queries, every word hits a token. Word matching is
 *     asymmetric on purpose: a word is a *prefix* of some token ("opus" finds
 *     "opus"), but a word that starts with a digit must match a token
 *     *exactly*. Without that, "opus 5" would match "Claude Opus 4.5", because
 *     the "5" of "4.5" is a digit somewhere in the text.
 */
export function matches(haystack: string, query: string): boolean {
  const normalisedQuery = normalise(query);
  if (!normalisedQuery) return true;

  if (normalise(haystack).includes(normalisedQuery)) return true;

  const queryWords = tokenise(query);
  if (queryWords.length < 2) return false;

  const haystackTokens = tokenise(haystack);
  return queryWords.every((word) =>
    /^\d/.test(word)
      ? haystackTokens.includes(word)
      : haystackTokens.some((token) => token.startsWith(word)),
  );
}
