"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "querying wallet stats",
  "pulling 30d / 7d / 1d windows",
  "fetching current holdings",
  "scanning pump.fun bundles",
  "computing layer 1 score",
  "applying trust penalties",
];

export default function Loading() {
  const [i, setI] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const phraseTick = setInterval(
      () => setI((x) => (x + 1) % PHRASES.length),
      1800,
    );
    const dotTick = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => {
      clearInterval(phraseTick);
      clearInterval(dotTick);
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <a
        href="/"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        <span aria-hidden>←</span>
        <span>back</span>
      </a>

      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] py-14 px-6 sm:px-10 text-center mb-8">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-5">
          scoring
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
          first score takes ~10s · cached for 24h after
        </div>
      </div>

      {/* Skeleton silhouettes hinting at the receipt that's coming */}
      <div className="space-y-6 opacity-30">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[80px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`border border-[var(--color-border)] bg-[var(--color-surface-2)] animate-pulse ${className}`}
    />
  );
}
