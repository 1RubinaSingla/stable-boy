import type { Metadata } from "next";
import Link from "next/link";
import { PENALTY_AMOUNTS, WEIGHTS } from "@/lib/scoring/weights";

export const metadata: Metadata = {
  title: "How it works — Stable Boy",
  description:
    "The exact factors, weights, and penalties that produce a Stable Boy stability score. No hand-waving.",
};

interface FactorRow {
  key: keyof typeof WEIGHTS;
  label: string;
  source: string;
  curve: string;
}

const FACTORS: FactorRow[] = [
  {
    key: "hold_duration",
    label: "Hold duration",
    source: "GMGN wallet_stats.avg_holding_period",
    curve: "<2min → 0 · 2-10min → 20 · 10min-1h → 40 · 1-6h → 60 · 6-24h → 75 · 1-7d → 88 · >7d → 100",
  },
  {
    key: "paperhand_ratio",
    label: "Paperhand ratio",
    source: "FIFO entry/exit pairing on wallet_activity",
    curve: ">80% → 0 · 60-80% → 15 · 40-60% → 35 · 20-40% → 60 · 5-20% → 85 · <5% → 100",
  },
  {
    key: "funding_source",
    label: "Funding source",
    source: "GMGN fund_from_address + Helius CEX/protocol labels",
    curve: "direct CEX → 100 · 1 hop CEX → 85 · fund/protocol → 75 · 3+ hops → 60 · no funder → 50 · small (<0.5 SOL) → 35 · daisy-chain → 25 · flagged funder → 0",
  },
  {
    key: "wallet_age",
    label: "Wallet age",
    source: "GMGN common.created_at",
    curve: "<7d → 20 · 7-30d → 45 · 30-180d → 75 · >180d → 100",
  },
  {
    key: "pnl_behavior",
    label: "PnL behavior",
    source: "GMGN buy/sell count ratio",
    curve: "ratio>3 (dumpy) → 30 · >1.5 → 55 · >0.7 → 80 · ≤0.7 (hoarder) → 70",
  },
  {
    key: "token_diversity",
    label: "Token diversity",
    source: "GMGN pnl_stat.token_num / 30d",
    curve: ">20/day → 15 · 10-20 → 35 · 3-10 → 65 · 1-3 → 85 · <1 + held >24h → 100 · <1 + single token → 60",
  },
  {
    key: "win_loss_distribution",
    label: "Win/loss distribution",
    source: "GMGN PnL buckets (5 ranges)",
    curve: "insider-shape (mostly moons, few losses) → 20 · pure chaser (≥85% losses) → 30 · healthy human → 100 · noisy → 60",
  },
  {
    key: "sol_balance_consistency",
    label: "SOL balance",
    source: "GMGN native_balance (snapshot)",
    curve: ">5 SOL idle → 90 · 1-5 → 70 · 0.1-1 → 50 · <0.1 → 25",
  },
];

interface PenaltyRow {
  key: keyof typeof PENALTY_AMOUNTS;
  label: string;
  trigger: string;
  source: string;
}

const PENALTIES: PenaltyRow[] = [
  {
    key: "bundle_co_buy",
    label: "Bundle co-buy",
    trigger: "Wallet bought a pump.fun token in the same slot as ≥3 distinct signers buying the same mint",
    source: "Bitquery same-slot multi-signer scan",
  },
  {
    key: "sniper_window",
    label: "Sniper window",
    trigger: "Wallet bought a token within 3 blocks of its first pump.fun trade",
    source: "Bitquery earliest-trade-per-mint aggregation",
  },
  {
    key: "cluster_one_hop",
    label: "Cluster · 1 hop",
    trigger: "Wallet's immediate funder appears in our bundler registry",
    source: "Funder traversal × bundler_taglog (accumulated from token_top_traders)",
  },
  {
    key: "cluster_two_hop",
    label: "Cluster · 2 hops",
    trigger: "Wallet's funder's funder appears in the registry",
    source: "Same as 1-hop, one level deeper",
  },
  {
    key: "funding_daisy_chain",
    label: "Funding daisy-chain",
    trigger: "3+ intermediate wallets, each funded within 24h of its own creation",
    source: "Funder chain age inspection",
  },
  {
    key: "wash_trade",
    label: "Wash trade",
    trigger: "≥3 tokens with multiple opposite-side trades within 10 minutes of each other",
    source: "Round-trip pattern detector on wallet_activity",
  },
  {
    key: "dormant_coordinated",
    label: "Dormant-then-coordinated",
    trigger: "Long inactivity then a burst of buys matching a known cluster's timing",
    source: "v3 — not yet implemented",
  },
];

