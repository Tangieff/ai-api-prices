import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FOREGROUND_REFRESH_THROTTLE_MS,
  LIVE_DATA_REFRESH_INTERVAL_MS,
  shouldRefresh,
} from '@/lib/freshness';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('live data refresh throttling', () => {
  it('uses the same five-minute cadence as the backend refresh', () => {
    expect(LIVE_DATA_REFRESH_INTERVAL_MS).toBe(300_000);
    expect(shouldRefresh(1_000, 300_999, LIVE_DATA_REFRESH_INTERVAL_MS)).toBe(false);
    expect(shouldRefresh(1_000, 301_000, LIVE_DATA_REFRESH_INTERVAL_MS)).toBe(true);
  });

  it('bounds repeated foreground refreshes and recovers from a clock adjustment', () => {
    expect(FOREGROUND_REFRESH_THROTTLE_MS).toBe(60_000);
    expect(shouldRefresh(10_000, 69_999, FOREGROUND_REFRESH_THROTTLE_MS)).toBe(false);
    expect(shouldRefresh(10_000, 70_000, FOREGROUND_REFRESH_THROTTLE_MS)).toBe(true);
    expect(shouldRefresh(10_000, 9_000, FOREGROUND_REFRESH_THROTTLE_MS)).toBe(true);
  });

  it('keeps live price documents dynamic and wires clean interval/restore refreshes', () => {
    expect(read('src/app/page.tsx')).toContain("export const dynamic = 'force-dynamic'");
    expect(read('src/app/models/[id]/page.tsx')).toContain(
      "export const dynamic = 'force-dynamic'",
    );

    const controller = read('src/app/components/LiveDataRefresh.tsx');
    expect(controller).toContain('router.refresh()');
    expect(controller).toContain("document.addEventListener('visibilitychange'");
    expect(controller).toContain("window.addEventListener('pageshow'");
    expect(controller).toContain('window.setInterval');
    expect(controller).toContain('window.setTimeout(() => refresh(0), 0)');
    expect(controller).not.toContain('location.reload');
  });
});
