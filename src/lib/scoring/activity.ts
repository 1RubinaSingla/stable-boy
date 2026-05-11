import type { GMGNWalletActivityItem } from "../gmgn/types";
import type { ActivityHeatmap } from "./types";

const HEATMAP_WEEKS = 13; // ~3 months

function pickTimestamp(item: GMGNWalletActivityItem): number | null {
  // GMGN responses are inconsistent across versions; try the common keys.
  const v = item.timestamp ?? item.block_time ?? item.time ?? null;
  if (v === null) return null;
  // Some endpoints return seconds, some milliseconds. Treat <1e12 as seconds.
  const ms = v < 1e12 ? v * 1000 : v;
  return Number.isFinite(ms) ? ms : null;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Bucket activity items by day. Returns the most recent HEATMAP_WEEKS×7 grid
 * shape, plus the per-day counts. Days outside the window are dropped.
 */
export function buildHeatmap(items: GMGNWalletActivityItem[]): ActivityHeatmap {
  const days = HEATMAP_WEEKS * 7;
  const now = Date.now();
  const startMs = now - days * 86400 * 1000;

  const daily: Record<string, number> = {};
  let max = 0;

  for (const item of items) {
    const ms = pickTimestamp(item);
    if (ms === null || ms < startMs || ms > now) continue;
    const key = isoDate(ms);
    const next = (daily[key] ?? 0) + 1;
    daily[key] = next;
    if (next > max) max = next;
  }

  return {
    startDate: isoDate(startMs),
    weeks: HEATMAP_WEEKS,
    daily,
    max,
  };
}