export default function HowPage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        <span aria-hidden>←</span>
        <span>back</span>
      </Link>

      <div className="border-b border-[var(--color-border)] pb-6 mb-10">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] mb-3">
          methodology
        </div>
        <h1 className="text-3xl sm:text-4xl font-light leading-tight tracking-tight mb-4">
          how the score works.
        </h1>
        <p className="text-[var(--color-text-dim)] leading-relaxed max-w-2xl">
          Every Stable Boy score is the same formula. No hand-tuning, no
          allow-listing, no leaderboard rigging. Here&apos;s the entire
          algorithm in one page.
        </p>
      </div>

      {/* Architecture */}
      <Section title="architecture">
        <p className="text-[var(--color-text-dim)] leading-relaxed mb-3">
          Two layers, computed separately.
        </p>
        <ul className="space-y-2 font-mono text-sm text-[var(--color-text-dim)] mb-4 list-none pl-0">
          <li>
            <span className="text-[var(--color-accent)]">layer 1</span> ·
            behavioral score (0–100). Weighted average of eight factors that
            describe how the wallet <em>trades</em>.
          </li>
          <li>
            <span className="text-[var(--color-accent)]">layer 2</span> ·
            trust penalties (cap −60). Hard deductions for cluster, bundle,
            sniper, daisy-chain, and wash patterns.
          </li>
          <li>
            <span className="text-[var(--color-accent)]">final</span> ·
            clamp(layer1 + layer2, 0, 100)
          </li>
        </ul>
        <div className="font-mono text-xs text-[var(--color-text-faint)]">
          wallets with &lt;5 lifetime trades AND &lt;3 lifetime tokens return{" "}
          <code className="text-[var(--color-text-dim)]">insufficient_data</code>{" "}
          instead of a faked score.
        </div>
      </Section>

      {/* Layer 1 factors */}
      <Section title="layer 1 · factors">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full font-mono text-sm border-collapse">
            <thead>
              <tr className="text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-2 font-normal">signal</th>
                <th className="text-right py-3 px-2 font-normal">weight</th>
                <th className="text-left py-3 px-2 font-normal">source</th>
              </tr>
            </thead>
            <tbody>
              {FACTORS.map((f) => (
                <tr
                  key={f.key}
                  className="border-b border-[var(--color-border)] align-top"
                >
                  <td className="py-3 px-2 text-[var(--color-text)] whitespace-nowrap">
                    {f.label}
                  </td>
                  <td className="py-3 px-2 text-right text-[var(--color-accent)] tabular">
                    {WEIGHTS[f.key]}
                  </td>
                  <td className="py-3 px-2 text-[var(--color-text-dim)] text-xs">
                    <div>{f.source}</div>
                    <div className="text-[var(--color-text-faint)] mt-1">
                      {f.curve}
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-3 px-2 text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest">
                  total
                </td>
                <td className="py-3 px-2 text-right text-[var(--color-text)] tabular">
                  {Object.values(WEIGHTS).reduce((a, b) => a + b, 0)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Layer 2 penalties */}
      <Section title="layer 2 · penalties">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full font-mono text-sm border-collapse">
            <thead>
              <tr className="text-[var(--color-text-faint)] uppercase text-[10px] tracking-widest border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-2 font-normal">flag</th>
                <th className="text-right py-3 px-2 font-normal">penalty</th>
                <th className="text-left py-3 px-2 font-normal">trigger · source</th>
              </tr>
            </thead>
            <tbody>
              {PENALTIES.map((p) => (
                <tr
                  key={p.key}
                  className="border-b border-[var(--color-border)] align-top"
                >
                  <td className="py-3 px-2 text-[var(--color-text)] whitespace-nowrap">
                    {p.label}
                  </td>
                  <td className="py-3 px-2 text-right text-[var(--color-danger)] tabular">
                    {PENALTY_AMOUNTS[p.key]}
                  </td>
                  <td className="py-3 px-2 text-[var(--color-text-dim)] text-xs">
                    <div>{p.trigger}</div>
                    <div className="text-[var(--color-text-faint)] mt-1">
                      {p.source}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 font-mono text-xs text-[var(--color-text-faint)] space-y-1">
          <div>· bundle co-buy capped at −40 (max 2 bundles count)</div>
          <div>· sniper window capped at −20 (max 4 sniped tokens count)</div>
          <div>· total layer-2 capped at −60 so penalties can&apos;t exceed half the score</div>
        </div>
      </Section>

      {/* Verdict bands */}
      <Section title="verdict bands">
        <table className="w-full font-mono text-sm">
          <tbody>
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-3 px-2 text-[var(--color-accent)] w-24 tabular">80–100</td>
              <td className="py-3 px-2">Diamond hands</td>
              <td className="py-3 px-2 text-[var(--color-text-dim)] text-xs">
                real user, holds, clean cluster
              </td>
            </tr>
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-3 px-2 text-[var(--color-text)] w-24 tabular">50–79</td>
              <td className="py-3 px-2">Active trader</td>
              <td className="py-3 px-2 text-[var(--color-text-dim)] text-xs">
                legit but rotates fast
              </td>
            </tr>
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-3 px-2 text-[var(--color-warn)] w-24 tabular">20–49</td>
              <td className="py-3 px-2">Degen / sniper</td>
              <td className="py-3 px-2 text-[var(--color-text-dim)] text-xs">
                high velocity, low conviction
              </td>
            </tr>
            <tr>
              <td className="py-3 px-2 text-[var(--color-danger)] w-24 tabular">0–19</td>
              <td className="py-3 px-2">Bundler-adjacent</td>
              <td className="py-3 px-2 text-[var(--color-text-dim)] text-xs">
                clustered, suspicious funding, instant dumps
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Data sources */}
      <Section title="data sources">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-sm">
          <div className="border border-[var(--color-border)] p-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-2">
              gmgn
            </div>
            <div className="text-[var(--color-text-dim)] text-xs leading-relaxed">
              wallet_stats (1d / 7d / 30d) · wallet_holdings ·
              wallet_activity · token_top_traders
            </div>
          </div>
          <div className="border border-[var(--color-border)] p-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-2">
              bitquery
            </div>
            <div className="text-[var(--color-text-dim)] text-xs leading-relaxed">
              pump.fun bundle co-buy detection · earliest-trade-per-mint
              aggregation for sniper-window flag
            </div>
          </div>
          <div className="border border-[var(--color-border)] p-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-2">
              helius
            </div>
            <div className="text-[var(--color-text-dim)] text-xs leading-relaxed">
              entity labels for funder addresses (CEX, protocol, fund) ·
              powers the +13 &ldquo;direct from CEX&rdquo; boost
            </div>
          </div>
        </div>
      </Section>

      {/* Limitations */}
      <Section title="limitations we&apos;re honest about">
        <ul className="space-y-3 text-[var(--color-text-dim)] text-sm leading-relaxed">
          <li className="flex gap-3">
            <span className="text-[var(--color-text-faint)]">·</span>
            <span>
              Score is based on the last <strong>30 days</strong> of GMGN
              data — wallets dormant in that window may score
              insufficient-data even if historically active.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--color-text-faint)]">·</span>
            <span>
              Cluster penalties depend on a self-grown bundler registry. Every
              wallet scored teaches the next one — early scores have weaker
              cluster signal than later scores.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--color-text-faint)]">·</span>
            <span>
              Wash-trade detector catches a wallet self-churning a token.
              Cross-wallet wash (where the counterparty is another wallet of
              yours) needs deeper tx-level inspection — flagged as v3.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--color-text-faint)]">·</span>
            <span>
              SOL balance uses a snapshot, not a time series. A wallet that
              just received SOL looks identical to one that&apos;s held SOL
              for months.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--color-text-faint)]">·</span>
            <span>
              Stable Boy is pump.fun / memecoin focused. Wallets that
              primarily trade Jupiter or non-pump tokens will look small
              through this lens.
            </span>
          </li>
        </ul>
      </Section>

      <div className="mt-12 font-mono text-xs text-[var(--color-text-faint)] uppercase tracking-widest">
        stability scores are a heuristic, not a verdict · cache TTL 24h
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] mb-3 px-1">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
