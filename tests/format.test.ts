import { describe, expect, it } from 'vitest';
import { formatPercent, pluralise, timeAgo, updatedLabel, utcStamp } from '@/app/components/format';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('timeAgo', () => {
  it('describes recent observations in the largest sensible unit', () => {
    expect(timeAgo(ago(5_000), NOW)).toBe('just now');
    expect(timeAgo(ago(3 * 60_000), NOW)).toBe('3 min ago');
    expect(timeAgo(ago(5 * 3_600_000), NOW)).toBe('5 h ago');
    expect(timeAgo(ago(3 * 86_400_000), NOW)).toBe('3 d ago');
    expect(timeAgo(ago(60 * 86_400_000), NOW)).toBe('2 mo ago');
  });

  it('never reports a negative age from clock skew', () => {
    expect(timeAgo(new Date(NOW + 60_000).toISOString(), NOW)).toBe('just now');
  });

  it('degrades gracefully on an unparseable timestamp', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('unknown');
  });
});

describe('updatedLabel', () => {
  it('shows an absolute date until the client clock is available', () => {
    // Rendered on the server and during hydration; must not depend on "now".
    expect(updatedLabel('2026-08-20T12:00:00.000Z', null)).toBe('2026-08-20');
  });

  it('switches to a relative label once mounted', () => {
    expect(updatedLabel(ago(3 * 60_000), NOW)).toBe('3 min ago');
  });
});

describe('utcStamp', () => {
  it('renders a readable UTC instant for the row tooltip', () => {
    expect(utcStamp('2026-08-20T17:41:09.123Z')).toBe('2026-08-20 17:41 UTC');
  });

  it('passes through a value it cannot parse', () => {
    expect(utcStamp('whenever')).toBe('whenever');
  });
});

describe('formatPercent', () => {
  it('keeps whole percentages compact and one decimal when needed', () => {
    expect(formatPercent(50)).toBe('50');
    expect(formatPercent(76.8)).toBe('76.8');
  });
});

describe('pluralise', () => {
  it('agrees with its count', () => {
    expect(pluralise(1, 'provider')).toBe('1 provider');
    expect(pluralise(0, 'provider')).toBe('0 providers');
    expect(pluralise(4, 'provider')).toBe('4 providers');
  });
});
