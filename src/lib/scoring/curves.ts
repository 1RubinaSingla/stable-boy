// Pure scoring curves. Each takes a normalized observation and returns 0–100.
// Tuned to the spec; documented in the README.

/**
 * Paperhand ratio = % of closed positions exited within 5 minutes of entry.
 * Tracks the spec curve: lower ratio = more diamond-handed = higher score.
 */
export function paperhandScore(ratio: number): number {
  if (ratio > 0.8) return 0;
  if (ratio > 0.6) return 15;
  if (ratio > 0.4) return 35;
  if (ratio > 0.2) return 60;
  if (ratio > 0.05) return 85;
  return 100;
}

export function holdDurationScore(seconds: number): number {
  if (seconds < 120) return 0;
  if (seconds < 600) return 20;
  if (seconds < 3600) return 40;
  if (seconds < 6 * 3600) return 60;
  if (seconds < 24 * 3600) return 75;
  if (seconds < 7 * 86400) return 88;
  return 100;
}

export function tokenDiversityScore(tokensPerDay: number, tokenNum: number): number {
  if (tokensPerDay > 20) return 15;
  if (tokensPerDay > 10) return 35;
  if (tokensPerDay > 3) return 65;
  if (tokensPerDay >= 1) return 85;
  if (tokenNum < 2) return 60;
  return 100;
}

export function walletAgeScore(ageDays: number): number {
  if (ageDays < 7) return 20;
  if (ageDays < 30) return 45;
  if (ageDays < 180) return 75;
  return 100;
}

/**
 * Distribution-aware win/loss scoring.
 * - Penalizes "too clean" (no losses, all wins) — insider tell
 * - Rewards a normal mixed distribution
 * - Penalizes pure-loss profile (chaser)
 */
export function winLossScore(buckets: {
  lt_n50: number;
  n50_0: number;
  x0_2: number;
  x2_5: number;
  gt_5: number;
}): number {
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  if (total < 5) return 60;

  const moonRate = buckets.gt_5 / total;
  const lossRate = (buckets.lt_n50 + buckets.n50_0) / total;
  const midWinRate = buckets.x0_2 / total;

  // Insider tell: lots of moonshots, few losses
  if (moonRate > 0.10 && lossRate < 0.20) return 20;

  // Pure chaser: heavy losses, no upside
  if (lossRate > 0.85 && moonRate < 0.005) return 30;

  // Healthy human distribution
  if (lossRate > 0.30 && lossRate < 0.75 && midWinRate > 0.15) return 100;

  return 60;
}

/**
 * Crude PnL behavior proxy from buy/sell counts.
 * Many more sells than buys suggests high turnover with partial exits OR
 * many airdrop dumps. Many more buys than sells suggests accumulation.
 * Real "full-dump ratio" needs wallet_activity (v2).
 */
export function pnlBehaviorScore(buy: number, sell: number): number {
  if (buy + sell < 10) return 60;
  const ratio = sell / Math.max(buy, 1);
  if (ratio > 3) return 30; // dump-heavy
  if (ratio > 1.5) return 55;
  if (ratio > 0.7) return 80;
  return 70; // accumulator-leaning
}

type FunderKind = "cex" | "protocol" | "fund" | "kol" | "other" | "unknown";

/**
 * Funding-source classification using Helius entity labels + chain depth.
 *   100  direct from a labeled CEX (Coinbase / Binance / etc.)
 *    85  1 hop from a labeled CEX (clean intermediate)
 *    75  direct from a labeled fund / protocol
 *    60  3+ hops to a CEX, no daisy-chain pattern
 *    50  no funder data at all
 *    35  very small initial funding (<0.5 SOL) — automation tell
 *    25  daisy-chain detected (3+ fresh-wallet intermediates)
 *     0  direct from a wallet flagged in our bundler list
 */
export function fundingSourceScore(input: {
  hasFunder: boolean;
  fundAmountSol?: number;
  immediateFunderKind: FunderKind;
  hopsToCex: number | null;
  isDaisyChain: boolean;
  immediateFunderFlagged: boolean;
}): { score: number; note: string } {
  if (input.immediateFunderFlagged) {
    return { score: 0, note: "immediate funder flagged in bundler registry" };
  }

  if (!input.hasFunder) {
    return { score: 50, note: "no funder recorded" };
  }

  if (input.isDaisyChain) {
    return { score: 25, note: "daisy-chain — 3+ fresh-wallet intermediates" };
  }

  if (input.immediateFunderKind === "cex") {
    return { score: 100, note: "direct from labeled CEX" };
  }

  if (input.immediateFunderKind === "fund" || input.immediateFunderKind === "protocol") {
    return { score: 75, note: `direct from labeled ${input.immediateFunderKind}` };
  }

  if (input.hopsToCex !== null) {
    if (input.hopsToCex === 1) return { score: 85, note: "1 hop from labeled CEX" };
    if (input.hopsToCex === 2) return { score: 70, note: "2 hops from labeled CEX" };
    return { score: 60, note: `${input.hopsToCex}+ hops to labeled CEX` };
  }

  if (input.fundAmountSol !== undefined && input.fundAmountSol < 0.5) {
    return { score: 35, note: "small initial funding (<0.5 SOL)" };
  }

  return { score: 60, note: "funded by an unlabeled wallet" };
}

/**
 * SOL balance consistency proxy. Without a time series (v2 work), use the
 * snapshot vs activity ratio: a wallet with a meaningful idle SOL balance
 * AND high transaction count is more likely to be holding intentionally.
 */
export function solBalanceScore(nativeBalanceSol: number, totalTrades: number): number {
  if (totalTrades < 10) return 50;
  if (nativeBalanceSol > 5) return 90;
  if (nativeBalanceSol > 1) return 70;
  if (nativeBalanceSol > 0.1) return 50;
  return 25;
}
