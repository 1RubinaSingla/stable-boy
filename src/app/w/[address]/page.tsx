import { notFound } from "next/navigation";
import { Receipt } from "@/components/Receipt";
import { getOrComputeReceipt } from "@/lib/scoring/compute";
import { isValidSolanaAddress } from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PageProps {
  params: Promise<{ address: string }>;
}

export default async function ReceiptPage({ params }: PageProps) {
  const { address } = await params;
  if (!isValidSolanaAddress(address)) notFound();

  const receipt = await getOrComputeReceipt(address);

  if (receipt === "error") {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-danger)] mb-3">
            could not score
          </div>
          <div className="text-[var(--color-text-dim)] mb-6">
            Either the upstream API is down or this wallet doesn&apos;t have
            enough on-chain history yet.
          </div>
          <a
            href="/"
            className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:underline"
          >
            ← try another wallet
          </a>
        </div>
      </div>
    );
  }

  return <Receipt receipt={receipt} />;
}
