import { ImageResponse } from "next/og";
import type { Receipt } from "@/lib/scoring/types";
import { verdictLabel, verdictTagline } from "@/lib/scoring/verdict";

export const runtime = "edge";
export const alt = "Stable Boy — wallet stability score";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a0b";
const SURFACE = "#111114";
const TEXT = "#ededee";
const TEXT_DIM = "#888890";
const TEXT_FAINT = "#55555a";
const ACCENT = "#7cd4b0";
const DANGER = "#d4806f";
const WARN = "#d4b56f";

function scoreColor(score: number, verdict: string): string {
  if (verdict === "insufficient_data") return TEXT_DIM;
  if (score >= 80) return ACCENT;
  if (score >= 50) return TEXT;
  if (score >= 20) return WARN;
  return DANGER;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a;
}

async function loadFont(family: string, weight: number) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weight}&display=swap`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  ).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('woff2'\)/)?.[1];
  if (!url) throw new Error(`font url not found: ${family} ${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

async function fetchCachedReceipt(address: string): Promise<Receipt | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/scored_wallets?wallet_address=eq.${encodeURIComponent(address)}&select=receipt&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ receipt: Receipt }>;
    return rows[0]?.receipt ?? null;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const [receipt, interReg, interMed, monoReg, monoMed] = await Promise.all([
    fetchCachedReceipt(address),
    loadFont("Inter", 400),
    loadFont("Inter", 500),
    loadFont("JetBrains Mono", 400),
    loadFont("JetBrains Mono", 500),
  ]);

  const fonts = [
    { name: "Inter" as const, data: interReg, weight: 400 as const },
    { name: "Inter" as const, data: interMed, weight: 500 as const },
    { name: "JetBrains Mono" as const, data: monoReg, weight: 400 as const },
    { name: "JetBrains Mono" as const, data: monoMed, weight: 500 as const },
  ];

  // No cache → render a "score this wallet" prompt card.
  if (!receipt) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: BG,
            color: TEXT,
            display: "flex",
            flexDirection: "column",
            padding: "60px 70px",
            fontFamily: "Inter",
          }}
        >
          <Brand />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 18,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: ACCENT,
                marginBottom: 24,
              }}
            >
              stability score
            </div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              score this wallet
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 26,
                color: TEXT_DIM,
                marginTop: 32,
              }}
            >
              {shortAddr(address)}
            </div>
          </div>
          <Footer />
        </div>
      ),
      { ...size, fonts },
    );
  }

  // Real receipt
  const isInsufficient = receipt.verdict === "insufficient_data";
  const color = scoreColor(receipt.finalScore, receipt.verdict);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: TEXT,
          display: "flex",
          flexDirection: "column",
          padding: "60px 70px",
          fontFamily: "Inter",
        }}
      >
        <Brand />

        {/* Score + verdict row */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 64,
          }}
        >
          {/* Score number */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontWeight: 500,
                fontSize: 280,
                lineHeight: 1,
                color,
                letterSpacing: "-0.04em",
              }}
            >
              {isInsufficient ? "—" : receipt.finalScore}
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 18,
                color: TEXT_FAINT,
                letterSpacing: 3,
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              / 100 · stability score
            </div>
          </div>

          {/* Verdict */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderLeft: `1px solid ${SURFACE}`,
              paddingLeft: 56,
            }}
          >
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 22,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: ACCENT,
                marginBottom: 20,
              }}
            >
              {verdictLabel(receipt.verdict)}
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 400,
                lineHeight: 1.15,
                color: TEXT_DIM,
                letterSpacing: "-0.01em",
              }}
            >
              {verdictTagline(receipt.verdict)}
            </div>
          </div>
        </div>

        <Footer wallet={shortAddr(address)} />
      </div>
    ),
    { ...size, fonts },
  );
}

function Brand() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "JetBrains Mono",
        fontSize: 22,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: TEXT,
      }}
    >
      <div style={{ width: 14, height: 14, background: ACCENT }} />
      <div>stable boy</div>
    </div>
  );
}

function Footer({ wallet }: { wallet?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "JetBrains Mono",
        fontSize: 18,
        color: TEXT_FAINT,
        letterSpacing: 1,
      }}
    >
      <div>{wallet ? `wallet · ${wallet}` : "paste a wallet · get a 0–100 score"}</div>
      <div style={{ color: ACCENT }}>stableboy.fun</div>
    </div>
  );
}
