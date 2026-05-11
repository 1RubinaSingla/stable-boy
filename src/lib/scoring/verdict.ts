import type { Verdict } from "./types";

export function verdictFor(score: number): Verdict {
  if (score >= 80) return "diamond";
  if (score >= 50) return "active";
  if (score >= 20) return "degen";
  return "bundler";
}

export function verdictLabel(v: Verdict): string {
  switch (v) {
    case "diamond": return "Diamond hands";
    case "active": return "Active trader";
    case "degen": return "Degen / sniper";
    case "bundler": return "Bundler-adjacent";
    case "insufficient_data": return "Not enough rope";
  }
}

export function verdictTagline(v: Verdict): string {
  switch (v) {
    case "diamond": return "you hold like rent's not due";
    case "active": return "you take profit, but you don't run";
    case "degen": return "high velocity, low conviction";
    case "bundler": return "we saw the cluster";
    case "insufficient_data": return "come back after it's done something";
  }
}
