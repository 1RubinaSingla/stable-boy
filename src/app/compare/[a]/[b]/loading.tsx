"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "scoring both wallets in parallel",
  "pulling 30d / 7d / 1d windows",
  "tracing funder chains",
  "scanning pump.fun bundles",
  "checking shared funders",
  "computing factor deltas",
];

export default function Loading() {
  const [i, setI] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const p = setInterval(() => setI((x) => (x + 1) % PHRASES.length), 1800);
    const d = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => {
      clearInterval(p);
      clearInterval(d);
    };
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <a
        href="/"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        <span aria-hidden>←</span>
        <span>back</span>
      </a>

      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] py-14 px-6 sm:px-10 text-center mb-8">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-5">
          comparing
        </div>
        <div className="inline-flex items-center gap-3 font-mono text-sm">
          <span className="relative inline-block w-2 h-2">
            <span className="absolute inset-0 bg-[var(--color-accent)] animate-ping opacity-60" />
            <span className="absolute inset-0 bg-[var(--color-accent)]" />
          </span>
          <span className="text-[var(--color-text)] tabular">
            {PHRASES[i]}
            <span className="text-[var(--color-text-faint)]">
              {".".repeat(dots)}
              <span className="invisible">{".".repeat(3 - dots)}</span>
            </span>
          </span>
        </div>
        <div className="mt-5 font-mono text-xs text-[var(--color-text-faint)]">
          up to ~15s when both wallets need fresh scoring
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-30">
        <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] animate-pulse h-[180px]" />
        <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] animate-pulse h-[180px]" />
      </div>
    </div>
  );
}
