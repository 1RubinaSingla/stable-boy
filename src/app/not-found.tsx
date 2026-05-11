export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-3">
          404
        </div>
        <div className="text-2xl mb-6">that&apos;s not a wallet.</div>
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:underline"
        >
          ← back
        </a>
      </div>
    </div>
  );
}
