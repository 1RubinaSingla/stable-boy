import { env } from "../env";

const BASE_URL = "https://api.helius.xyz";

export interface HeliusIdentity {
  address: string;
  type: string; // e.g., "exchange", "protocol", "wallet"
  name: string; // e.g., "Binance 1", "Jupiter"
  category: string; // e.g., "Centralized Exchange", "DEX"
  tags: string[]; // e.g., ["Centralized Exchange"]
  domainNames?: string[];
}

export type EntityKind = "cex" | "protocol" | "fund" | "kol" | "other" | "unknown";

/**
 * Look up entity identity for a Solana address. Returns null when:
 *   - HELIUS_API_KEY is not configured (graceful degradation)
 *   - The address is unknown (Helius returns 404)
 *   - The request fails for any other reason
 */
export async function getIdentity(address: string): Promise<HeliusIdentity | null> {
  const apiKey = env().HELIUS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `${BASE_URL}/v1/wallet/${encodeURIComponent(address)}/identity?api-key=${apiKey}`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[helius] ${address} → ${res.status}`);
      return null;
    }
    return (await res.json()) as HeliusIdentity;
  } catch (err) {
    console.warn(`[helius] ${address} fetch failed`, err);
    return null;
  }
}

/**
 * Reduce a Helius identity to one of our coarse kinds for scoring.
 */
export function classify(identity: HeliusIdentity | null): EntityKind {
  if (!identity) return "unknown";
  const t = identity.type?.toLowerCase() ?? "";
  const c = identity.category?.toLowerCase() ?? "";
  const tags = (identity.tags ?? []).map((x) => x.toLowerCase());

  const has = (needle: string) =>
    t.includes(needle) || c.includes(needle) || tags.some((x) => x.includes(needle));

  if (has("exchange") || has("cex")) return "cex";
  if (has("protocol") || has("dex") || has("amm") || has("aggregator")) return "protocol";
  if (has("fund") || has("vc")) return "fund";
  if (has("kol") || has("influencer")) return "kol";
  return "other"; // labeled but doesn't match a category we score on
}
