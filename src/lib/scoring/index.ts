import type {
  GMGNWalletActivityItem,
  GMGNWalletHolding,
  GMGNWalletStats,
} from "../gmgn/types";
import { buildHeatmap } from "./activity";
import { normalizeActivity } from "./activity-shape";
import { computePaperhand } from "./paperhand";
import { detectWashTrades } from "./wash-trade";
import {
  fundingSourceScore,
  holdDurationScore,
  paperhandScore,
  pnlBehaviorScore,
  solBalanceScore,
  tokenDiversityScore,
  walletAgeScore,
  winLossScore,
} from "./curves";
import type { FunderHop } from "./funder-trace";
import { isDaisyChain } from "./funder-trace";
import type {
  AppliedPenalty,
  FunderHopReceipt,
  PeriodStats,
  ProfilePeriod,
  Receipt,
  ScoredFactor,
  WalletProfile,
} from "./types";
import {
  BUNDLE_PENALTY_CAP,
  PENALTY_AMOUNTS,
  PENALTY_CAP,
  SNIPER_PENALTY_CAP,
  WEIGHTS,
} from "./weights";
import { verdictFor } from "./verdict";

function num(s: string | number | undefined | null): number {
  if (s === undefined || s === null) return 0;
  const v = typeof s === "string" ? parseFloat(s) : s;
  return Number.isFinite(v) ? v : 0;
}

function periodStatsFrom(stats: GMGNWalletStats): PeriodStats {
  return {
    realizedPnlUsd: num(stats.realized_profit),
    totalRevenueUsd: num(stats.sold_income),
    totalSpentUsd: num(stats.bought_cost),
  };
}

function profileFrom(
  statsByPeriod: Record<ProfilePeriod, GMGNWalletStats>,
  holdings: GMGNWalletHolding[] | null,
): WalletProfile {
  const periods: Record<ProfilePeriod, PeriodStats> = {
    "1d": periodStatsFrom(statsByPeriod["1d"]),
    "7d": periodStatsFrom(statsByPeriod["7d"]),
    "30d": periodStatsFrom(statsByPeriod["30d"]),
  };

  let unrealizedPnlUsd: number | null = null;
  if (holdings) {
    unrealizedPnlUsd = holdings.reduce(
      (sum, h) => sum + num(h.unrealized_profit),
      0,
    );
  }

  return {
    periods,
    unrealizedPnlUsd,
    nativeBalanceSol: num(statsByPeriod["30d"].native_balance),
  };
}

const MIN_TRADES_FOR_SCORE = 5;
const MIN_TOKEN_COUNT_FOR_SCORE = 3;

interface ScoreInputs {
  walletAddress: string;
  // The 30d stats are used for all behavioral sub-scores. The 1d/7d entries are
  // only used to populate the per-period profile strip.
  statsByPeriod: Record<ProfilePeriod, GMGNWalletStats>;
  holdings: GMGNWalletHolding[] | null;
  bundleEvidence: {
    hits: number;
    examined: number;
    evidence: Array<{ slot: string; mint: string; distinctSigners: number }>;
  };
  sniperEvidence: {
    hits: number;
    examined: number;
    evidence: Array<{ mint: string; walletSlot: string; launchSlot: string; delta: number }>;
  };
  funderChain: FunderHop[];
  flaggedAddresses: Set<string>;
  activityItems: GMGNWalletActivityItem[];
}

