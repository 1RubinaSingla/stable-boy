import { notFound, redirect } from "next/navigation";
import { CompareView } from "@/components/CompareView";
import { getOrComputeReceipt } from "@/lib/scoring/compute";
import { isValidSolanaAddress } from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PageProps {
  params: Promise<{ a: string; b: string }>;
}

export default async function ComparePage({ params }: PageProps) {
  const { a, b } = await params;
  if (!isValidSolanaAddress(a) || !isValidSolanaAddress(b)) notFound();
  if (a === b) redirect(`/w/${a}`);

  const [receiptA, receiptB] = await Promise.all([
    getOrComputeReceipt(a),
    getOrComputeReceipt(b),
  ]);

  if (receiptA === "error" || receiptB === "error") {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-danger)] mb-3">
            could not score one or both wallets
          </div>
          <div className="text-[var(--color-text-dim)] mb-6">
            Either an upstream API failed or one of these wallets has too
            little on-chain history.
          </div>
          <a
            href="/"
            className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:underline"
          >
            ← back to home
          </a>
        </div>
      </div>
    );
  }

  return <CompareView a={receiptA} b={receiptB} />;
}
