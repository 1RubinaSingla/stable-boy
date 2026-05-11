"use client";

import type {
  FunderHopReceipt,
  Receipt as ReceiptType,
  ScoredFactor,
} from "@/lib/scoring/types";
import { verdictLabel, verdictTagline } from "@/lib/scoring/verdict";

interface Props {
  a: ReceiptType;
  b: ReceiptType;
}

const ACCENT = "var(--color-accent)";
const DANGER = "var(--color-danger)";
const TEXT = "var(--color-text)";
const TEXT_DIM = "var(--color-text-dim)";
const TEXT_FAINT = "var(--color-text-faint)";
const WARN = "var(--color-warn)";

export function CompareView({ a, b }: Props) {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <a
        href="/"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        <span aria-hidden>←</span>
        <span>back</span>
      </a>

      <div className="border-b border-[var(--color-border)] pb-4 mb-8">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] mb-2">
          compare · stable boy
        </div>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <WalletHeader receipt={a} side="A" />
          <WalletHeader receipt={b} side="B" />
        </div>
      </div>

      {/* Score row */}
      <div className="grid grid-cols-2 gap-6 mb-12">
        <ScoreBlock receipt={a} />
        <ScoreBlock receipt={b} />
      </div>

      {/* Shared funders — the headline forensic check */}
      <SharedFunders a={a} b={b} />

      {/* Factor diff table */}
      <FactorDiff a={a} b={b} />

      {/* Penalties */}
      <PenaltyDiff a={a} b={b} />

      {/* Profile summary */}
      <ProfileDiff a={a} b={b} />

      <div className="mt-12 font-mono text-xs text-[var(--color-text-faint)] uppercase tracking-widest">
        compare view · both wallets scored under the same algorithm
      </div>
    </div>
  );
}

