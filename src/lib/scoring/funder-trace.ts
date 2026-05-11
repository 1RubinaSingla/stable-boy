import { getWalletStats } from "../gmgn/client";
import type { GMGNWalletStats } from "../gmgn/types";
import { classify, getIdentity, type EntityKind } from "../helius/client";
import { supabase } from "../supabase";

export interface FunderHop {
  /** Address whose funder this row describes (hop 0 = scored wallet). */
  wallet: string;
  /** The wallet that funded this hop's wallet (null at chain end). */
  funderAddress: string | null;
  fundAmountSol: number | null;
  fundTimestamp: number | null;
  walletCreatedAt: number | null;
  /** Helius classification of THIS hop's wallet (not the funder). */
  entityKind: EntityKind;
  entityName: string | null;
}

const MAX_HOPS = 3;

interface FunderRow {
  wallet_address: string;
  funder_address: string | null;
  fund_amount: number | null;
  fund_timestamp: number | null;
  fund_tx_hash: string | null;
}

async function readFunderCache(address: string): Promise<FunderRow | null> {
  const { data } = await supabase()
    .from("funder_lookups")
    .select("wallet_address, funder_address, fund_amount, fund_timestamp, fund_tx_hash")
    .eq("wallet_address", address)
    .maybeSingle<FunderRow>();
  return data ?? null;
}

async function writeFunderCache(
  address: string,
  stats: GMGNWalletStats,
): Promise<void> {
  await supabase()
    .from("funder_lookups")
    .upsert({
      wallet_address: address,
      funder_address: stats.common?.fund_from_address || null,
      fund_amount: stats.common?.fund_amount ? parseFloat(stats.common.fund_amount) : null,
      fund_tx_hash: stats.common?.fund_tx_hash || null,
      fund_timestamp: stats.common?.fund_from_ts || null,
    });
}

/**
 * Trace a wallet's funding chain up to MAX_HOPS deep. Returns one entry per
 * hop, hop 0 being the wallet itself.
 *
 * Optimization: pass the wallet's already-fetched 30d stats as `seedStats` to
 * avoid re-querying GMGN for hop 0.
 */
export async function traceFunders(
  wallet: string,
  seedStats: GMGNWalletStats,
): Promise<FunderHop[]> {
  const chain: FunderHop[] = [];
  let cursor: string = wallet;
  let cursorStats: GMGNWalletStats | null = seedStats;

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (!cursor) break;

    // Resolve stats for the cursor wallet — from seed (hop 0), cache, or GMGN.
    if (!cursorStats) {
      const cached = await readFunderCache(cursor);
      if (cached) {
        // We have the funder address cached, but we still need created_at +
        // labels. Skip GMGN if we can.
        chain.push({
          wallet: cursor,
          funderAddress: cached.funder_address,
          fundAmountSol: cached.fund_amount,
          fundTimestamp: cached.fund_timestamp,
          walletCreatedAt: null,
          entityKind: classify(await getIdentity(cursor)),
          entityName: null,
        });
        if (!cached.funder_address) break;
        cursor = cached.funder_address;
        cursorStats = null;
        continue;
      }

      try {
        cursorStats = await getWalletStats(cursor);
      } catch (err) {
        console.warn(`[funder-trace] hop ${hop} failed for ${cursor}`, err);
        break;
      }
    }

    // We have stats. Cache the row, look up identity, push hop.
    await writeFunderCache(cursor, cursorStats).catch(() => undefined);
    const identity = await getIdentity(cursor);
    const kind = classify(identity);

    chain.push({
      wallet: cursor,
      funderAddress: cursorStats.common?.fund_from_address || null,
      fundAmountSol: cursorStats.common?.fund_amount
        ? parseFloat(cursorStats.common.fund_amount)
        : null,
      fundTimestamp: cursorStats.common?.fund_from_ts ?? null,
      walletCreatedAt: cursorStats.common?.created_at ?? null,
      entityKind: kind,
      entityName: identity?.name ?? null,
    });

    // Terminate the chain at a CEX or labeled protocol — no point tracing through.
    if (kind === "cex" || kind === "protocol" || kind === "fund") break;

    if (!cursorStats.common?.fund_from_address) break;
    cursor = cursorStats.common.fund_from_address;
    cursorStats = null;
  }

  return chain;
}

/**
 * Detect daisy-chain funding: 3+ hops, all intermediates fresh (<24h between
 * the funded wallet's creation and its funding tx). Returns true if the chain
 * looks engineered.
 */
export function isDaisyChain(chain: FunderHop[]): boolean {
  if (chain.length < 3) return false;
  // Skip hop 0 (the wallet being scored), look at hops 1..n.
  for (let i = 1; i < chain.length; i++) {
    const hop = chain[i];
    if (!hop.walletCreatedAt || !hop.fundTimestamp) continue;
    const ageAtFunding = hop.fundTimestamp - hop.walletCreatedAt;
    // Within 24h of birth → suspicious automation
    if (ageAtFunding < 0 || ageAtFunding > 24 * 3600) {
      return false; // any single non-fresh intermediary breaks the chain
    }
  }
  return chain.length >= 3;
}

/**
 * Look up which addresses in the chain are flagged in our local
 * bundler_taglog. Returns a Set of flagged addresses.
 */
export async function flaggedAddressesIn(chain: FunderHop[]): Promise<Set<string>> {
  const addresses = chain
    .map((h) => h.wallet)
    .concat(chain.map((h) => h.funderAddress).filter((a): a is string => !!a));
  if (addresses.length === 0) return new Set();

  const { data } = await supabase()
    .from("bundler_taglog")
    .select("wallet_address")
    .in("wallet_address", addresses);
  return new Set((data ?? []).map((r) => (r as { wallet_address: string }).wallet_address));
}
