import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Stable Boy — wallet stability score for Solana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a0b";
const TEXT = "#ededee";
const TEXT_DIM = "#888890";
const TEXT_FAINT = "#55555a";
const ACCENT = "#7cd4b0";

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

export default async function Image() {
  const [interReg, interMed, monoReg, monoMed] = await Promise.all([
    loadFont("Inter", 400),
    loadFont("Inter", 500),
    loadFont("JetBrains Mono", 400),
    loadFont("JetBrains Mono", 500),
  ]);

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
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: "JetBrains Mono",
            fontSize: 22,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ width: 14, height: 14, background: ACCENT }} />
          <div>stable boy</div>
        </div>

        {/* Hero */}
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
              marginBottom: 32,
            }}
          >
            stability score · solana
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>are you holding,</span>
            <span>chasing,</span>
            <span style={{ color: TEXT_DIM }}>or bundling?</span>
          </div>
        </div>

        {/* Footer */}
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
          <div>paste a wallet · get a 0–100 score</div>
          <div style={{ color: ACCENT }}>stableboy.fun</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: interReg, weight: 400 },
        { name: "Inter", data: interMed, weight: 500 },
        { name: "JetBrains Mono", data: monoReg, weight: 400 },
        { name: "JetBrains Mono", data: monoMed, weight: 500 },
      ],
    },
  );
}
