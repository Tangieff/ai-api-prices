'use client';

import { useSyncExternalStore } from 'react';

/**
 * The wall clock, as an external store.
 *
 * "Updated 3 min ago" cannot be rendered on the server — the HTML is generated
 * once and the label would freeze at build time. `useSyncExternalStore` is the
 * right shape for this: it returns `null` on the server and during hydration
 * (so both renders match exactly), then the real time once mounted.
 *
 * The snapshot is bucketed to the minute so repeated renders inside the same
 * minute return an identical value — `useSyncExternalStore` compares snapshots
 * by identity and would re-render forever against a raw `Date.now()`.
 */

const TICK_MS = 60_000;

function subscribe(onStoreChange: () => void): () => void {
  const timer = setInterval(onStoreChange, TICK_MS);
  return () => clearInterval(timer);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

function getServerSnapshot(): null {
  return null;
}

export function useClock(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
