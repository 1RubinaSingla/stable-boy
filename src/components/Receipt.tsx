"use client";

import { useEffect, useState } from "react";
import { addRecent } from "@/lib/recent";
import type {
  ActivityHeatmap,
  FunderHopReceipt,
  ProfilePeriod,
  Receipt as ReceiptType,
  WalletProfile,
} from "@/lib/scoring/types";
import { verdictLabel, verdictTagline } from "@/lib/scoring/verdict";

interface Props {
  receipt: ReceiptType;
}

export function Receipt({ receipt: initialReceipt }: Props) {
  const [receipt, setReceipt] = useState<ReceiptType>(initialReceipt);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreError, setRescoreError] = useState<string | null>(null);

  // Reset state when the initial receipt prop changes (navigation between wallets).
  useEffect(() => {
    setReceipt(initialReceipt);
    setRescoreError(null);
  }, [initialReceipt]);

  // Record the visit in the recent-wallets list (localStorage).
  useEffect(() => {
    if (receipt.walletAddress) addRecent(receipt.walletAddress);
  }, [receipt.walletAddress]);

  // Fire-and-forget: kick off background tag accumulation so the
  // bundler_taglog grows organically over time. Doesn't block the receipt.
  useEffect(() => {
    if (receipt.verdict === "insufficient_data") return;
    const ctl = new AbortController();
    fetch("/api/accumulate-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: receipt.walletAddress }),
      signal: ctl.signal,
      keepalive: true,
    }).catch(() => undefined);
    return () => ctl.abort();
  }, [receipt.walletAddress, receipt.verdict]);

  async function rescore() {
    if (rescoring) return;
    setRescoring(true);
    setRescoreError(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: receipt.walletAddress, force: true }),
      });
      if (!res.ok) throw new Error(`re-score failed (${res.status})`);
      const json = (await res.json()) as { receipt: ReceiptType };
      if (!json.receipt) throw new Error("empty response");
      setReceipt(json.receipt);
    } catch (err) {
      setRescoreError(err instanceof Error ? err.message : "re-score failed");
    } finally {
      setRescoring(false);
    }
  }

  if (receipt.verdict === "insufficient_data") {
    return <InsufficientDataView receipt={receipt} />;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <BackLink />
      {/* Top bar — wallet address */}
      <div className="flex items-baseline justify-between mb-6 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
            wallet
          </div>
          <div className="font-mono text-sm break-all">{receipt.walletAddress}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
            scored
          </div>
          <div className="font-mono text-xs text-[var(--color-text-dim)] flex items-center justify-end gap-3">
            <span>
              {new Date(receipt.scoredAt).toISOString().slice(0, 19).replace("T", " ")}Z
            </span>
            <button
              onClick={rescore}
              disabled={rescoring}
              title="re-score this wallet (skips the 24h cache)"
              className="inline-flex items-center gap-1.5 px-2 py-1 border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] uppercase tracking-widest text-[10px] transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              {rescoring ? (
                <>
                  <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                  <span>scoring</span>
                </>
              ) : (
                <>
                  <span aria-hidden>↻</span>
                  <span>re-score</span>
                </>
              )}
            </button>
          </div>
          {rescoreError && (
            <div className="font-mono text-[10px] text-[var(--color-danger)] mt-1">
              {rescoreError}
            </div>
          )}
        </div>
      </div>

      {/* Score block — score | verdict | actions */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-8 md:gap-10 mb-12 items-end">
        <div>
          <div className="font-mono font-medium text-[88px] sm:text-[112px] md:text-[160px] leading-none tabular text-[var(--color-text)]">
            {receipt.finalScore}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mt-3">
            / 100 · stability score
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] mb-2">
            {verdictLabel(receipt.verdict)}
          </div>
          <div className="text-xl md:text-2xl text-[var(--color-text-dim)] leading-snug">
            {verdictTagline(receipt.verdict)}
          </div>
        </div>
        <ShareBar receipt={receipt} vertical />
      </div>

      <>
          {/* Wallet profile strip */}
          {receipt.profile && <ProfileStrip profile={receipt.profile} />}

          {/* Layer summary */}
          <div className="grid grid-cols-3 border border-[var(--color-border)] mb-8">
            <Stat
              label="behavioral"
              value={receipt.layer1Score.toString()}
              suffix="/100"
            />
            <Stat
              label="penalties"
              value={(receipt.layer2Penalty || 0).toString()}
              suffix="pts"
              tone={receipt.layer2Penalty < 0 ? "danger" : "muted"}
            />
            <Stat
              label="final"
              value={receipt.finalScore.toString()}
              suffix="/100"
              tone="accent"
            />
          </div>

          {/* Factors */}
          <Section title="factors">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest">
                  <th className="text-left py-2 px-3 font-normal">signal</th>
                  <th className="text-left py-2 px-3 font-normal">observed</th>
                  <th className="text-right py-2 px-3 font-normal">sub</th>
                  <th className="text-right py-2 px-3 font-normal">weight</th>
                  <th className="text-right py-2 px-3 font-normal">contrib</th>
                </tr>
              </thead>
              <tbody>
                {receipt.factors.map((f) => (
                  <tr
                    key={f.key}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="py-3 px-3">
                      <div>{f.label}</div>
                      {f.note && (
                        <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">
                          {f.note}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[var(--color-text-dim)]">
                      {f.value}
                    </td>
                    <td className="py-3 px-3 text-right tabular">
                      {f.status === "skipped" ? (
                        <span className="text-[var(--color-text-faint)]">—</span>
                      ) : (
                        f.subScore
                      )}
                    </td>
                    <td className="py-3 px-3 text-right tabular text-[var(--color-text-faint)]">
                      {f.weight}
                    </td>
                    <td className="py-3 px-3 text-right tabular text-[var(--color-accent)]">
                      +{f.contribution.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Funder chain */}
          {receipt.funderChain && receipt.funderChain.length > 1 && (
            <Section title="funder chain">
              <FunderChain chain={receipt.funderChain} />
            </Section>
          )}

          {/* Trading activity heatmap */}
          {receipt.activity && receipt.activity.max > 0 && (
            <Section title="trading activity · 90d">
              <ActivityHeatmapView activity={receipt.activity} />
            </Section>
          )}

          {/* Penalties */}
          <Section title="penalties">
            {receipt.penalties.length === 0 ? (
              <div className="font-mono text-sm text-[var(--color-text-faint)] py-4 px-3">
                no trust penalties triggered
              </div>
            ) : (
              <table className="w-full font-mono text-sm">
                <tbody>
                  {receipt.penalties.map((p) => (
                    <tr
                      key={p.key}
                      className="border-t border-[var(--color-border)]"
                    >
                      <td className="py-3 px-3">
                        <div>{p.label}</div>
                        {p.evidence && (
                          <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">
                            {p.evidence}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right tabular text-[var(--color-danger)]">
                        {p.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Notes */}
          {receipt.meta.notes.length > 0 && (
            <div className="mt-8 font-mono text-xs text-[var(--color-text-faint)] space-y-1">
              {receipt.meta.notes.map((n, i) => (
                <div key={i}>· {n}</div>
              ))}
            </div>
          )}

          {/* Compare CTA */}
          <CompareCTA wallet={receipt.walletAddress} />

          {/* Embed snippet */}
          <EmbedSnippet wallet={receipt.walletAddress} />
        </>
    </div>
  );
}

function CompareCTA({ wallet }: { wallet: string }) {
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    const v = other.trim();
    // Same address validator as the home input. Cheap to inline-validate here.
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) {
      setError("not a valid solana address");
      return;
    }
    if (v === wallet) {
      setError("can't compare a wallet to itself");
      return;
    }
    setError(null);
    setSubmitting(true);
    window.location.href = `/compare/${wallet}/${v}`;
  }

  return (
    <div className="mt-12">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-2 px-1">
        compare with another wallet
      </div>
      <div
        className={`border bg-[var(--color-surface)] flex transition-colors ${
          submitting ? "border-[var(--color-accent)]" : "border-[var(--color-border-strong)]"
        }`}
      >
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="paste a second solana wallet"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={submitting}
          className="flex-1 px-4 py-3 bg-transparent font-mono text-sm outline-none placeholder:text-[var(--color-text-faint)] disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={submitting}
          className="px-5 py-3 font-mono text-xs uppercase tracking-widest border-l border-[var(--color-border)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg)] transition-colors disabled:cursor-wait min-w-[120px]"
        >
          {submitting ? "comparing…" : "compare →"}
        </button>
      </div>
      <div className="h-5 mt-2 font-mono text-xs">
        {error ? (
          <span className="text-[var(--color-danger)]">{error}</span>
        ) : (
          <span className="text-[var(--color-text-faint)]">
            side-by-side scores · detects shared funders
          </span>
        )}
      </div>
    </div>
  );
}

function EmbedSnippet({ wallet }: { wallet: string }) {
  const [copied, setCopied] = useState(false);

  function origin(): string {
    if (typeof window !== "undefined") return window.location.origin;
    return "https://www.stableboy.fun";
  }

  const html = `<a href="${origin()}/w/${wallet}"><img src="${origin()}/w/${wallet}/badge.svg" alt="Stable Boy score" width="600" height="140" /></a>`;
  const md = `[![Stable Boy score](${origin()}/w/${wallet}/badge.svg)](${origin()}/w/${wallet})`;
  const [mode, setMode] = useState<"html" | "md">("html");
  const snippet = mode === "html" ? html : md;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
          embed this score
        </div>
        <div className="flex border border-[var(--color-border)] font-mono text-[10px] uppercase tracking-widest">
          {(["html", "md"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 transition-colors ${
                mode === m
                  ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Badge preview */}
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/w/${wallet}/badge.svg`}
          alt="Stable Boy score badge preview"
          width={600}
          height={140}
          className="block max-w-full h-auto"
        />
      </div>

      {/* Copyable snippet */}
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] flex items-stretch">
        <pre className="flex-1 p-3 font-mono text-xs text-[var(--color-text-dim)] overflow-x-auto leading-relaxed select-all">
          {snippet}
        </pre>
        <button
          onClick={copy}
          className="px-5 font-mono text-xs uppercase tracking-widest border-l border-[var(--color-border)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg)] transition-colors min-w-[100px]"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <div className="mt-2 font-mono text-[10px] text-[var(--color-text-faint)] uppercase tracking-widest">
        paste in twitter bio · github readme · discord profile
      </div>
    </div>
  );
}

function ActivityHeatmapView({ activity }: { activity: ActivityHeatmap }) {
  // Build a flat array of cells in column-major order (week-by-week, top to bottom).
  const startMs = new Date(activity.startDate + "T00:00:00Z").getTime();
  const cells: Array<{ date: string; count: number; weekIndex: number; dayIndex: number }> = [];

  for (let w = 0; w < activity.weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const offsetMs = (w * 7 + d) * 86400 * 1000;
      const date = new Date(startMs + offsetMs).toISOString().slice(0, 10);
      const count = activity.daily[date] ?? 0;
      cells.push({ date, count, weekIndex: w, dayIndex: d });
    }
  }

  function bucket(count: number): number {
    if (count === 0) return 0;
    const ratio = count / activity.max;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  const colors = [
    "rgba(255,255,255,0.04)", // 0
    "rgba(124,212,176,0.18)", // 1 — pale mint
    "rgba(124,212,176,0.40)", // 2
    "rgba(124,212,176,0.70)", // 3
    "rgba(124,212,176,1.0)",  // 4 — full mint
  ];

  // Compute total + last-30d totals for the legend strip.
  const totalLast30 = Object.entries(activity.daily)
    .filter(([d]) => {
      const ms = new Date(d + "T00:00:00Z").getTime();
      return Date.now() - ms <= 30 * 86400 * 1000;
    })
    .reduce((s, [, v]) => s + v, 0);
  const totalAll = Object.values(activity.daily).reduce((s, v) => s + v, 0);

  return (
    <div className="px-3 py-4">
      <div className="flex items-end gap-[3px] mb-3 overflow-x-auto pb-1">
        {Array.from({ length: activity.weeks }).map((_, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = cells[wi * 7 + di];
              const b = bucket(cell.count);
              return (
                <div
                  key={di}
                  title={`${cell.date} · ${cell.count} txn${cell.count === 1 ? "" : "s"}`}
                  className="w-3 h-3"
                  style={{ background: colors[b] }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
        <div>
          <span>{totalAll}</span> txns / 90d ·{" "}
          <span className="text-[var(--color-text-dim)]">{totalLast30}</span> in last 30d
        </div>
        <div className="flex items-center gap-1">
          <span>less</span>
          {colors.map((c, i) => (
            <span key={i} className="w-3 h-3" style={{ background: c }} />
          ))}
          <span>more</span>
        </div>
      </div>
    </div>
  );
}

function FunderChain({ chain }: { chain: FunderHopReceipt[] }) {
  // Hop 0 is the scored wallet itself. Show hops as a vertical sequence.
  return (
    <table className="w-full font-mono text-sm">
      <thead>
        <tr className="text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest">
          <th className="text-left py-2 px-3 font-normal">hop</th>
          <th className="text-left py-2 px-3 font-normal">address</th>
          <th className="text-left py-2 px-3 font-normal">label</th>
          <th className="text-right py-2 px-3 font-normal">funded with</th>
        </tr>
      </thead>
      <tbody>
        {chain.map((h, i) => {
          const labelTone =
            h.entityKind === "cex"
              ? "text-[var(--color-accent)]"
              : h.entityKind === "protocol" || h.entityKind === "fund"
                ? "text-[var(--color-text)]"
                : "text-[var(--color-text-faint)]";
          const labelText =
            h.entityName ??
            (h.entityKind === "unknown" ? "—" : h.entityKind);
          return (
            <tr
              key={`${h.wallet}-${i}`}
              className={`border-t border-[var(--color-border)] ${
                h.flagged ? "bg-[rgba(212,128,111,0.06)]" : ""
              }`}
            >
              <td className="py-3 px-3 text-[var(--color-text-faint)] tabular">
                {i === 0 ? "self" : `+${i}`}
              </td>
              <td className="py-3 px-3">
                <span className="break-all">{shortAddrLong(h.wallet)}</span>
                {h.flagged && (
                  <span className="ml-2 text-[10px] uppercase tracking-widest text-[var(--color-danger)]">
                    flagged
                  </span>
                )}
              </td>
              <td className={`py-3 px-3 ${labelTone}`}>{labelText}</td>
              <td className="py-3 px-3 text-right tabular text-[var(--color-text-dim)]">
                {h.fundAmountSol !== null
                  ? `${h.fundAmountSol.toFixed(2)} SOL`
                  : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function shortAddrLong(a: string): string {
  return a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-8)}` : a;
}

function ProfileStrip({ profile }: { profile: WalletProfile }) {
  // Backward-compat for old cached receipts that pre-date per-period stats.
  const hasPeriods = profile.periods != null;
  const [period, setPeriod] = useState<ProfilePeriod>("30d");

  const periodStats = hasPeriods
    ? profile.periods[period]
    : {
        // Fallback shape: legacy receipts had flat fields. Cast loosely.
        realizedPnlUsd: (profile as unknown as { realizedPnlUsd?: number }).realizedPnlUsd ?? 0,
        totalRevenueUsd: (profile as unknown as { totalRevenueUsd?: number }).totalRevenueUsd ?? 0,
        totalSpentUsd: (profile as unknown as { totalSpentUsd?: number }).totalSpentUsd ?? 0,
      };

  const cells: Array<{
    label: string;
    value: string;
    tone: "pos" | "neg" | "neutral" | "muted";
  }> = [
    {
      label: "realized pnl",
      value: formatUsd(periodStats.realizedPnlUsd, true),
      tone: signTone(periodStats.realizedPnlUsd),
    },
    {
      label: "unrealized pnl",
      value: profile.unrealizedPnlUsd === null
        ? "—"
        : formatUsd(profile.unrealizedPnlUsd, true),
      tone: profile.unrealizedPnlUsd === null
        ? "muted"
        : signTone(profile.unrealizedPnlUsd),
    },
    {
      label: "total revenue",
      value: formatUsd(periodStats.totalRevenueUsd, false),
      tone: "neutral",
    },
    {
      label: "total spent",
      value: formatUsd(periodStats.totalSpentUsd, false),
      tone: "neutral",
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
          wallet profile
        </div>
        {hasPeriods && (
          <div className="flex border border-[var(--color-border)] font-mono text-[10px] uppercase tracking-widest">
            {(["1d", "7d", "30d"] as ProfilePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 transition-colors ${
                  period === p
                    ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                    : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[var(--color-border)]">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={`px-4 py-4 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b md:border-b-0" : ""} md:border-r last:md:border-r-0 border-[var(--color-border)]`}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-1.5">
              {c.label}
            </div>
            <div
              className={`font-mono font-medium text-xl tabular ${
                c.tone === "pos"
                  ? "text-[var(--color-accent)]"
                  : c.tone === "neg"
                    ? "text-[var(--color-danger)]"
                    : c.tone === "muted"
                      ? "text-[var(--color-text-faint)]"
                      : "text-[var(--color-text)]"
              }`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function signTone(n: number): "pos" | "neg" | "neutral" {
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "neutral";
}

function formatUsd(n: number, signed: boolean): string {
  const abs = Math.abs(n);
  let body: string;
  if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) body = `$${(abs / 1_000).toFixed(2)}K`;
  else body = `$${abs.toFixed(2)}`;

  if (!signed) return body;
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

function BackLink() {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors mb-6"
    >
      <span aria-hidden>←</span>
      <span>back</span>
    </a>
  );
}

function InsufficientDataView({ receipt }: { receipt: ReceiptType }) {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <BackLink />
      <div className="flex items-baseline justify-between mb-12 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
            wallet
          </div>
          <div className="font-mono text-sm break-all">{receipt.walletAddress}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
            scored
          </div>
          <div className="font-mono text-xs text-[var(--color-text-dim)]">
            {new Date(receipt.scoredAt).toISOString().slice(0, 19).replace("T", " ")}Z
          </div>
        </div>
      </div>

      <div className="border border-[var(--color-border-strong)] p-8 sm:p-10">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-warn)] mb-4">
          not enough rope
        </div>
        <div className="text-2xl sm:text-3xl text-[var(--color-text)] leading-snug mb-6">
          we don&apos;t have enough on-chain history to score this wallet honestly.
        </div>
        <div className="text-[var(--color-text-dim)] mb-8 leading-relaxed">
          Stable Boy looks at pump.fun and Solana memecoin behavior. If a wallet
          hasn&apos;t traded memecoins recently — even if it&apos;s old or active in
          other ways — we deliberately refuse to fake a number.
        </div>

        {receipt.meta.notes.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-6 font-mono text-xs text-[var(--color-text-dim)] space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-3">
              what we found
            </div>
            {receipt.meta.notes.map((n, i) => (
              <div key={i}>· {n}</div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:underline"
        >
          ← score another wallet
        </a>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone = "default",
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "default" | "accent" | "danger" | "muted";
}) {
  const color =
    tone === "accent"
      ? "text-[var(--color-accent)]"
      : tone === "danger"
        ? "text-[var(--color-danger)]"
        : tone === "muted"
          ? "text-[var(--color-text-dim)]"
          : "text-[var(--color-text)]";
  return (
    <div className="px-4 py-3 border-r last:border-r-0 border-[var(--color-border)]">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
        {label}
      </div>
      <div className={`font-mono font-medium text-2xl tabular ${color}`}>
        {value}
        {suffix && (
          <span className="text-xs text-[var(--color-text-faint)] ml-1 font-normal">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-2 px-1">
        {title}
      </div>
      <div className="border border-[var(--color-border)] overflow-x-auto">{children}</div>
    </div>
  );
}

function ShareBar({
  receipt,
  className = "",
  vertical = false,
}: {
  receipt: ReceiptType;
  className?: string;
  /** When true: side-by-side on mobile, stacked vertically on md+. */
  vertical?: boolean;
}) {
  const score = receipt.finalScore;
  const verdict = verdictLabel(receipt.verdict).toLowerCase();
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text =
    score >= 80
      ? `${score}/100. ${verdict}. ${verdictTagline(receipt.verdict)}.`
      : score >= 50
        ? `${score}/100. ${verdict}. accurate.`
        : `${score}/100. they said "${verdict}". i'm not denying it.`;
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} score yours →`)}&url=${encodeURIComponent(url)}`;

  const layout = vertical ? "flex flex-row md:flex-col" : "flex flex-row";

  return (
    <div className={`${layout} gap-3 font-mono text-xs ${className}`}>
      <a
        href={tweet}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-3 border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] uppercase tracking-widest transition-colors text-center md:whitespace-nowrap"
      >
        share on x →
      </a>
      <a
        href="/"
        className="px-5 py-3 border border-[var(--color-border)] hover:border-[var(--color-text-dim)] uppercase tracking-widest transition-colors text-[var(--color-text-dim)] text-center md:whitespace-nowrap"
      >
        score another wallet
      </a>
    </div>
  );
}
