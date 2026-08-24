'use client';

import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FOREGROUND_REFRESH_THROTTLE_MS,
  LIVE_DATA_REFRESH_INTERVAL_MS,
  shouldRefresh,
} from '@/lib/freshness';

/** Refreshes the current RSC payload without replacing client state or scroll. */
export function LiveDataRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefreshAt = Date.now();
    let pageShowTimer: number | null = null;

    const refresh = (minimumAge: number) => {
      const now = Date.now();
      if (!shouldRefresh(lastRefreshAt, now, minimumAge)) return;
      lastRefreshAt = now;
      startTransition(() => router.refresh());
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh(LIVE_DATA_REFRESH_INTERVAL_MS);
      }
    }, LIVE_DATA_REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh(FOREGROUND_REFRESH_THROTTLE_MS);
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // Let Next finish restoring its own history/router state first. Refreshing
      // synchronously inside `pageshow` can fetch the new RSC payload and then
      // have that payload overwritten by the framework's BFCache restoration.
      if (pageShowTimer !== null) window.clearTimeout(pageShowTimer);
      pageShowTimer = window.setTimeout(() => refresh(0), 0);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.clearInterval(interval);
      if (pageShowTimer !== null) window.clearTimeout(pageShowTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [router]);

  return null;
}
