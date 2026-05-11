import { env } from "../env";
import { MINT_LAUNCH_SLOTS, SLOT_BUNDLE_SCAN, WALLET_PUMP_BUYS } from "./queries";

const ENDPOINT = "https://streaming.bitquery.io/eap";

export interface PumpBuy {
  Block: { Slot: string; Time: string };
  Transaction: { Signature: string; Signer: string };
  Trade: {
    Currency: { MintAddress: string; Symbol: string };
    Amount: string;
  };
}

interface SlotScanRow {
  Block: { Slot: string };
  Transaction: { Signer: string };
  Trade: { Currency: { MintAddress: string } };
}

interface LaunchRow {
  Block: { Slot: string; Time: string };
  Trade: { Currency: { MintAddress: string } };
}

const SNIPER_WINDOW_SLOTS = 3;

export interface BundleEvidence {
  hits: number;
  examined: number;
  evidence: Array<{ slot: string; mint: string; distinctSigners: number }>;
}

export interface SniperEvidence {
  hits: number;
  examined: number;
  evidence: Array<{ mint: string; walletSlot: string; launchSlot: string; delta: number }>;
}

async function bitqueryPost<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env().BITQUERY_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Bitquery ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Bitquery errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Bitquery: empty data");
  return json.data;
}

export async function getWalletPumpBuys(
  wallet: string,
  limit = 100,
): Promise<PumpBuy[]> {
  const data = await bitqueryPost<{ Solana: { DEXTradeByTokens: PumpBuy[] } }>(
    WALLET_PUMP_BUYS,
    { wallet, limit },
  );
  return data.Solana.DEXTradeByTokens;
}

/**
 * One-pass scan that runs both Layer-2 detectors against a wallet's recent
 * pump.fun buys: bundle co-buy and sniper window. Sharing the wallet-buys
 * fetch saves one Bitquery call per scoring.
 */
export async function scanLayer2(wallet: string): Promise<{
  buys: PumpBuy[];
  bundle: BundleEvidence;
  sniper: SniperEvidence;
}> {
  const buys = await getWalletPumpBuys(wallet, 100);
  if (buys.length === 0) {
    return {
      buys,
      bundle: { hits: 0, examined: 0, evidence: [] },
      sniper: { hits: 0, examined: 0, evidence: [] },
    };
  }

  const slots = Array.from(new Set(buys.map((b) => b.Block.Slot)));
  const mints = Array.from(new Set(buys.map((b) => b.Trade.Currency.MintAddress)));

  // Fire both follow-up queries in parallel — they're independent.
  const [bundleData, launchData] = await Promise.all([
    bitqueryPost<{ Solana: { DEXTradeByTokens: SlotScanRow[] } }>(
      SLOT_BUNDLE_SCAN,
      { slots },
    ).catch((err) => {
      console.warn("[bitquery] bundle scan failed", err);
      return { Solana: { DEXTradeByTokens: [] as SlotScanRow[] } };
    }),
    bitqueryPost<{ Solana: { DEXTradeByTokens: LaunchRow[] } }>(
      MINT_LAUNCH_SLOTS,
      { mints },
    ).catch((err) => {
      console.warn("[bitquery] launch slots query failed", err);
      return { Solana: { DEXTradeByTokens: [] as LaunchRow[] } };
    }),
  ]);

  // ---- Bundle detection ----
  const walletPairs = new Set(
    buys.map((b) => `${b.Block.Slot}:${b.Trade.Currency.MintAddress}`),
  );
  const signersByPair = new Map<string, Set<string>>();
  for (const r of bundleData.Solana.DEXTradeByTokens) {
    const key = `${r.Block.Slot}:${r.Trade.Currency.MintAddress}`;
    let set = signersByPair.get(key);
    if (!set) {
      set = new Set();
      signersByPair.set(key, set);
    }
    set.add(r.Transaction.Signer);
  }
  const bundleEvidence: BundleEvidence["evidence"] = [];
  let bundleHits = 0;
  for (const pair of walletPairs) {
    const set = signersByPair.get(pair);
    const count = set?.size ?? 0;
    if (count >= 3) {
      bundleHits += 1;
      const [slot, mint] = pair.split(":");
      bundleEvidence.push({ slot, mint, distinctSigners: count });
    }
  }

  // ---- Sniper window detection ----
  const launchByMint = new Map<string, bigint>();
  for (const row of launchData.Solana.DEXTradeByTokens) {
    launchByMint.set(row.Trade.Currency.MintAddress, BigInt(row.Block.Slot));
  }
  const sniperEvidence: SniperEvidence["evidence"] = [];
  let sniperHits = 0;
  for (const buy of buys) {
    const launch = launchByMint.get(buy.Trade.Currency.MintAddress);
    if (launch === undefined) continue;
    const wSlot = BigInt(buy.Block.Slot);
    const delta = Number(wSlot - launch);
    if (delta >= 0 && delta <= SNIPER_WINDOW_SLOTS) {
      sniperHits += 1;
      sniperEvidence.push({
        mint: buy.Trade.Currency.MintAddress,
        walletSlot: buy.Block.Slot,
        launchSlot: launch.toString(),
        delta,
      });
    }
  }

  return {
    buys,
    bundle: {
      hits: bundleHits,
      examined: walletPairs.size,
      evidence: bundleEvidence,
    },
    sniper: {
      hits: sniperHits,
      examined: buys.length,
      evidence: sniperEvidence,
    },
  };
}

/**
 * @deprecated Kept for backward-compat. Use scanLayer2() to share the
 * wallet-buys fetch across bundle + sniper detection.
 */
export async function detectBundleHits(wallet: string): Promise<BundleEvidence> {
  return (await scanLayer2(wallet)).bundle;
}
