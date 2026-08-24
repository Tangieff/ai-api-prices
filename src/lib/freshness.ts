export const LIVE_DATA_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
export const FOREGROUND_REFRESH_THROTTLE_MS = 60 * 1000;

export function shouldRefresh(lastRefreshAt: number, now: number, minimumAge: number): boolean {
  return now < lastRefreshAt || now - lastRefreshAt >= minimumAge;
}
