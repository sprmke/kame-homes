# Phase 8 load test — hosted dev, baseline `c0f04aff` — 2026-10-19

`scripts/performance/load-test/public-api.js` (k6 2.3, one load generator): public pages + the public edge functions behind them, GETs only, anon key. Target (assumed, no answer to the question): **50 concurrent visitors, p95 < 1.5s, errors < 1%**.

## Full run: 50 VUs, 1m ramp + 8m hold

| Metric                        | Result                    | Target             |
| ----------------------------- | ------------------------- | ------------------ |
| Requests                      | 5,944 (10.3/s)            | —                  |
| Errors (non-200/304/429)      | 0.01% (1)                 | < 1% ✅            |
| Rate-limited (429, single IP) | 26.8%                     | counted separately |
| Latency p50 / p95 / max       | 1.38s / **11.0s** / 19.7s | p95 < 1.5s 🔴      |

## Per-endpoint breakdown: 50 VUs, 2m hold

| Endpoint                   | Median    | p95   | 429 share |
| -------------------------- | --------- | ----- | --------- |
| Pages (Vercel CDN)         | 0.09s     | 0.16s | —         |
| `get-public-property`      | **12.4s** | 27.0s | 0.7%      |
| `search-listings`          | 4.9s      | 14.7s | 25%       |
| `list-public-properties`   | 2.0s      | 15.9s | 36%       |
| `list-public-place-groups` | 2.0s      | 17.5s | —         |
| `search-suggestions`       | 3.4s      | 7.7s  | —         |

Single-request warm latency on the same baseline: `get-public-property` 1.2–1.4s, list endpoints 0.3–0.5s.

## Findings

1. **No CDN caching of public edge responses.** Responses carry `cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`, but Supabase's Cloudflare front returns `cf-cache-status: DYNAMIC`: every public GET reaches the function and Postgres. `docs/architecture/edge-functions.md` (`publicDynamic`) assumes otherwise.
2. **Backend saturates around 10 req/s** on the dev project: all edge endpoints degrade together while CDN pages stay at 0.1s, the shape of a database/connection bottleneck. The dev compute tier is unknown here; production sizing must be confirmed by the operator.
3. **`get-public-property` is the heaviest** (many queries per call, even after #180 halved its single-call latency).
4. Rate limiting worked (429s, no errors); real traffic comes from many IPs.

## Options (decision needed, issue #183)

- **A. Cache public reads at the edge we control**: proxy public GETs through Vercel (same origin, `s-maxage` honoured by Vercel's CDN), or a Vercel middleware cache for the listing/search family.
- **B. App-level read-through cache** (`_shared/queryCache.ts`) for `get-public-property` and listing pages with a short TTL plus purge on property/pricing/review writes.
- **C. Fewer queries per call** (fold contact / app settings / reviews into one RPC).
- Confirm production compute size and re-run this test against it before launch.
