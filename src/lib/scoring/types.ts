export type Verdict =
  | "diamond"
  | "active"
  | "degen"
  | "bundler"
  | "insufficient_data";

export type FactorKey =
  | "hold_duration"
  | "win_loss_distribution"
  | "token_diversity"
  | "wallet_age"
  | "funding_source"
  | "pnl_behavior"
  | "paperhand_ratio"
  | "sol_balance_consistency";

export type PenaltyKey =
  | "bundle_co_buy"
  | "cluster_one_hop"
  | "cluster_two_hop"
  | "sniper_window"
  | "funding_daisy_chain"
  | "wash_trade"
  | "dormant_coordinated";

export interface ScoredFactor {
  key: FactorKey;
  label: string;
  value: string; // human-readable observed value
  subScore: number; // 0–100
  weight: number; // 0–22
  contribution: number; // weighted contribution to layer 1
  status: "computed" | "skipped";
  note?: string;
}

export interface AppliedPenalty {
  key: PenaltyKey;
  label: string;
  amount: number; // negative number
  evidence?: string;
}

export type ProfilePeriod = "1d" | "7d" | "30d";

export interface PeriodStats {
  realizedPnlUsd: number;
  totalRevenueUsd: number;
  totalSpentUsd: number;
}

export interface WalletProfile {
  // Per-period flow stats (revenue/spent/realized PnL change with the window)
  periods: Record<ProfilePeriod, PeriodStats>;
  // Current-state stats (same regardless of period)
  unrealizedPnlUsd: number | null; // null if holdings fetch failed
  nativeBalanceSol: number;
}

export interface ActivityHeatmap {
  /** ISO date strings (YYYY-MM-DD) for the OLDEST cell, in chronological order. */
  startDate: string;
  /** Number of weeks (columns). */
  weeks: number;
  /**
   * Day-keyed counts. Key: YYYY-MM-DD, value: tx count for that day.
   * Days with zero activity are omitted; renderer fills with zeros.
   */
  daily: Record<string, number>;
  /** Max single-day count, used by the renderer to compute color buckets. */
  max: number;
}

export interface FunderHopReceipt {
  wallet: string;
  funderAddress: string | null;
  fundAmountSol: number | null;
  walletCreatedAt: number | null;
  fundTimestamp: number | null;
  entityKind: "cex" | "protocol" | "fund" | "kol" | "other" | "unknown";
  entityName: string | null;
  flagged: boolean;
}

export interface Receipt {
  walletAddress: string;
  scoredAt: string; // ISO
  finalScore: number;
  verdict: Verdict;
  layer1Score: number;
  layer2Penalty: number; // negative or 0
  factors: ScoredFactor[];
  penalties: AppliedPenalty[];
  profile?: WalletProfile;
  funderChain?: FunderHopReceipt[];
  activity?: ActivityHeatmap;
  meta: {
    period: "30d";
    source: { gmgn: boolean; bitquery: boolean; helius: boolean };
    notes: string[];
  };
}
