/**
 * Background tag-accumulation endpoint. Called by the receipt page client-side
 * after a score renders. Pulls token_top_traders for the wallet's most recent
 * pump.fun tokens and writes any sniper/bundler/insider/smart_money labels
 * into bundler_taglog so that future scorings can intersect against an
 * organically-grown registry that doesn't depend on GMGN's labels at runtime.
 *
 * Intentionally fire-and-forget: client doesn't read the response.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletPumpBuys } from "@/lib/bitquery/client";
import { getTokenTopTraders } from "@/lib/gmgn/client";
import type { GMGNTopTrader } from "@/lib/gmgn/types";
import { supabase } from "@/lib/supabase";
import { isValidSolanaAddress, normalizeAddress } from "@/lib/wallet";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOKENS_TO_PROCESS = 10;
const TAG_KEYS = ["sniper", "bundler", "insider", "smart_money"] as const;
type Tag = (typeof TAG_KEYS)[number];

interface TagRow {
  wallet_address: string;
  token_mint: string;
  tag: Tag;
  source: string;
}

function extractTags(t: GMGNTopTrader): Tag[] {
  const tags = new Set<Tag>();
  const arr = t.tags ?? (t.tag ? [t.tag] : []);
  for (const raw of arr) {
    const v = raw.toLowerCase();
    if (v.includes("sniper")) tags.add("sniper");
    if (v.includes("bundle")) tags.add("bundler");
    if (v.includes("insider")) tags.add("insider");
    if (v.includes("smart")) tags.add("smart_money");
  }
  if (t.is_sniper) tags.add("sniper");
  if (t.is_bundler) tags.add("bundler");
  if (t.is_insider) tags.add("insider");
  if (t.is_smart || t.is_smart_money) tags.add("smart_money");
  return Array.from(tags);
}

function traderAddress(t: GMGNTopTrader): string | null {
  return t.wallet_address || t.address || null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { wallet?: string };
  const wallet = body.wallet ? normalizeAddress(body.wallet) : "";
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  // Recent pump.fun buys → unique mints, ordered by most recent
  let mints: string[];
  try {
    const buys = await getWalletPumpBuys(wallet, 50);
    const seen = new Set<string>();
    mints = [];
    for (const b of buys) {
      const m = b.Trade.Currency.MintAddress;
      if (seen.has(m)) continue;
      seen.add(m);
      mints.push(m);
      if (mints.length >= TOKENS_TO_PROCESS) break;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "buys_fetch_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  if (mints.length === 0) {
    return NextResponse.json({ written: 0, mints: 0, note: "no recent pump.fun activity" });
  }

  let written = 0;
  const failures: string[] = [];

  for (const mint of mints) {
    try {
      const traders = await getTokenTopTraders(mint);
      const rows: TagRow[] = [];
      for (const t of traders) {
        const addr = traderAddress(t);
        if (!addr) continue;
        for (const tag of extractTags(t)) {
          rows.push({ wallet_address: addr, token_mint: mint, tag, source: "gmgn" });
        }
      }
      if (rows.length === 0) continue;

      const { error } = await supabase()
        .from("bundler_taglog")
        .upsert(rows, {
          onConflict: "wallet_address,token_mint,tag,source",
          ignoreDuplicates: true,
        });
      if (error) {
        failures.push(`${mint}: ${error.message}`);
      } else {
        written += rows.length;
      }
    } catch (err) {
      failures.push(`${mint}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    written,
    mints: mints.length,
    failures: failures.length ? failures : undefined,
  });
}
