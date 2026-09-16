---
title: 'Baseline and budgets'
status: active
tags: [workflow, planned, production-readiness, performance, measurement]
updated: 2026-09-16
stage: planned
kind: plan
---

# 00 — Baseline and budgets

**Prerequisite for every other doc in this folder.** Without a before-snapshot, no other item can prove it helped, and no CI guard can tell improvement from regression.

## Goal

A committed, reproducible baseline for bundle size, page performance, query latency, and error rate — plus budget files that fail CI when a number regresses past its threshold.

## Prior art — do not redo

| Already shipped                                                       | Where                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Initial bundle budget (entry ≤ 500 KiB gzip, initial ≤ 1200 KiB gzip) | `scripts/performance/check-initial-bundle-budget.mjs`, wired in `ci.yml`                     |
| PWA precache budget                                                   | `scripts/pwa/check-precache-budget.mjs`                                                      |
| Lazy image-optimizer assertion                                        | `scripts/media/assert-lazy-optimizer.mjs`, `ci.yml` step "Assert image optimizer stays lazy" |
| `manualChunks` vendor split (12 vendor chunks)                        | `ui/vite.config.ts:265-305`                                                                  |
| Quality gate aggregator                                               | `bun run ci:quality` → `scripts/dev/ci-quality-gate.sh`                                      |

**Gap:** budgets exist only for _bundle bytes_. There is no baseline for runtime performance (LCP/INP/CLS), no per-route budget, no edge-function latency baseline, and no query-latency baseline. Bundle bytes are the one thing already guarded; everything else in this folder is currently unmeasured.

## Current state (measured 2026-09-16)

| Metric                                    | Value      | Source                                                                         |
| ----------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| UI source files                           | 2330       | `find ui/src -name '*.ts*' \| wc -l`                                           |
| Edge functions                            | 300        | `ls supabase/functions \| wc -l`                                               |
| Migrations                                | 346        | `ls supabase/migrations \| wc -l`                                              |
| Lazy boundaries                           | 123        | `grep -rn 'React.lazy\|= lazy(' ui/src \| wc -l`                               |
| Vendor chunks                             | 12         | `ui/vite.config.ts`                                                            |
| Files using memoization                   | 384 / 2330 | `grep -rl 'React.memo\|useMemo\|useCallback' ui/src`                           |
| Files referencing `Skeleton`              | 170        | `grep -rl Skeleton ui/src`                                                     |
| Files with debounce                       | 15         | `grep -rln 'useDebounce\|debounce' ui/src`                                     |
| Migrations creating indexes               | 89 / 346   | `grep -rl 'CREATE INDEX' supabase/migrations`                                  |
| Edge handlers importing a rate-limit gate | 37 / 300   | `grep -rln 'rateLimit\|publicRateLimit' supabase/functions --include=index.ts` |

These are **file counts, not verdicts.** Each downstream doc converts the relevant count into a coverage ratio against the surfaces that actually need it. A low count is not automatically a defect (e.g. most edge functions are admin-authenticated and covered by a different gate) — the point is that no doc may claim coverage without measuring first.

## Phases

### Phase 0.1 — Snapshot script

Create `scripts/performance/capture-baseline.mjs` that writes a timestamped JSON to `docs/workflow/planned/production-readiness-checklist/baselines/<iso-date>.json`:

- Per-chunk gzip + brotli sizes from `ui/dist/assets/*` (parse the Vite manifest, do not glob blindly — hashed names change).
- Total initial payload per entry route (entry chunk + its static imports, transitively resolved from the manifest).
- Dependency count and `node_modules` install size.
- Migration count, edge function count, UI file count.

Commit the first snapshot. This file is the diff target for every later phase.

### Phase 0.2 — Route performance baseline

Add `scripts/performance/lighthouse-routes.mjs` running Lighthouse (mobile preset, throttled) against a local `bun run build && bun run preview` server for a fixed route list:

| Route                                 | Persona     | Why it is in the list                 |
| ------------------------------------- | ----------- | ------------------------------------- |
| `/`                                   | guest anon  | Public landing, highest traffic       |
| `/properties`                         | guest anon  | Search/list, heaviest public query    |
| `/form?property=<slug>`               | guest anon  | Primary conversion flow               |
| `/parkings`                           | guest anon  | Second vertical's landing             |
| `/account/trips`                      | guest auth  | Authenticated guest portal            |
| `/org/:slug/property/:slug/bookings`  | host        | Highest-frequency admin screen        |
| `/org/:slug/property/:slug/finance`   | host        | Heaviest admin query + PDF export     |
| `/org/:slug/property/:slug/marketing` | host        | Heaviest lazy chunks (Polotno, video) |
| `/admin`                              | super-admin | Separate shell, separate budget       |

Record LCP, INP, CLS, TBT, total transfer. Store in the same baseline JSON.

**Edge case:** Lighthouse against `vite preview` is _not_ production — no CDN, no brotli negotiation, no real network. Treat these numbers as **relative** regression detection only. Absolute targets must be measured against a deployed Vercel preview (Phase 0.4).

### Phase 0.3 — Backend latency baseline

