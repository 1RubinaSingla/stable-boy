/**
 * Embeddable SVG badge for a wallet score. Designed for use as
 *   <a href="https://www.stableboy.fun/w/<addr>">
 *     <img src="https://www.stableboy.fun/w/<addr>/badge.svg" alt="Stable Boy score" />
 *   </a>
 * in Twitter bios, GitHub READMEs, Discord profiles, etc.
 *
 * Reads the cached receipt from Supabase. If none exists, renders a
 * 'score this wallet' prompt that links back to the live page.
 */

import { NextRequest } from "next/server";
import type { Receipt } from "@/lib/scoring/types";
import { verdictLabel, verdictTagline } from "@/lib/scoring/verdict";
import { supabase } from "@/lib/supabase";
import { isValidSolanaAddress } from "@/lib/wallet";

export const runtime = "nodejs";

const BG = "#0a0a0b";
const TEXT = "#ededee";
const TEXT_DIM = "#888890";
const TEXT_FAINT = "#55555a";
const ACCENT = "#7cd4b0";
const DANGER = "#d4806f";
const WARN = "#d4b56f";

const W = 600;
const H = 140;

function scoreColor(score: number, verdict: string): string {
  if (verdict === "insufficient_data") return TEXT_DIM;
  if (score >= 80) return ACCENT;
  if (score >= 50) return TEXT;
  if (score >= 20) return WARN;
  return DANGER;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchReceipt(address: string): Promise<Receipt | null> {
  const { data } = await supabase()
    .from("scored_wallets")
    .select("receipt")
    .eq("wallet_address", address)
    .maybeSingle<{ receipt: Receipt }>();
  return data?.receipt ?? null;
}

function renderScoredBadge(receipt: Receipt): string {
  const score = receipt.finalScore;
  const color = scoreColor(score, receipt.verdict);
  const verdict = verdictLabel(receipt.verdict);
  const tagline = verdictTagline(receipt.verdict);
  const wallet = shortAddr(receipt.walletAddress);
  const isInsufficient = receipt.verdict === "insufficient_data";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stable Boy score: ${escapeXml(String(score))}/100 ${escapeXml(verdict)}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="0" y="0" width="3" height="${H}" fill="${ACCENT}"/>

  <!-- Brand -->
  <rect x="24" y="20" width="9" height="9" fill="${ACCENT}"/>
  <text x="42" y="28" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="11" fill="${TEXT}" letter-spacing="2">STABLE BOY</text>
  <text x="42" y="46" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="10" fill="${TEXT_DIM}">${escapeXml(wallet)}</text>

  <!-- Score -->
  <text x="24" y="108" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="58" font-weight="500" fill="${color}" letter-spacing="-2">${isInsufficient ? "—" : score}</text>
  <text x="24" y="124" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="9" fill="${TEXT_FAINT}" letter-spacing="2">/ 100 · STABILITY SCORE</text>

  <!-- Verdict -->
  <text x="220" y="80" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="11" fill="${ACCENT}" letter-spacing="2">${escapeXml(verdict.toUpperCase())}</text>
  <text x="220" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" fill="${TEXT_DIM}">${escapeXml(tagline)}</text>

  <!-- Footer link -->
  <text x="${W - 24}" y="124" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="9" fill="${ACCENT}" letter-spacing="1" text-anchor="end">STABLEBOY.FUN</text>
</svg>`;
}

function renderUnscoredBadge(address: string): string {
  const wallet = shortAddr(address);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score this wallet on Stable Boy">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="0" y="0" width="3" height="${H}" fill="${ACCENT}"/>

  <rect x="24" y="20" width="9" height="9" fill="${ACCENT}"/>
  <text x="42" y="28" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="11" fill="${TEXT}" letter-spacing="2">STABLE BOY</text>
  <text x="42" y="46" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="10" fill="${TEXT_DIM}">${escapeXml(wallet)}</text>

  <text x="24" y="92" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="22" fill="${TEXT}">click to score this wallet</text>
  <text x="24" y="118" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="10" fill="${TEXT_FAINT}" letter-spacing="2">0 – 100 STABILITY SCORE · PUMP.FUN + SOLANA</text>

  <text x="${W - 24}" y="124" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="9" fill="${ACCENT}" letter-spacing="1" text-anchor="end">STABLEBOY.FUN</text>
</svg>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isValidSolanaAddress(address)) {
    return new Response("Invalid address", { status: 400 });
  }

  let svg: string;
  let cacheControl: string;
  try {
    const receipt = await fetchReceipt(address);
    if (receipt) {
      svg = renderScoredBadge(receipt);
      cacheControl = "public, max-age=600, s-maxage=3600";
    } else {
      svg = renderUnscoredBadge(address);
      // Short cache so unscored badges flip to scored quickly once cache lands
      cacheControl = "public, max-age=60, s-maxage=60";
    }
  } catch (err) {
    console.error("[badge.svg] render failed", err);
    return new Response("badge render failed", { status: 500 });
  }

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}
