# Stable Boy

Solana wallet stability score (0–100). Paste a wallet, get a receipt that explains exactly which behavioral signals dragged it up or down.

Live: [stableboy.fun](https://www.stableboy.fun) · X: [@StableBoyPF](https://x.com/StableBoyPF) · Token: [$Stable](https://pump.fun/)

Stable Boy is **fully open source under the MIT license**. Self-host it, fork it, embed it, or contribute back.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind v4
- Supabase (Postgres) for permalinks + 24h score cache
- GMGN OpenAPI for wallet stats and funding source
- Bitquery EAP for pump.fun bundle co-buy detection
- Vercel for deploy

## What ships in v1

| Layer | Signal | Source | Status |
|---|---|---|---|
| 1 | Hold duration | GMGN `wallet_stats.avg_holding_period` | ✓ |
| 1 | Token diversity | GMGN `wallet_stats.token_num` | ✓ |
| 1 | Wallet age | GMGN `common.created_at` | ✓ |
| 1 | Win/loss distribution | GMGN PnL buckets | ✓ |
| 1 | PnL behavior | GMGN buy/sell ratio (proxy) | ✓ |
| 1 | Funding source | GMGN `fund_from_address` + Helius CEX labels | ✓ |
| 1 | SOL balance consistency | GMGN `native_balance` (snapshot) | ✓ (proxy) |
| 1 | Paperhand ratio | FIFO entry/exit pairing on `wallet_activity` | ✓ |
| 2 | Bundle co-buy | Bitquery same-slot scan | ✓ |
| 2 | Sniper window | Bitquery launch-slot check | ✓ |
| 2 | Cluster proximity (1/2-hop) | Funder traversal × `bundler_taglog` | ✓ (taglog grows from `/api/accumulate-tags`) |
| 2 | Funding daisy-chain | Funder chain freshness | ✓ |
| 2 | Wash trade | Round-trip pattern detector on activity | ✓ (cross-wallet wash v3) |
| — | Trading activity heatmap | GMGN `wallet_activity` bucketed by day | ✓ |

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

- `GMGN_API_KEY` — read-only key from gmgn.ai/ai (Trading disabled is fine)
- `BITQUERY_TOKEN` — Developer plan access token from bitquery.io
- `HELIUS_API_KEY` — free-tier key from helius.dev. Optional: if unset, funder labels return null and funding source falls back to a v1 heuristic. Required for the +13 "direct from CEX" boost on legitimate wallets.
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — from same page (server-side only, never expose to browser)
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` for dev, your Vercel URL for prod

### 3. Database

In your Supabase project's SQL Editor, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

This creates three tables:
- `scored_wallets` — receipts cached for 24h, keyed by wallet address
- `funder_lookups` — immutable record of who funded which wallet (v2 traversal)
- `bundler_taglog` — append-only log of per-token bundler/sniper/insider observations (v2)

### 4. Run

```bash
npm run dev
```

Open `http://localhost:3000`, paste a wallet, see a score.

### 5. Deploy

Push to GitHub, import the repo on Vercel, paste the same env vars in Vercel project settings, deploy.

## Routes

- `/` — paste a wallet, get a score
- `/w/<addr>` — receipt page (cached 24h)
- `/w/<addr>/badge.svg` — embeddable SVG score badge
- `/w/<addr>/opengraph-image` — dynamic OG image for share previews
- `/compare/<a>/<b>` — side-by-side comparison with shared-funder detection
- `/leaderboard` — top 20 diamonds + bottom 20 bundlers, last 7 days
- `/how` — methodology page: factor weights, penalty triggers, sources, limitations

## API

`POST /api/score`
```json
{ "wallet": "7reR1o13S4VXpcTmB6Wtkrvi7wpba1C3x2LEmYEBRvLM", "force": false }
```
Returns `{ receipt: Receipt, cached: boolean }`. If `force` is true, skips the cache.

`GET /api/score?wallet=<address>` — cache-only read, 404 if not yet scored.

`GET /w/<address>` — server-rendered receipt page, computes on demand if no cache.

## Cost / rate limits

- **GMGN free tier:** 1 request/second. The client serializes calls through a promise chain so concurrent scorings queue rather than 429.
- **Bitquery Developer plan:** 1,000 points/month. Each score consumes ~30 points, so the free tier covers ~33 fresh scores per month. The 24h Supabase cache is what makes this practical at any user volume.

## Score architecture

Two layers:

1. **Behavioral score (0–100)** — weighted average of normalized factors. Describes how the wallet trades.
2. **Trust penalties (−60 cap)** — hard deductions for cluster/bundler/insider patterns. Stack additively.

`final = clamp(layer1 + layer2, 0, 100)`

Verdict bands:
- 80–100 → diamond
- 50–79 → active trader
- 20–49 → degen / sniper
- 0–19 → bundler-adjacent

Wallets with <10 lifetime trades return `insufficient_data` rather than a fake score.

See [`src/lib/scoring/curves.ts`](src/lib/scoring/curves.ts) for the per-factor curves and [`src/lib/scoring/weights.ts`](src/lib/scoring/weights.ts) for the weight table.

## Contributing

PRs welcome. Areas where help is especially useful:

- **New Layer-2 signals.** Wash trades across multiple wallets, dormant-then-coordinated, repeated bundle counterparts — anything that catches a pattern we currently miss.
- **Score curve tuning.** If you have a wallet you know is a bundler/diamond/etc. and the score disagrees, open an issue with the wallet address + what you think the score should be. The curves in [`src/lib/scoring/curves.ts`](src/lib/scoring/curves.ts) are intentionally simple.
- **Additional chains.** Codebase is Solana-only today; the scoring engine is chain-agnostic and could extend to Base, BSC, etc. with new GMGN/Bitquery query backends.
- **Performance.** Fresh-score time is 8–12 seconds. The bottleneck is GMGN's 1 req/s rate limit. Better caching or parallelization could cut this.

Before submitting a PR:
- `npm run typecheck` passes
- `npm run lint` passes (when configured)
- No new env vars without a default that degrades gracefully

## Acknowledgments

Data partners: [GMGN](https://gmgn.ai), [Bitquery](https://bitquery.io), [Helius](https://helius.dev). None of these companies sponsor or endorse Stable Boy — we're just paying customers / users of their APIs.

The aesthetic is inspired by [Arkham Intelligence](https://intel.arkm.com)'s information-dense crypto-forensics dashboards.

## Extending

- Add Helius Wallet API for proper CEX-vs-daisy-chain funding classification → upgrade `fundingSourceScore`
- Implement `wallet_activity` parsing → unlock paperhand ratio + full-dump detection
- Implement recursive funder traversal (max 3 hops) → unlock cluster proximity penalties
- Implement `token_top_traders` per wallet token → unlock per-wallet sniper/bundler/insider tag accumulation in `bundler_taglog`
