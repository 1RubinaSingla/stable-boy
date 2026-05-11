# Contributing to Stable Boy

Thanks for poking at the code. This is a small project; contribution is welcome but the scope is deliberately tight — Stable Boy is a wallet-score tool for the pump.fun / Solana memecoin context, not a general-purpose analytics framework.

## Where to start

Read [`/how`](https://www.stableboy.fun/how) (the in-app methodology page) and skim the [README](./README.md). Then look at:

- [`src/lib/scoring/curves.ts`](src/lib/scoring/curves.ts) — the per-factor scoring curves. Tuning happens here.
- [`src/lib/scoring/weights.ts`](src/lib/scoring/weights.ts) — factor weights and penalty amounts.
- [`src/lib/scoring/index.ts`](src/lib/scoring/index.ts) — the scoring engine that wires curves + weights + Layer 2 penalties into a `Receipt`.
- [`src/lib/scoring/compute.ts`](src/lib/scoring/compute.ts) — the orchestration that pulls upstream data and runs the engine.

## High-value contribution areas

1. **New Layer-2 signals.** Cross-wallet wash trades, dormant-then-coordinated buys, repeated bundle counterparts. Anything that catches a pattern the current 6 penalties miss.
2. **Score-curve tuning.** If you know a wallet is a bundler / diamond / etc. and Stable Boy disagrees, open a Score Disagreement issue with the wallet address, the score it got, and what you think it should be. Curves are designed to be easy to tune; numbers aren't sacred.
3. **Better insufficient-data handling.** The current floor is 5 trades OR 3 lifetime tokens. Real-world tuning welcome.
4. **Performance.** Fresh-score time is 8–12 seconds. The bottleneck is GMGN's 1 req/s rate limit. Better caching, request batching, or parallel-scoring with separate API keys would all help.
5. **Frontend polish.** The Arkham-inspired aesthetic is intentional. Don't change the visual language; do report any bugs or accessibility issues.

## Out of scope

- Switching the entire architecture to a different RPC/indexer just because you prefer one. Open an issue first.
- Adding analytics SDKs or trackers without a clear privacy story.
- Trading features. Stable Boy is read-only, scoring-only. Trading belongs in a different product.

## Development

```bash
npm install
cp .env.example .env.local
# fill in the four required keys (see README)
npm run dev
```

`npm run typecheck` should pass. If you add new env vars, give them sensible defaults that degrade gracefully when missing.

## Submitting changes

1. Fork
2. Branch off `main` with a descriptive name
3. Commit with clear messages — first line is the summary, body explains the why
4. Open a PR. The template asks for description, test plan, and any score-impact notes
5. CI runs typecheck on every PR

Small, focused PRs land faster than big sweeping ones.

## Reporting wallets that score wrong

Open a **Score Disagreement** issue (template available). Include:

- The wallet address
- The score you got and the score you think it should be
- The single factor (or penalty) you think is mis-calibrated
- Any context (links to on-chain evidence, screenshots, etc.)

These are some of the highest-signal contributions you can make. Tuning curves with real adversarial examples is how the score gets better.

## Code of conduct

Be useful. Be respectful. Don't dox people. Don't use this tool to harass wallet owners.