- Add `scripts/performance/edge-latency-baseline.mjs`: hits a fixed list of public + authenticated edge functions against **hosted dev**, 20 iterations each, records p50/p95/p99 and cold-start count.
- Capture the DB side with `pg_stat_statements` on hosted dev (`mean_exec_time`, `calls`, `rows`) for the top 50 statements by total time. This requires the extension to be enabled — if it is not, that is Phase 0.3's first task, not a reason to skip.

**Edge case:** Supabase Edge Functions cold-start. A p99 dominated by cold starts is an _availability_ signal (doc 30), not a query-shape signal (doc 12). Record warm and cold separately or the numbers mislead every downstream doc.

### Phase 0.4 — Production-like reference run

Once per major phase, run Phases 0.2–0.3 against the deployed **dev** Vercel preview + hosted dev Supabase. This is the only number allowed in a "we hit the target" claim.

### Phase 0.5 — Budgets and CI guards

Create `performance-budgets.json` at the repo root:

```jsonc
{
  "bundle": {
    "entryGzipKib": 500, // already enforced
    "initialGzipKib": 1200, // already enforced
    "perRouteInitialGzipKib": {
      // new — set from the Phase 0.1 snapshot + 10% headroom
      "guest": 0,
      "dashboard": 0,
      "admin": 0,
    },
  },
  "lighthouse": { "lcpMs": 2500, "inpMs": 200, "cls": 0.1, "tbtMs": 300 },
  "edge": { "p95Ms": 800, "p99Ms": 2000 },
}
```

Wire a `bun run check:budgets` step into `ci.yml` after the existing build step. Start every new budget in **warn** mode for one week of merges, then flip to fail — a budget that fails on day one gets disabled by the first person it blocks.

## Edge cases

- **Hashed filenames** — never glob `index-*.js`; read `ui/dist/.vite/manifest.json`. A glob silently matches the wrong chunk after a split.
- **Lazy chunks are not free** — a route whose entry shrank but which now fetches 8 chunks serially is slower. Budget the _transitive initial graph_, not the entry file.
- **Brotli vs gzip** — Vercel serves brotli. Budgeting gzip only under-reports the win and over-reports the risk. Record both.
- **Flaky Lighthouse** — single runs vary ±15%. Use 3 runs, take the median, and set thresholds with headroom or CI becomes noise.
- **Baseline drift** — re-baselining after a regression hides the regression. Baselines are updated only in a commit that explicitly says why, reviewed as a change.
- **Dirty-tree measurement** — the current tree has uncommitted changes. Capture the first baseline from a clean checkout of `develop` or the numbers are unreproducible.

## Exit gate

- [x] `baselines/<date>.json` committed from a clean `develop` checkout.
- [ ] Lighthouse median captured for all 9 routes, both locally and on a deployed dev preview. (single local run only — see status note)
- [ ] `pg_stat_statements` enabled on hosted dev, top-50 snapshot committed. (not started — needs hosted-dev credentials/access)
- [x] `performance-budgets.json` exists and `bun run check:budgets` runs in `ci.yml`.
- [x] One deliberate regression PR proves the guard fails (test the alarm, don't assume it works).

## Implementation status (2026-09-16)

**Bundle baseline — closed.** `scripts/performance/capture-baseline.mjs` captures per-chunk gzip/brotli sizes + repo-scale metrics; committed as `baselines/2026-09-16-phase00-initial-develop.json` from a clean checkout.

**`performance-budgets.json` + CI wiring — closed.** `bun run check:budgets` (`check-budgets.mjs` + `analyze-chunk-graph.mjs`) runs in `ci.yml` after the build step, in `warnOnly: true` mode.

**Guard-fails test — closed.** Verified by temporarily setting `totalJsGzipKib: 10` and `warnOnly: false`, confirming `[FAIL] Total JS (gzip): 4565.7 KiB (budget 10 KiB)` with exit code 1, then restoring the original file.

**Lighthouse — only partially done, not a median, not on a deployed preview.** `scripts/performance/lighthouse-routes.mjs` exists and ran once successfully against a local `vite preview` (committed as `baselines/2026-09-16-lighthouse-phase00-initial-develop.json`, explicitly labeled `"mode": "local-vite-preview"` with a note pointing at this gap) — a single run, not the 3-run median this doc's own edge-case section requires, and never against a deployed dev preview (no brotli/CDN numbers). Later runs in this sandboxed CLI environment failed with `NO_FCP` (`CVDisplayLinkCreateWithCGDisplay failed` — headless Chrome has no real display server available here); the script now fails fast with a clear diagnostic and retries once instead of silently reporting `n/a`, but the underlying capability is environment-dependent, not fixable from inside this sandbox. Deferred: re-run 3x locally and once against a deployed dev preview from an environment with real headless-Chrome display support (or a real browser, as this review's Playwright MCP testing confirms works here) before treating the Lighthouse numbers as a trustworthy baseline.

**`pg_stat_statements` — not started.** Requires direct hosted-dev Postgres access/credentials not available in this session; deferred to whoever has hosted-dev access.

## Docs / Plans / activity-log

- **Docs:** `scripts/README.md` (new scripts), `docs/PROJECT.md` if new root config files are added.
- **Plans / Team RBAC:** N/A — internal tooling, no host capability.
- **activity-log:** N/A — no org state mutated.
