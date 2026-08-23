/** Presentation helpers shared by the server page and the client explorer. */

/** "3 minutes ago", "2 days ago" — relative to now, computed on the client to stay honest. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'unknown';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return `${Math.round(days / 30)} mo ago`;
}

/** Short absolute UTC stamp for tooltips: "2026-08-20 17:41 UTC". */
export function utcStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * Label for the "Updated" column.
 *
 * Relative times cannot be rendered on the server: the HTML is generated once
 * and "3 min ago" would be frozen at build time. Until the client reports a
 * clock (`now === null`), the absolute UTC date is shown instead — stable,
 * identical on both sides of hydration, and never wrong.
 */
export function updatedLabel(iso: string, now: number | null): string {
  if (now === null) return iso.slice(0, 10);
  return timeAgo(iso, now);
}

export function formatPercent(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
