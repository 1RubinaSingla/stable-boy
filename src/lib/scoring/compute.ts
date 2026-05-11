/**
 * Receipt orchestration. Pulls all upstream data, runs the scoring engine,
 * persists to the cache. Used by /api/score, /w/[address], and /compare.
 */

import { scanLayer2 } from "../bitquery/client";
import {
  getWalletActivity,
  getWalletHoldings,
  getWalletStats,
} from "../gmgn/client";
import type { GMGNWalletActivityItem, GMGNWalletHolding } from "../gmgn/types";
import { supabase } from "../supabase";
import { score } from ".";
import { flaggedAddressesIn, traceFunders } from "./funder-trace";
import type { Receipt } from "./types";

export async function readCachedReceipt(address: string): Promise<Receipt | null> {
  const { data, error } = await supabase()
    .from("scored_wallets")
    .select("receipt, expires_at")
    .eq("wallet_address", address)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ receipt: Receipt; expires_at: string }>();
  if (error) {
    console.warn("[compute] cache read failed", error);
    return null;
  }
  return data?.receipt ?? null;
}

export async function writeCachedReceipt(receipt: Receipt): Promise<void> {
  const { error } = await supabase().from("scored_wallets").upsert({
    wallet_address: receipt.walletAddress,
    final_score: receipt.finalScore,
    verdict: receipt.verdict,
    layer1_score: receipt.layer1Score,
    layer2_penalty: receipt.layer2Penalty,
    receipt,
    scored_at: receipt.scoredAt,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) console.warn("[compute] cache write failed", error);
}

/**
 * Pull all upstream data, run the scoring engine. Persists the result to the
 * cache as a side effect.
 */
export async function computeFreshReceipt(address: string): Promise<Receipt> {
  const [s1d, s7d, s30d] = await Promise.allSettled([
    getWalletStats(address, "1d"),
    getWalletStats(address, "7d"),
    getWalletStats(address, "30d"),
  ]);
  if (s30d.status === "rejected") throw s30d.reason;
  const statsByPeriod = {
    "1d": s1d.status === "fulfilled" ? s1d.value : s30d.value,
    "7d": s7d.status === "fulfilled" ? s7d.value : s30d.value,
    "30d": s30d.value,
  };

  let holdings: GMGNWalletHolding[] | null = null;
  try {
    holdings = await getWalletHoldings(address);
  } catch (e) {
    console.warn("[compute] holdings fetch failed", e);
  }

  let activityItems: GMGNWalletActivityItem[] = [];
  try {
    activityItems = await getWalletActivity(address, 500);
  } catch (e) {
    console.warn("[compute] activity fetch failed", e);
  }

  let bundleEvidence = {
    hits: 0,
    examined: 0,
    evidence: [] as Array<{ slot: string; mint: string; distinctSigners: number }>,
  };
  let sniperEvidence = {
    hits: 0,
    examined: 0,
    evidence: [] as Array<{ mint: string; walletSlot: string; launchSlot: string; delta: number }>,
  };
  try {
    const scan = await scanLayer2(address);
    bundleEvidence = scan.bundle;
    sniperEvidence = scan.sniper;
  } catch (e) {
    console.warn("[compute] layer-2 scan failed", e);
  }

  let funderChain: Awaited<ReturnType<typeof traceFunders>> = [];
  try {
    funderChain = await traceFunders(address, statsByPeriod["30d"]);
  } catch (e) {
    console.warn("[compute] funder trace failed", e);
  }

  let flagged = new Set<string>();
  try {
    flagged = await flaggedAddressesIn(funderChain);
  } catch (e) {
    console.warn("[compute] flagged-address lookup failed", e);
  }

  const receipt = score({
    walletAddress: address,
    statsByPeriod,
    holdings,
    bundleEvidence,
    sniperEvidence,
    funderChain,
    flaggedAddresses: flagged,
    activityItems,
  });

  writeCachedReceipt(receipt).catch(() => undefined);
  return receipt;
}

/**
 * Read from cache; fall back to a fresh compute on miss. Returns 'error' on
 * upstream failure so callers can render an error state.
 */
export async function getOrComputeReceipt(
  address: string,
): Promise<Receipt | "error"> {
  const cached = await readCachedReceipt(address);
  if (cached) return cached;
  try {
    return await computeFreshReceipt(address);
  } catch (err) {
    console.error("[compute] orchestration failed for", address, err);
    return "error";
  }
}
