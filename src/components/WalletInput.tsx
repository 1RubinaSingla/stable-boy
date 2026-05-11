"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidSolanaAddress } from "@/lib/wallet";

export function WalletInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    if (submitting) return;
    const v = value.trim();
    if (!isValidSolanaAddress(v)) {
      setError("not a valid solana address");
      return;
    }
    setError(null);
    setSubmitting(true);
    router.push(`/w/${v}`);
    // submitting state stays true until this component unmounts on navigation,
    // which is exactly what we want — keeps the button locked + shows feedback.
  }

  return (
    <div className="w-full max-w-2xl">
      <div
        className={`border bg-[var(--color-surface)] flex transition-colors ${
          submitting
            ? "border-[var(--color-accent)]"
            : "border-[var(--color-border-strong)]"
        }`}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="paste solana wallet address"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={submitting}
          className="flex-1 px-5 py-4 bg-transparent font-mono text-sm outline-none placeholder:text-[var(--color-text-faint)] disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={submitting}
          className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-[var(--color-bg)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] transition-colors disabled:cursor-wait inline-flex items-center gap-2 min-w-[120px] justify-center"
        >
          {submitting ? (
            <>
              <span className="w-3 h-3 border border-[var(--color-bg)] border-t-transparent rounded-full animate-spin" />
              <span>scoring</span>
            </>
          ) : (
            "score it"
          )}
        </button>
      </div>
      <div className="h-5 mt-2 font-mono text-xs">
        {error ? (
          <span className="text-[var(--color-danger)]">{error}</span>
        ) : submitting ? (
          <span className="text-[var(--color-accent)]">
            navigating to receipt…
          </span>
        ) : (
          <span className="text-[var(--color-text-faint)]">
            takes ~10 seconds · cached 24h · we don&apos;t store the address
          </span>
        )}
      </div>
    </div>
  );
}
