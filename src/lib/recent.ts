/**
 * Tiny localStorage-backed history of the last few wallets the user looked
 * at. Used by <RecentWallets/> on the home page. SSR-safe — every method
 * is a no-op when window is undefined.
 */

const STORAGE_KEY = "stableboy:recent-wallets";
const MAX = 5;

export function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function addRecent(address: string): void {
  if (typeof window === "undefined") return;
  if (!address) return;
  try {
    const existing = getRecent();
    const next = [address, ...existing.filter((a) => a !== address)].slice(0, MAX);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / disabled — ignore */
  }
}

export function clearRecent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
