import type { GMGNWalletActivityItem } from "../gmgn/types";

/** Side-of-trade after normalization. `unknown` for non-trade events. */
export type Side = "buy" | "sell" | "unknown";

export interface NormalizedActivity {
  timestampMs: number;
  side: Side;
  mint: string;
}

const SOL_MINTS = new Set([
  "11111111111111111111111111111111",
  "So11111111111111111111111111111111111111112",
]);

function pickSide(item: GMGNWalletActivityItem): Side {
  const candidates = [item.event_type, item.type, item.side]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  for (const c of candidates) {
    if (c === "buy" || c.startsWith("buy")) return "buy";
    if (c === "sell" || c.startsWith("sell")) return "sell";
  }
  return "unknown";
}

function pickMint(item: GMGNWalletActivityItem): string | null {
  return (
    item.token_address ||
    item.mint_address ||
    item.token?.address ||
    null
  );
}

function pickTimestampMs(item: GMGNWalletActivityItem): number | null {
  const v = item.timestamp ?? item.block_time ?? item.time ?? null;
  if (v === null) return null;
  const ms = v < 1e12 ? v * 1000 : v;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Drop SOL-side rows, drop events without a mint or timestamp, and unify
 * field names. Output is sorted ascending by time.
 */
export function normalizeActivity(
  items: GMGNWalletActivityItem[],
): NormalizedActivity[] {
  const rows: NormalizedActivity[] = [];
  for (const item of items) {
    const ts = pickTimestampMs(item);
    const mint = pickMint(item);
    if (ts === null || !mint || SOL_MINTS.has(mint)) continue;
    rows.push({ timestampMs: ts, side: pickSide(item), mint });
  }
  rows.sort((a, b) => a.timestampMs - b.timestampMs);
  return rows;
}
