import type { Metadata } from "next";
import Link from "next/link";
import { verdictLabel } from "@/lib/scoring/verdict";
import type { Verdict } from "@/lib/scoring/types";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Leaderboard — Stable Boy",
  description:
    "Top diamond hands and worst bundlers caught in the last 7 days, ranked by Stable Boy stability score.",
};

interface Row {
  wallet_address: string;
  final_score: number;
  verdict: Verdict;
  scored_at: string;
}

const WINDOW_DAYS = 7;
const ROW_LIMIT = 20;

async function fetchBoards(): Promise<{
  diamonds: Row[];
  bundlers: Row[];
  totalScored: number;
}> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400 * 1000).toISOString();
  const client = supabase();

  const [diamondsRes, bundlersRes, countRes] = await Promise.all([
    client
      .from("scored_wallets")
      .select("wallet_address, final_score, verdict, scored_at")
      .gt("scored_at", since)
      .neq("verdict", "insufficient_data")
      .order("final_score", { ascending: false })
      .order("scored_at", { ascending: false })
      .limit(ROW_LIMIT),
    client
      .from("scored_wallets")
      .select("wallet_address, final_score, verdict, scored_at")
      .gt("scored_at", since)
      .neq("verdict", "insufficient_data")
      .order("final_score", { ascending: true })
      .order("scored_at", { ascending: false })
      .limit(ROW_LIMIT),
    client
      .from("scored_wallets")
      .select("wallet_address", { count: "exact", head: true })
      .gt("scored_at", since)
      .neq("verdict", "insufficient_data"),
  ]);

  return {
    diamonds: (diamondsRes.data as Row[]) ?? [],
    bundlers: (bundlersRes.data as Row[]) ?? [],
    totalScored: countRes.count ?? 0,
  };
}

function shortAddr(a: string): string {
  return a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-8)}` : a;
}

function scoreTone(score: number): string {
  if (score >= 80) return "text-[var(--color-accent)]";
  if (score >= 50) return "text-[var(--color-text)]";
  if (score >= 20) return "text-[var(--color-warn)]";
  return "text-[var(--color-danger)]";
}

function ago(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function LeaderboardPage() {
  const { diamonds, bundlers, totalScored } = await fetchBoards();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        <span aria-hidden>←</span>
        <span>back</span>
      </Link>

      <div className="border-b border-[var(--color-border)] pb-6 mb-10">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] mb-3">
          stable boy · leaderboard
        </div>
        <h1 className="text-3xl sm:text-4xl font-light leading-tight tracking-tight mb-3">
          who&apos;s holding, who&apos;s bundling.
        </h1>
        <div className="font-mono text-xs text-[var(--color-text-faint)] uppercase tracking-widest">
          last {WINDOW_DAYS} days · {totalScored} wallet
          {totalScored === 1 ? "" : "s"} scored
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Board
          title="diamond hands"
          subtitle="highest scores"
          rows={diamonds}
          emptyText="no wallets in this band yet — be the first."
        />
        <Board
          title="bundlers caught"
          subtitle="lowest scores"
          rows={bundlers}
          emptyText="no bundlers caught this week."
        />
      </div>

      <div className="mt-16 font-mono text-xs text-[var(--color-text-faint)] uppercase tracking-widest">
        leaderboard reflects only wallets scored on stableboy.fun in the
        last {WINDOW_DAYS} days · cache TTL 24h · refresh on each visit
      </div>
    </div>
  );
}

function Board({
  title,
  subtitle,
  rows,
  emptyText,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
          {title}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
          {subtitle}
        </div>
      </div>
      <div className="border border-[var(--color-border)]">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center font-mono text-xs text-[var(--color-text-faint)] uppercase tracking-widest">
            {emptyText}
          </div>
        ) : (
          rows.map((r, i) => (
            <Link
              key={r.wallet_address}
              href={`/w/${r.wallet_address}`}
              className="flex items-center gap-3 border-t first:border-t-0 border-[var(--color-border)] px-3 py-3 hover:bg-[var(--color-surface)] transition-colors group"
            >
              <div className="font-mono text-[10px] text-[var(--color-text-faint)] tabular w-6 text-right">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-[var(--color-text-dim)] group-hover:text-[var(--color-text)] truncate">
                  {shortAddr(r.wallet_address)}
                </div>
                <div className="font-mono text-[10px] text-[var(--color-text-faint)] uppercase tracking-widest mt-0.5">
                  {verdictLabel(r.verdict)} · {ago(r.scored_at)}
                </div>
              </div>
              <div
                className={`font-mono font-medium text-2xl tabular ${scoreTone(r.final_score)}`}
              >
                {r.final_score}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