function shortAddr(s: string): string {
  return s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-8)}` : s;
}

function scoreTone(score: number, verdict: string): string {
  if (verdict === "insufficient_data") return TEXT_DIM;
  if (score >= 80) return ACCENT;
  if (score >= 50) return TEXT;
  if (score >= 20) return WARN;
  return DANGER;
}

function WalletHeader({ receipt, side }: { receipt: ReceiptType; side: "A" | "B" }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
        wallet {side}
      </div>
      <a
        href={`/w/${receipt.walletAddress}`}
        className="font-mono text-sm text-[var(--color-text)] break-all hover:text-[var(--color-accent)] transition-colors"
      >
        {receipt.walletAddress}
      </a>
    </div>
  );
}

function ScoreBlock({ receipt }: { receipt: ReceiptType }) {
  const isInsufficient = receipt.verdict === "insufficient_data";
  return (
    <div className="border border-[var(--color-border)] p-5">
      <div
        className="font-mono font-medium leading-none tabular text-[72px] sm:text-[88px]"
        style={{ color: scoreTone(receipt.finalScore, receipt.verdict) }}
      >
        {isInsufficient ? "—" : receipt.finalScore}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mt-2">
        / 100 · stability score
      </div>
      <div className="mt-4">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] mb-1">
          {verdictLabel(receipt.verdict)}
        </div>
        <div className="text-sm text-[var(--color-text-dim)] leading-snug">
          {verdictTagline(receipt.verdict)}
        </div>
      </div>
    </div>
  );
}

/**
 * Find any address that appears in both wallets' funder chains. This is the
 * "are they related" check — shared funder = strong evidence of coordination.
 */
function findSharedFunders(
  a: FunderHopReceipt[] | undefined,
  b: FunderHopReceipt[] | undefined,
): Array<{
  address: string;
  hopA: number;
  hopB: number;
  entityName: string | null;
  entityKind: FunderHopReceipt["entityKind"];
}> {
  if (!a || !b) return [];
  const allOf = (chain: FunderHopReceipt[]) => {
    // Index each wallet's own addresses + the funder addresses they point to.
    const map = new Map<string, { hop: number; hop_obj: FunderHopReceipt }>();
    chain.forEach((h, i) => {
      if (!map.has(h.wallet)) map.set(h.wallet, { hop: i, hop_obj: h });
      if (h.funderAddress && !map.has(h.funderAddress)) {
        // The funder is at hop i+1 in conceptual depth (it's the parent).
        map.set(h.funderAddress, {
          hop: i + 1,
          hop_obj: {
            wallet: h.funderAddress,
            funderAddress: null,
            fundAmountSol: null,
            walletCreatedAt: null,
            fundTimestamp: null,
            entityKind: "unknown",
            entityName: null,
            flagged: false,
          },
        });
      }
    });
    return map;
  };
  const ma = allOf(a);
  const mb = allOf(b);
  const out: ReturnType<typeof findSharedFunders> = [];
  for (const [addr, va] of ma) {
    const vb = mb.get(addr);
    if (!vb) continue;
    // Skip if it's just the scored wallets themselves at hop 0 — different addresses.
    out.push({
      address: addr,
      hopA: va.hop,
      hopB: vb.hop,
      entityName: va.hop_obj.entityName ?? vb.hop_obj.entityName,
      entityKind:
        va.hop_obj.entityKind !== "unknown"
          ? va.hop_obj.entityKind
          : vb.hop_obj.entityKind,
    });
  }
  // De-prioritize labeled CEX/protocol — those are shared by definition (everyone funds from Coinbase).
  return out
    .filter((o) => o.entityKind !== "cex" && o.entityKind !== "protocol")
    .sort((a, b) => a.hopA + a.hopB - (b.hopA + b.hopB));
}

function SharedFunders({ a, b }: { a: ReceiptType; b: ReceiptType }) {
  const shared = findSharedFunders(a.funderChain, b.funderChain);

  return (
    <div className="mb-12">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-2 px-1">
        shared funders
      </div>
      <div className="border border-[var(--color-border)]">
        {shared.length === 0 ? (
          <div className="px-4 py-6 font-mono text-sm text-[var(--color-text-faint)]">
            no shared funders in either chain — wallets appear independently
            funded.
          </div>
        ) : (
          <div className="border-l-2 border-[var(--color-warn)]">
            <div className="px-4 py-3 font-mono text-xs text-[var(--color-warn)] uppercase tracking-widest border-b border-[var(--color-border)]">
              {shared.length} shared address{shared.length === 1 ? "" : "es"} found · suggests coordination
            </div>
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest">
                  <th className="text-left py-2 px-3 font-normal">address</th>
                  <th className="text-right py-2 px-3 font-normal">hop A</th>
                  <th className="text-right py-2 px-3 font-normal">hop B</th>
                  <th className="text-left py-2 px-3 font-normal">label</th>
                </tr>
              </thead>
              <tbody>
                {shared.slice(0, 10).map((s) => (
                  <tr
                    key={s.address}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="py-2 px-3 break-all">{shortAddr(s.address)}</td>
                    <td className="py-2 px-3 text-right text-[var(--color-text-dim)] tabular">
                      +{s.hopA}
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--color-text-dim)] tabular">
                      +{s.hopB}
                    </td>
                    <td className="py-2 px-3 text-[var(--color-text-faint)]">
                      {s.entityName ?? (s.entityKind === "unknown" ? "—" : s.entityKind)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FactorDiff({ a, b }: { a: ReceiptType; b: ReceiptType }) {
  // Build a unified factor map keyed by factor.key.
  const map = new Map<string, { a?: ScoredFactor; b?: ScoredFactor }>();
  for (const f of a.factors) map.set(f.key, { a: f });
  for (const f of b.factors) {
    const cur = map.get(f.key) ?? {};
    cur.b = f;
    map.set(f.key, cur);
  }

  const rows = Array.from(map.values()).filter((r) => r.a || r.b);
  if (rows.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-2 px-1">
        factor comparison
      </div>
      <div className="border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest">
              <th className="text-left py-2 px-3 font-normal">signal</th>
              <th className="text-right py-2 px-3 font-normal">A</th>
              <th className="text-right py-2 px-3 font-normal">B</th>
              <th className="text-right py-2 px-3 font-normal">winner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a: fa, b: fb }, i) => {
              const label = fa?.label ?? fb?.label ?? "—";
              const subA = fa?.subScore ?? null;
              const subB = fb?.subScore ?? null;
              let winner: "A" | "B" | "—" = "—";
              if (subA !== null && subB !== null) {
                if (subA > subB) winner = "A";
                else if (subB > subA) winner = "B";
              }
              const delta = subA !== null && subB !== null ? subB - subA : null;
              return (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="py-3 px-3">
                    <div>{label}</div>
                    <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">
                      <span className="mr-3">A: {fa?.value ?? "—"}</span>
                      <span>B: {fb?.value ?? "—"}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right tabular">
                    {subA !== null ? subA : <span className="text-[var(--color-text-faint)]">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right tabular">
                    {subB !== null ? subB : <span className="text-[var(--color-text-faint)]">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {winner === "A" && (
                      <span className="text-[var(--color-accent)]">
                        A {delta !== null ? `(${delta > 0 ? "" : "+"}${-delta})` : ""}
                      </span>
                    )}
                    {winner === "B" && (
                      <span className="text-[var(--color-accent)]">
                        B {delta !== null ? `(+${delta})` : ""}
                      </span>
                    )}
                    {winner === "—" && (
                      <span className="text-[var(--color-text-faint)]">tie</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PenaltyDiff({ a, b }: { a: ReceiptType; b: ReceiptType }) {
  if (a.penalties.length === 0 && b.penalties.length === 0) return null;
  return (
    <div className="mb-12">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-2 px-1">
        penalties
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PenaltyColumn label="wallet A" penalties={a.penalties} />
        <PenaltyColumn label="wallet B" penalties={b.penalties} />
      </div>
    </div>
  );
}

function PenaltyColumn({
  label,
  penalties,
}: {
  label: string;
  penalties: ReceiptType["penalties"];
}) {
  return (
    <div className="border border-[var(--color-border)]">
      <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] border-b border-[var(--color-border)]">
        {label}
      </div>
      {penalties.length === 0 ? (
        <div className="px-3 py-4 font-mono text-sm text-[var(--color-text-faint)]">
          no penalties
        </div>
      ) : (
        <table className="w-full font-mono text-sm">
          <tbody>
            {penalties.map((p, i) => (
              <tr
                key={i}
                className="border-t first:border-t-0 border-[var(--color-border)]"
              >
                <td className="py-2 px-3">
                  <div>{p.label}</div>
                  {p.evidence && (
                    <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">
                      {p.evidence}
                    </div>
                  )}
                </td>
                <td className="py-2 px-3 text-right tabular text-[var(--color-danger)]">
                  {p.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProfileDiff({ a, b }: { a: ReceiptType; b: ReceiptType }) {
  if (!a.profile && !b.profile) return null;
  const cells = (r: ReceiptType) => {
    if (!r.profile?.periods) return null;
    const p30 = r.profile.periods["30d"];
    return {
      realized: p30.realizedPnlUsd,
      unrealized: r.profile.unrealizedPnlUsd,
      revenue: p30.totalRevenueUsd,
      spent: p30.totalSpentUsd,
      sol: r.profile.nativeBalanceSol,
    };
  };
  const ca = cells(a);
  const cb = cells(b);
  if (!ca && !cb) return null;

  const rows: Array<{ label: string; a: string; b: string }> = [
    { label: "realized pnl (30d)", a: usd(ca?.realized), b: usd(cb?.realized) },
    { label: "unrealized pnl", a: usd(ca?.unrealized), b: usd(cb?.unrealized) },
    { label: "revenue (30d)", a: usd(ca?.revenue), b: usd(cb?.revenue) },
    { label: "spent (30d)", a: usd(ca?.spent), b: usd(cb?.spent) },
    { label: "sol idle", a: sol(ca?.sol), b: sol(cb?.sol) },
  ];

  return (
    <div className="mb-12">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-2 px-1">
        profile · 30d
      </div>
      <div className="border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest">
              <th className="text-left py-2 px-3 font-normal">metric</th>
              <th className="text-right py-2 px-3 font-normal">A</th>
              <th className="text-right py-2 px-3 font-normal">B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-[var(--color-border)]">
                <td className="py-2 px-3 text-[var(--color-text-dim)]">{r.label}</td>
                <td className="py-2 px-3 text-right tabular">{r.a}</td>
                <td className="py-2 px-3 text-right tabular">{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  let body: string;
  if (abs >= 1e6) body = `$${(abs / 1e6).toFixed(2)}M`;
  else if (abs >= 1e3) body = `$${(abs / 1e3).toFixed(2)}K`;
  else body = `$${abs.toFixed(2)}`;
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

function sol(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} SOL`;
}
