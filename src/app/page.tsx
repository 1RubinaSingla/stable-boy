import { RecentWallets } from "@/components/RecentWallets";
import { WalletInput } from "@/components/WalletInput";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] mb-6">
          stable boy · stability score
        </div>
        <h1 className="text-5xl md:text-6xl font-light leading-tight mb-6 tracking-tight">
          check your stability score
        </h1>
        <div className="text-xl md:text-2xl text-[var(--color-text-dim)] leading-snug mb-4">
          are you holding,
          <br />
          chasing,
          <br />
          <span className="text-[var(--color-text-faint)]">or bundling?</span>
        </div>
        <p className="text-sm text-[var(--color-text-faint)] mb-10 max-w-lg">
          One paste. One number. One receipt you&apos;ll either flex or cope with.
        </p>

        <WalletInput />

        <RecentWallets />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-px bg-[var(--color-border)] border border-[var(--color-border)]">
          {[
            { band: "80–100", label: "diamond" },
            { band: "50–79", label: "active" },
            { band: "20–49", label: "degen" },
            { band: "0–19", label: "bundler" },
          ].map((b) => (
            <div
              key={b.band}
              className="bg-[var(--color-bg)] px-4 py-4 font-mono text-xs"
            >
              <div className="text-[var(--color-text-faint)] uppercase tracking-widest text-[10px]">
                {b.band}
              </div>
              <div className="text-[var(--color-text)] mt-1">{b.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 font-mono text-xs text-[var(--color-text-faint)] leading-relaxed">
          we pull every transaction this wallet has signed and run it through
          eight behavioral checks plus a cluster scan. high score = legible. low
          score = pattern matches what bundlers, snipers, and bots usually do.
        </div>
      </div>
    </div>
  );
}
