import { env } from "../env";
import type {
  GMGNEnvelope,
  GMGNTopTrader,
  GMGNWalletActivityItem,
  GMGNWalletHolding,
  GMGNWalletStats,
} from "./types";

const BASE_URL = "https://openapi.gmgn.ai";

// GMGN free tier is documented at 1 req/sec. We serialize through a single
// promise chain so concurrent callers wait their turn rather than 429ing.
let chain: Promise<unknown> = Promise.resolve();
const MIN_INTERVAL_MS = 1100;
let lastCallAt = 0;

async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      lastCallAt = Date.now();
    }
  });
  chain = next.catch(() => undefined);
  return next as Promise<T>;
}

function uuid(): string {
  // crypto.randomUUID is in Node 19+ and modern runtimes; Next 15 supports it
  return crypto.randomUUID();
}

async function gmgnGet<T>(
  path: string,
  query: Record<string, string | number> = {},
): Promise<T> {
  return rateLimited(async () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) params.set(k, String(v));
    params.set("timestamp", Math.floor(Date.now() / 1000).toString());
    params.set("client_id", uuid());

    const url = `${BASE_URL}${path}?${params.toString()}`;
    const res = await fetch(url, {
      headers: { "X-APIKEY": env().GMGN_API_KEY },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GMGN ${path} ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as GMGNEnvelope<T>;
    if (json.code !== 0) {
      throw new Error(
        `GMGN ${path} code=${json.code} ${json.message ?? json.reason ?? ""}`,
      );
    }
    return json.data;
  });
}

export async function getWalletStats(
  walletAddress: string,
  period: "1d" | "7d" | "30d" = "30d",
): Promise<GMGNWalletStats> {
  return gmgnGet<GMGNWalletStats>("/v1/user/wallet_stats", {
    chain: "sol",
    wallet_address: walletAddress,
    period,
  });
}

export async function getWalletHoldings(
  walletAddress: string,
  limit = 100,
): Promise<GMGNWalletHolding[]> {
  // GMGN sometimes wraps the holdings array in { holdings: [...] } and
  // sometimes returns the array directly. Tolerate both shapes.
  const data = await gmgnGet<unknown>("/v1/user/wallet_holdings", {
    chain: "sol",
    wallet_address: walletAddress,
    limit,
  });
  if (Array.isArray(data)) return data as GMGNWalletHolding[];
  if (data && typeof data === "object" && "holdings" in data) {
    const holdings = (data as { holdings?: unknown }).holdings;
    if (Array.isArray(holdings)) return holdings as GMGNWalletHolding[];
  }
  return [];
}

export async function getWalletActivity(
  walletAddress: string,
  limit = 500,
): Promise<GMGNWalletActivityItem[]> {
  // Tolerate either { activities: [...] } wrapping or a bare array.
  const data = await gmgnGet<unknown>("/v1/user/wallet_activity", {
    chain: "sol",
    wallet_address: walletAddress,
    limit,
  });
  if (Array.isArray(data)) return data as GMGNWalletActivityItem[];
  if (data && typeof data === "object") {
    const obj = data as { activities?: unknown; data?: unknown; items?: unknown };
    for (const key of ["activities", "items", "data"] as const) {
      const v = obj[key];
      if (Array.isArray(v)) return v as GMGNWalletActivityItem[];
    }
  }
  return [];
}

export async function getTokenTopTraders(
  mint: string,
  limit = 100,
): Promise<GMGNTopTrader[]> {
  // Tolerate either { traders: [...] } wrapping or a bare array.
  const data = await gmgnGet<unknown>("/v1/market/token_top_traders", {
    chain: "sol",
    address: mint,
    limit,
  });
  if (Array.isArray(data)) return data as GMGNTopTrader[];
  if (data && typeof data === "object") {
    const obj = data as { traders?: unknown; data?: unknown; items?: unknown };
    for (const key of ["traders", "items", "data"] as const) {
      const v = obj[key];
      if (Array.isArray(v)) return v as GMGNTopTrader[];
    }
  }
  return [];
}

export async function getUserInfo(): Promise<unknown> {
  return gmgnGet("/v1/user/info");
}
