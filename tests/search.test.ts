import { describe, expect, it } from 'vitest';
import { buildSearchText, matches, normalise } from '@/lib/search';

const opus5 = buildSearchText(['Claude Opus 5', 'claude-opus-5', 'Anthropic', 'opus-5', 'opus']);
const opus45 = buildSearchText(['Claude Opus 4.5', 'claude-opus-4.5', 'Anthropic', 'opus-4.5']);
const gptSol = buildSearchText(['GPT-5.6 Sol', 'gpt-5.6-sol', 'OpenAI', 'gpt 5.6 sol']);
const sonnet = buildSearchText(['Claude Sonnet 4.6', 'claude-sonnet-4.6', 'Anthropic']);

describe('normalise', () => {
  it('reduces a query to bare alphanumerics', () => {
    expect(normalise('GPT-5.6 Sol')).toBe('gpt56sol');
    expect(normalise('  Opus 5 ')).toBe('opus5');
  });
});

describe('matches', () => {
  it('handles the queries the spec calls out', () => {
    expect(matches(opus5, 'opus 5')).toBe(true);
    expect(matches(opus5, 'claude opus')).toBe(true);
    expect(matches(sonnet, 'sonnet')).toBe(true);
    expect(matches(gptSol, 'gpt 5.6')).toBe(true);
    expect(matches(gptSol, 'gpt-5.6-sol')).toBe(true);
  });

  it('ignores punctuation and spacing differences', () => {
    for (const query of ['gpt5.6 sol', 'GPT 5.6 SOL', 'gpt-5.6 sol', 'gpt56sol']) {
      expect(matches(gptSol, query), query).toBe(true);
    }
  });

  it('keeps version digits significant', () => {
    // The whole point of normalising to alphanumerics is that "5" still means 5.
    expect(matches(opus45, 'opus 5')).toBe(false);
    expect(matches(opus5, 'opus 4.5')).toBe(false);
    expect(matches(gptSol, 'gpt 5.4')).toBe(false);
  });

  it('matches multi-word queries in any order', () => {
    expect(matches(opus5, 'anthropic opus')).toBe(true);
    expect(matches(opus5, 'opus anthropic')).toBe(true);
  });

  it('returns everything for an empty query and nothing for a miss', () => {
    expect(matches(opus5, '')).toBe(true);
    expect(matches(opus5, '   ')).toBe(true);
    expect(matches(opus5, 'llama')).toBe(false);
  });
});
