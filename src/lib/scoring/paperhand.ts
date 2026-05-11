import type { NormalizedActivity } from "./activity-shape";

const PAPERHAND_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MIN_PAIRS_REQUIRED = 3;

export interface PaperhandResult {
  /** Fraction in [0, 1], or null if not enough pairs to compute. */
  ratio: number | null;
  paperhandPairs: number;
  totalPairs: number;
  tokensExamined: number;
  fastestExitSeconds: number | null;
}

/**
 * Pair entries to exits per token using FIFO, then count what fraction of
 * closed positions exited within 5 minutes of entry.
 *
 * Algorithm:
 *   - Group normalized activity by mint
 *   - For each mint, sort chronologically (already done by normalize)
 *   - Walk events: each 'buy' is pushed to a FIFO queue of open entries;
 *     each 'sell' pops the oldest entry and forms a pair
 *   - For each pair, hold_duration = sell_ts - buy_ts
 *   - Paperhand if hold_duration < 5 min
 *
 * Returns null ratio when fewer than MIN_PAIRS_REQUIRED pairs found across
 * all tokens — the caller treats that as "not enough data" and the curve
 * falls back to the neutral score.
 */
export function computePaperhand(rows: NormalizedActivity[]): PaperhandResult {
  const byMint = new Map<string, NormalizedActivity[]>();
  for (const r of rows) {
    if (r.side === "unknown") continue;
    let list = byMint.get(r.mint);
    if (!list) {
      list = [];
      byMint.set(r.mint, list);
    }
    list.push(r);
  }

  let totalPairs = 0;
  let paperhandPairs = 0;
  let fastestMs: number | null = null;
  let tokensWithPairs = 0;

  for (const [, trades] of byMint) {
    const openBuys: number[] = []; // timestamps in ms
    let hadPair = false;
    for (const t of trades) {
      if (t.side === "buy") {
        openBuys.push(t.timestampMs);
      } else if (t.side === "sell") {
        const entry = openBuys.shift();
        if (entry === undefined) continue; // sell with no prior buy → drop
        const holdMs = t.timestampMs - entry;
        if (holdMs < 0) continue; // chronology weirdness, skip
        totalPairs += 1;
        hadPair = true;
        if (holdMs < PAPERHAND_THRESHOLD_MS) paperhandPairs += 1;
        if (fastestMs === null || holdMs < fastestMs) fastestMs = holdMs;
      }
    }
    if (hadPair) tokensWithPairs += 1;
  }

  if (totalPairs < MIN_PAIRS_REQUIRED) {
    return {
      ratio: null,
      paperhandPairs,
      totalPairs,
      tokensExamined: tokensWithPairs,
      fastestExitSeconds: fastestMs !== null ? Math.round(fastestMs / 1000) : null,
    };
  }

  return {
    ratio: paperhandPairs / totalPairs,
    paperhandPairs,
    totalPairs,
    tokensExamined: tokensWithPairs,
    fastestExitSeconds: fastestMs !== null ? Math.round(fastestMs / 1000) : null,
  };
}
