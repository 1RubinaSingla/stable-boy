import type { FactorKey, PenaltyKey } from "./types";

export const WEIGHTS: Record<FactorKey, number> = {
  hold_duration: 22,
  paperhand_ratio: 18,
  funding_source: 13,
  wallet_age: 12,
  pnl_behavior: 12,
  token_diversity: 10,
  win_loss_distribution: 8,
  sol_balance_consistency: 5,
};

export const PENALTY_AMOUNTS: Record<PenaltyKey, number> = {
  bundle_co_buy: -20, // per bundle, capped externally
  cluster_one_hop: -15,
  cluster_two_hop: -7,
  sniper_window: -5, // per occurrence, capped
  funding_daisy_chain: -15,
  wash_trade: -10,
  dormant_coordinated: -10,
};

export const PENALTY_CAP = -60;
export const BUNDLE_PENALTY_CAP = -40;
export const SNIPER_PENALTY_CAP = -20;
