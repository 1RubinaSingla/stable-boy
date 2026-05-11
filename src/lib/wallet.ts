// Solana addresses are base58-encoded 32-byte ed25519 public keys.
// In practice they're 32–44 chars. We accept that range and exclude common
// non-base58 chars (0, O, I, l).
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(s: string): boolean {
  return SOLANA_ADDRESS.test(s.trim());
}

export function normalizeAddress(s: string): string {
  return s.trim();
}
