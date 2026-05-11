import { NextRequest, NextResponse } from "next/server";
import {
  computeFreshReceipt,
  readCachedReceipt,
} from "@/lib/scoring/compute";
import { isValidSolanaAddress, normalizeAddress } from "@/lib/wallet";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { wallet?: string; force?: boolean };
  const wallet = body.wallet ? normalizeAddress(body.wallet) : "";

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: "invalid_address", message: "Provide a valid Solana wallet address." },
      { status: 400 },
    );
  }

  if (!body.force) {
    const cached = await readCachedReceipt(wallet);
    if (cached) return NextResponse.json({ receipt: cached, cached: true });
  }

  try {
    const receipt = await computeFreshReceipt(wallet);
    return NextResponse.json({ receipt, cached: false });
  } catch (err) {
    return NextResponse.json(
      {
        error: "compute_failed",
        message: err instanceof Error ? err.message : "Upstream request failed",
      },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: "invalid_address", message: "Pass ?wallet=<address>" },
      { status: 400 },
    );
  }
  const cached = await readCachedReceipt(wallet);
  if (!cached) {
    return NextResponse.json({ receipt: null, cached: false }, { status: 404 });
  }
  return NextResponse.json({ receipt: cached, cached: true });
}
