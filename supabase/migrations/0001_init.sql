-- Stable Boy initial schema
-- One row per scored wallet. Receipts are persisted in full so permalinks render
-- without re-running upstream API calls.

create extension if not exists "uuid-ossp";

create table if not exists scored_wallets (
  wallet_address text primary key,
  final_score integer not null,
  verdict text not null check (verdict in ('diamond','active','degen','bundler','insufficient_data')),
  layer1_score integer not null,
  layer2_penalty integer not null,
  receipt jsonb not null,
  scored_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists scored_wallets_expires_at_idx
  on scored_wallets (expires_at);

create index if not exists scored_wallets_scored_at_idx
  on scored_wallets (scored_at desc);

-- Funder lookups are immutable: once we know wallet X was funded by Y at time T,
-- that fact never changes. Cache forever.
create table if not exists funder_lookups (
  wallet_address text primary key,
  funder_address text,
  fund_amount numeric,
  fund_tx_hash text,
  fund_timestamp bigint,
  recorded_at timestamptz not null default now()
);

-- Per-token bundler tag log: every time we observe a wallet tagged as
-- sniper/bundler/insider on a token, append a row. Over time this becomes
-- our own bundler-suspect registry.
create table if not exists bundler_taglog (
  id uuid primary key default uuid_generate_v4(),
  wallet_address text not null,
  token_mint text not null,
  tag text not null check (tag in ('sniper','bundler','insider','smart_money')),
  source text not null,
  observed_at timestamptz not null default now(),
  unique (wallet_address, token_mint, tag, source)
);

create index if not exists bundler_taglog_wallet_idx
  on bundler_taglog (wallet_address);

create index if not exists bundler_taglog_token_idx
  on bundler_taglog (token_mint);
