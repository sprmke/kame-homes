---
stage: planned
title: 'Observability split — S0 spike results'
status: in-progress
tags: [workflow, planned, observability, sentry, spike]
updated: 2026-11-01
kind: reference
---

# S0 — spike results

Fill each row when the spike runs. S0.1 decides whether S1 uses the SDK eagerly or
lazy-loads it; S0.2 decides whether the edge keeps the hand-rolled envelope client.

## S0.1 Browser bundle (before `@sentry/react`)

Baseline measured on `develop` after S0.3 (release id) landed, so the only variable left is
the SDK itself.

| Build                            | Entry     | Initial chunks (gzip) | Budget         |
| -------------------------------- | --------- | --------------------- | -------------- |
| Baseline, no Sentry SDK          | 156.7 KiB | 533.6 KiB             | 500 / 1200 KiB |
| With `@sentry/react`, eager init | 211.9 KiB | 588.8 KiB             | 500 / 1200 KiB |
| Delta                            | +55.2 KiB | +55.2 KiB             | within budget  |

**Result: pass — `@sentry/react@11.10.0` initialises eagerly (plan D3).** No lazy-load
fallback needed. Both gates green: `check-initial-bundle-budget.mjs` and
`check-precache-budget.mjs` (19187.5 / 20480 KiB).

Proven end to end, not just measured: with `VITE_SENTRY_DSN` set locally, a real browser
load threw an uncaught error and the page POSTed three envelopes to
`…/api/4512354438283264/envelope/` — all **200**, client `sentry.javascript.react/11.10.0`.
`window.__SENTRY__` is present, so initialisation ran.

Re-measured 2026-11-02 after `develop` moved; the earlier 146.0 / 523.1 reading was taken
before upstream's precache-tier rewrite. The PWA plugin's own summary now says `9 entries`
because precaching moved to `dist/precache-tiers.json` (shell 240 / host 332 / on-demand 39
files). `scripts/pwa/check-precache-budget.mjs` reports OK at 19027.9 / 20480 KiB. Trust the
budget gate, not the plugin's entry count.

Reproduce: `cd ui && bun run build` (the build script runs
`scripts/performance/check-initial-bundle-budget.mjs` and
`scripts/pwa/check-precache-budget.mjs`).

Decision applied: within budget → eager init in `ui/src/main.tsx` via
`ui/src/lib/sentry/init.ts`.

## S0.2 Edge cold start (envelope client vs `npm:@sentry/deno`)

| Implementation                    | Cold-start p95 | Overhead vs baseline |
| --------------------------------- | -------------- | -------------------- |
| `_shared/sentry.ts` envelope POST | _pending_      | —                    |
| `npm:@sentry/deno`                | _pending_      | _pending_            |

Decision rule (plan D4): switch to the SDK only when the overhead is under 20 ms p95.
Both spike functions are deleted after measuring.

Needs: `SENTRY_DSN` for `kame-homes-edge` plus a dev deploy (`bun run deploy:supabase:dev`).

## S0.3 Release id

Done. `ui/vite-plugins/releaseId.ts` resolves `VERCEL_GIT_COMMIT_SHA` → `GITHUB_SHA` → `local`,
is injected as `VITE_APP_VERSION` by `vite.config.ts` `define`, and feeds the source-map
release name. The dev and prod deploy scripts set `APP_RELEASE` from `git rev-parse HEAD`
before `functions deploy`, warning (not failing) if the secrets call errors.

Verified: `bun run build` emits `release:"local"` locally.

## S0.4 Shared scrub modules

Done. `ui/src/lib/telemetry/scrub.ts` and `supabase/functions/_shared/telemetryScrub.ts`
export one deny-key list, one deny-query-key list, `scrubRecord` and `scrubUrl`. Both
PostHog sanitizers now delegate to them, so Sentry and PostHog share the rule.
`scrubParity.test.ts` fails if the two files drift.

Edge note: `httpResponse.ts#sanitizeUrlForTelemetry` deliberately keeps the stricter
"redact every query value" rule, because it runs on raw inbound `req.url` where a token
param name could be missing from the list.

## S0.5 Env files and sync

Done. `ui/.env.example` and `supabase/.env.example` document the Sentry keys, the release id
and the PostHog retirement. `scripts/dev/env-sync-lib.mjs` documents `EDGE_ONLY_KEYS`
(including "never copy `VITE_SENTRY_DSN` into `SENTRY_DSN`"), and `sync-dev-env.mjs` pushes
`SENTRY_DSN` / `SENTRY_SAMPLE_RATE_WARNING` from `supabase/.env.local` to hosted dev.
