"use client";

import { useEffect, useState } from "react";
import { clearRecent, getRecent } from "@/lib/recent";

function shortAddr(s: string): string {
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-6)}` : s;
}

export function RecentWallets() {
  const [items, setItems] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(getRecent());
    setHydrated(true);
  }, []);

  if (!hydrated || items.length === 0) return null;

  function onClear() {
    clearRecent();
    setItems([]);
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)]">
          recently scored
        </div>
        <button
          onClick={onClear}
          className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] hover:text-[var(--color-danger)] transition-colors"
        >
          clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2 font-mono text-xs">
        {items.map((addr) => (
          <a
            key={addr}
            href={`/w/${addr}`}
            className="px-3 py-1.5 border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            title={addr}
          >
            {shortAddr(addr)}
          </a>
        ))}
      </div>
    </div>
  );
}