export function score({
  walletAddress,
  statsByPeriod,
  holdings,
  bundleEvidence,
  sniperEvidence,
  funderChain,
  flaggedAddresses,
  activityItems,
}: ScoreInputs): Receipt {
  const stats = statsByPeriod["30d"];
  // Defensive: GMGN sometimes returns wallets with missing or zero counters.
  const buy = stats.buy ?? 0;
  const sell = stats.sell ?? 0;
  const tokenNum = stats.pnl_stat?.token_num ?? 0;
  const totalTrades = buy + sell;

  // Insufficient data if BOTH the recent activity AND the lifetime token count
  // are below thresholds. This avoids gating older but currently-dormant wallets.
  const insufficient =
    totalTrades < MIN_TRADES_FOR_SCORE && tokenNum < MIN_TOKEN_COUNT_FOR_SCORE;

  if (insufficient) {
    const ageDays = stats.common?.created_at
      ? (Date.now() / 1000 - stats.common.created_at) / 86400
      : null;
    const reasons: string[] = [];
    if (totalTrades === 0 && tokenNum === 0) {
      reasons.push("No pump.fun activity found for this wallet.");
    } else {
      reasons.push(
        `Only ${totalTrades} recent trades and ${tokenNum} lifetime tokens — below the threshold for a meaningful score.`,
      );
    }
    if (ageDays !== null) {
      reasons.push(`Wallet has existed for ${ageDays.toFixed(0)} days.`);
    }

    return {
      walletAddress,
      scoredAt: new Date().toISOString(),
      finalScore: 0,
      verdict: "insufficient_data",
      layer1Score: 0,
      layer2Penalty: 0,
      factors: [],
      penalties: [],
      profile: profileFrom(statsByPeriod, holdings),
      activity: buildHeatmap(activityItems),
      meta: {
        period: "30d",
        source: { gmgn: true, bitquery: true, helius: !!process.env.HELIUS_API_KEY },
        notes: reasons,
      },
    };
  }

  const factors: ScoredFactor[] = [];

  // ---- Hold duration (22) ----
  {
    const seconds = stats.pnl_stat.avg_holding_period;
    const sub = holdDurationScore(seconds);
    factors.push({
      key: "hold_duration",
      label: "Hold duration",
      value: humanDuration(seconds),
      subScore: sub,
      weight: WEIGHTS.hold_duration,
      contribution: (sub * WEIGHTS.hold_duration) / 100,
      status: "computed",
    });
  }

  // ---- Token diversity (10) ----
  {
    const tokensPerDay = stats.pnl_stat.token_num / 30;
    const sub = tokenDiversityScore(tokensPerDay, stats.pnl_stat.token_num);
    factors.push({
      key: "token_diversity",
      label: "Token diversity",
      value: `${stats.pnl_stat.token_num} tokens / 30d (${tokensPerDay.toFixed(1)}/day)`,
      subScore: sub,
      weight: WEIGHTS.token_diversity,
      contribution: (sub * WEIGHTS.token_diversity) / 100,
      status: "computed",
    });
  }

  // ---- Wallet age (12) ----
  {
    const ageDays = (Date.now() / 1000 - stats.common.created_at) / 86400;
    const sub = walletAgeScore(ageDays);
    factors.push({
      key: "wallet_age",
      label: "Wallet age",
      value: `${ageDays.toFixed(0)} days`,
      subScore: sub,
      weight: WEIGHTS.wallet_age,
      contribution: (sub * WEIGHTS.wallet_age) / 100,
      status: "computed",
    });
  }

  // ---- Win/loss distribution (8) ----
  {
    const buckets = {
      lt_n50: stats.pnl_stat.pnl_lt_nd5_num,
      n50_0: stats.pnl_stat.pnl_nd5_0x_num,
      x0_2: stats.pnl_stat.pnl_0x_2x_num,
      x2_5: stats.pnl_stat.pnl_2x_5x_num,
      gt_5: stats.pnl_stat.pnl_gt_5x_num,
    };
    const sub = winLossScore(buckets);
    factors.push({
      key: "win_loss_distribution",
      label: "Win/loss distribution",
      value: `${(stats.pnl_stat.winrate * 100).toFixed(1)}% win rate`,
      subScore: sub,
      weight: WEIGHTS.win_loss_distribution,
      contribution: (sub * WEIGHTS.win_loss_distribution) / 100,
      status: "computed",
    });
  }

  // ---- PnL behavior (12) ----
  {
    const sub = pnlBehaviorScore(stats.buy, stats.sell);
    factors.push({
      key: "pnl_behavior",
      label: "PnL behavior",
      value: `${stats.buy} buys / ${stats.sell} sells`,
      subScore: sub,
      weight: WEIGHTS.pnl_behavior,
      contribution: (sub * WEIGHTS.pnl_behavior) / 100,
      status: "computed",
      note: "v1: derived from buy/sell ratio. v2: per-position full-dump detection.",
    });
  }

  // ---- Funding source (13) — uses Helius-classified funder chain ----
  {
    const fundAmount = parseFloat(stats.common.fund_amount || "0");
    // funderChain[0] = scored wallet itself; funderChain[1] = immediate funder
    const immediateFunderHop = funderChain[1] ?? null;
    const immediateFunderAddress = immediateFunderHop?.wallet ?? null;
    const immediateFunderKind = immediateFunderHop?.entityKind ?? "unknown";
    const immediateFunderFlagged = !!immediateFunderAddress && flaggedAddresses.has(immediateFunderAddress);

    // hopsToCex: how many hops from W to a labeled CEX (or null if not found)
    let hopsToCex: number | null = null;
    for (let i = 1; i < funderChain.length; i++) {
      if (funderChain[i].entityKind === "cex") {
        hopsToCex = i;
        break;
      }
    }

    const daisy = isDaisyChain(funderChain);

    const { score: sub, note } = fundingSourceScore({
      hasFunder: !!stats.common.fund_from_address,
      fundAmountSol: isFinite(fundAmount) ? fundAmount : undefined,
      immediateFunderKind,
      hopsToCex,
      isDaisyChain: daisy,
      immediateFunderFlagged,
    });

    const labelTag = immediateFunderHop?.entityName
      ? ` (${immediateFunderHop.entityName})`
      : "";
    factors.push({
      key: "funding_source",
      label: "Funding source",
      value: stats.common.fund_from_address
        ? `${shortAddr(stats.common.fund_from_address)} · ${fundAmount.toFixed(2)} SOL${labelTag}`
        : "unknown",
      subScore: sub,
      weight: WEIGHTS.funding_source,
      contribution: (sub * WEIGHTS.funding_source) / 100,
      status: "computed",
      note,
    });
  }

  // ---- SOL balance consistency (5) ----
  {
    const sol = parseFloat(stats.native_balance || "0");
    const sub = solBalanceScore(sol, totalTrades);
    factors.push({
      key: "sol_balance_consistency",
      label: "SOL balance",
      value: `${sol.toFixed(2)} SOL idle`,
      subScore: sub,
      weight: WEIGHTS.sol_balance_consistency,
      contribution: (sub * WEIGHTS.sol_balance_consistency) / 100,
      status: "computed",
    });
  }

  // Normalize once — both paperhand (Layer 1) and wash-trade (Layer 2)
  // consume this.
  const normalizedActivity = normalizeActivity(activityItems);

  // ---- Paperhand ratio (18) — derived from wallet_activity ----
  {
    const ph = computePaperhand(normalizedActivity);
    if (ph.ratio === null) {
      factors.push({
        key: "paperhand_ratio",
        label: "Paperhand ratio",
        value: `${ph.totalPairs} closed pairs (need 3+)`,
        subScore: 60,
        weight: WEIGHTS.paperhand_ratio,
        contribution: (60 * WEIGHTS.paperhand_ratio) / 100,
        status: "skipped",
        note: "not enough closed positions in activity window for a meaningful ratio",
      });
    } else {
      const sub = paperhandScore(ph.ratio);
      const pct = (ph.ratio * 100).toFixed(1);
      const fastestNote =
        ph.fastestExitSeconds !== null
          ? ` · fastest exit ${ph.fastestExitSeconds}s`
          : "";
      factors.push({
        key: "paperhand_ratio",
        label: "Paperhand ratio",
        value: `${pct}% within 5min (${ph.paperhandPairs}/${ph.totalPairs} pairs)`,
        subScore: sub,
        weight: WEIGHTS.paperhand_ratio,
        contribution: (sub * WEIGHTS.paperhand_ratio) / 100,
        status: "computed",
        note: `${ph.tokensExamined} tokens with closed positions${fastestNote}`,
      });
    }
  }

  const layer1 = Math.round(
    factors.reduce((sum, f) => sum + f.contribution, 0),
  );

  // ---- Layer 2 — Trust penalties ----
  const penalties: AppliedPenalty[] = [];

  // Bundle co-buy
  if (bundleEvidence.hits > 0) {
    const raw = bundleEvidence.hits * -20;
    const capped = Math.max(raw, BUNDLE_PENALTY_CAP);
    penalties.push({
      key: "bundle_co_buy",
      label: `Bundle co-buy detected (${bundleEvidence.hits} bundle${bundleEvidence.hits === 1 ? "" : "s"})`,
      amount: capped,
      evidence: bundleEvidence.evidence
        .slice(0, 3)
        .map((e) => `${shortMint(e.mint)} @ slot ${e.slot} (${e.distinctSigners} signers)`)
        .join("; "),
    });
  }

  // Sniper window — bought within 3 slots of token launch
  if (sniperEvidence.hits > 0) {
    const raw = sniperEvidence.hits * PENALTY_AMOUNTS.sniper_window;
    const capped = Math.max(raw, SNIPER_PENALTY_CAP);
    penalties.push({
      key: "sniper_window",
      label: `Sniper window — ${sniperEvidence.hits} buy${sniperEvidence.hits === 1 ? "" : "s"} within 3 blocks of launch`,
      amount: capped,
      evidence: sniperEvidence.evidence
        .slice(0, 3)
        .map((e) => `${shortMint(e.mint)} @ +${e.delta} block${e.delta === 1 ? "" : "s"}`)
        .join("; "),
    });
  }

  // Cluster proximity — funder at hop 1 is in our flagged set
  // Note: until per-token tag accumulation is implemented, bundler_taglog is
  // largely empty; this penalty rarely fires until then.
  for (let i = 1; i < funderChain.length; i++) {
    const hop = funderChain[i];
    if (!flaggedAddresses.has(hop.wallet)) continue;
    if (i === 1) {
      penalties.push({
        key: "cluster_one_hop",
        label: "Cluster — 1 hop from flagged wallet",
        amount: PENALTY_AMOUNTS.cluster_one_hop,
        evidence: `funder ${shortAddr(hop.wallet)} appears in bundler registry`,
      });
      break; // 1-hop hit dominates; don't double-count
    } else if (i === 2) {
      penalties.push({
        key: "cluster_two_hop",
        label: "Cluster — 2 hops from flagged wallet",
        amount: PENALTY_AMOUNTS.cluster_two_hop,
        evidence: `funder's funder ${shortAddr(hop.wallet)} appears in bundler registry`,
      });
      break;
    }
  }

  // Funding daisy-chain
  if (isDaisyChain(funderChain)) {
    penalties.push({
      key: "funding_daisy_chain",
      label: "Funding daisy-chain",
      amount: PENALTY_AMOUNTS.funding_daisy_chain,
      evidence: `${funderChain.length - 1} fresh-wallet intermediates in funding path`,
    });
  }

  // Wash trade — round-trip pattern across multiple tokens
  {
    const wash = detectWashTrades(normalizedActivity);
    if (wash.flagged) {
      const top = wash.evidence
        .slice(0, 3)
        .map((e) => `${shortMint(e.mint)} (${e.roundTrips} trips)`)
        .join("; ");
      penalties.push({
        key: "wash_trade",
        label: `Wash-trade pattern — ${wash.suspiciousTokens} tokens with round-trips`,
        amount: PENALTY_AMOUNTS.wash_trade,
        evidence: top,
      });
    }
  }

  const layer2Raw = penalties.reduce((sum, p) => sum + p.amount, 0);
  const layer2 = Math.max(layer2Raw, PENALTY_CAP);

  const finalScore = Math.max(0, Math.min(100, layer1 + layer2));
  const verdict = verdictFor(finalScore);

  return {
    walletAddress,
    scoredAt: new Date().toISOString(),
    finalScore,
    verdict,
    layer1Score: layer1,
    layer2Penalty: layer2,
    factors,
    penalties,
    profile: profileFrom(statsByPeriod, holdings),
    activity: buildHeatmap(activityItems),
    funderChain: funderChain.map<FunderHopReceipt>((h) => ({
      wallet: h.wallet,
      funderAddress: h.funderAddress,
      fundAmountSol: h.fundAmountSol,
      walletCreatedAt: h.walletCreatedAt,
      fundTimestamp: h.fundTimestamp,
      entityKind: h.entityKind,
      entityName: h.entityName,
      flagged: flaggedAddresses.has(h.wallet),
    })),
    meta: {
      period: "30d",
      source: { gmgn: true, bitquery: true, helius: !!process.env.HELIUS_API_KEY },
      notes: [
        `Bundle scan examined ${bundleEvidence.examined} of W's pump.fun buys.`,
        `Funder chain traced ${funderChain.length - 1} hop${funderChain.length - 1 === 1 ? "" : "s"}.`,
      ],
    },
  };
}

function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

function shortMint(m: string): string {
  return m.length > 10 ? `${m.slice(0, 4)}…${m.slice(-4)}` : m;
}
