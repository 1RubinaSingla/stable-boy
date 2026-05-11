// Subset of GMGN OpenAPI response shapes — only the fields the scoring engine
// actually reads. Full responses include more, intentionally ignored.

export interface GMGNEnvelope<T> {
  code: number;
  message?: string;
  reason?: string;
  data: T;
}

export interface GMGNWalletHolding {
  token: {
    address?: string;
    symbol?: string;
    name?: string;
  };
  balance?: string;
  usd_value?: string;
  unrealized_profit?: string;
  unrealized_pnl?: string;
  realized_profit?: string;
  total_profit?: string;
  // Some responses flatten these to top level. Tolerate both.
  symbol?: string;
  mint_address?: string;
}

// token_top_traders response item — fields vary across GMGN versions, so we
// accept a flexible shape and probe for tag-like keys at runtime.
export interface GMGNTopTrader {
  address?: string;
  wallet_address?: string;
  tags?: string[];
  tag?: string;
  is_sniper?: boolean;
  is_insider?: boolean;
  is_bundler?: boolean;
  is_smart?: boolean;
  is_smart_money?: boolean;
}

export interface GMGNWalletActivityItem {
  // GMGN's activity response varies across versions. We probe several common
  // field names at runtime and tolerate missing fields. Helpers in
  // scoring/activity-shape.ts normalize these to a uniform shape.
  timestamp?: number;
  block_time?: number;
  time?: number;
  event_type?: string; // 'buy' | 'sell' | 'transfer_in' | 'transfer_out'
  type?: string;
  side?: string;
  token_address?: string;
  mint_address?: string;
  token?: { address?: string; symbol?: string };
  quantity?: string;
  cost?: string;
  cost_usd?: string;
}

export interface GMGNWalletStats {
  wallet_address: string;
  native_balance: string;
  realized_profit: string;
  realized_profit_pnl: string;
  buy: number;
  sell: number;
  bought_cost: string;
  sold_income: string;
  total_cost: string;
  last_timestamp: number;
  pnl_stat: {
    token_num: number;
    winrate: number;
    pnl_lt_nd5_num: number;
    pnl_nd5_0x_num: number;
    pnl_0x_2x_num: number;
    pnl_2x_5x_num: number;
    pnl_gt_5x_num: number;
    avg_holding_period: number; // seconds
  };
  common: {
    tags: string[];
    created_at: number; // unix seconds
    created_token_count: number;
    fund_from: string;
    fund_from_address: string;
    fund_amount: string;
    fund_tx_hash: string;
    fund_from_ts: number;
  };
}
