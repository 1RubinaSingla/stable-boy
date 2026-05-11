import type { NormalizedActivity } from "./activity-shape";

const ROUND_TRIP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const SUSPICIOUS_TOKEN_THRESHOLD = 3; // wash flag fires at 3+ tokens with round-trips

export interface WashTradeResult {
  flagged: boolean;
  roundTrips: number;
  suspiciousTokens: number;
  evidence: Array<{ mint: string; roundTrips: number }>;
}

/**
 * Heuristic round-trip detector.
 *
 * For each token, walks the wallet's events chronologically. A "round trip"
 * is an opposite-side trade following the previous one within ROUND_TRIP_WINDOW.
 * Tokens with 2+ round trips are "suspicious." If 3+ tokens look suspicious,
 * the wallet gets the wash-trade flag.
 *
 * Limitation: this catches W trading the same token back and forth quickly.
 * It does NOT catch true cross-wallet wash trades where W's other wallet is
 * the counterparty. Implementing that needs a tx-level counterparty query
 * against Bitquery — flagged as v3.
 */
export function detectWashTrades(rows: NormalizedActivity[]): WashTradeResult {
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

  let totalRoundTrips = 0;
  const evidence: WashTradeResult["evidence"] = [];

  for (const [mint, trades] of byMint) {
    if (trades.length < 2) continue;
    let tokenRoundTrips = 0;
    for (let i = 1; i < trades.length; i++) {
      const prev = trades[i - 1];
      const cur = trades[i];
      if (prev.side === cur.side) continue;
      const gap = cur.timestampMs - prev.timestampMs;
      if (gap >= 0 && gap < ROUND_TRIP_WINDOW_MS) {
        tokenRoundTrips += 1;
      }
    }
    if (tokenRoundTrips >= 2) {
      evidence.push({ mint, roundTrips: tokenRoundTrips });
      totalRoundTrips += tokenRoundTrips;
    }
  }

  return {
    flagged: evidence.length >= SUSPICIOUS_TOKEN_THRESHOLD,
    roundTrips: totalRoundTrips,
    suspiciousTokens: evidence.length,
    evidence: evidence
      .sort((a, b) => b.roundTrips - a.roundTrips)
      .slice(0, 5),
  };
}
