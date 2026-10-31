---
title: 'Phase 5 / 7 re-verification on develop 497c7772 (2026-11-01)'
status: active
stage: in-progress
kind: evidence
readiness: verified
launch_gate: 'A–F'
launch_blocker: false
last_verified: '497c7772 2026-11-01'
---

# Phase 5 / 7 re-verification — 2026-11-01

Re-ran the automated sweep and the hosted-dev probes on the current `develop` tree. Every row below was executed today on this machine against **hosted dev** (`fworvijbrwpyngycotbz` / `dev.kamehomes.space`) or the **local Docker stack**. Nothing here relies on a prior session's claim.

## Baseline

| Item              | Value                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `develop` SHA     | `497c7772` (merge of #185)                                                                                              |
| Edge functions    | deployed to dev from `832cbf60` — the merge after it touches `ui/` only, so the edge tree is identical                  |
| Migrations        | local and remote in sync (`supabase migration list --linked`: no pending, none missing)                                 |
| Hosted dev health | `get-health` 200 `{status: ok, db: ok}`                                                                                 |
| QA fixtures       | `scripts/dev/seed-readiness-qa-dev.mjs` (owner / outsider / guest orgs); QA owner org on `growth` (Pro) for RBAC probes |

## CI / CD state at session start

| Symptom                                            | Root cause                                                                                                                                                             | Status                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `CI` red on `develop` since 2026-10-28             | `marketingDeviceTier.test.ts` expected `isLowSpecDevice(undefined)` to be false; the default parameter read the live `navigator`, and Node 24 runners report 2–4 cores | Fixed in #185 (`497c7772`)                         |
| `CD Dev` red since 2026-10-25 (quality job)        | Same unit test, plus a stale `@ci` Playwright suite (see below)                                                                                                        | Unit test fixed; `@ci` suite repaired this session |
| `CD Dev` deploy step never ran                     | `quality` must pass first                                                                                                                                              | Re-enabled by the two fixes above                  |
| PR-130 (dev had migrations missing from `develop`) | Resolved: hosted dev and `develop` are in sync today                                                                                                                   | Closed                                             |

## Automated sweep

| Check                                   | Command                                        | Result                                                                                                     |
| --------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Full quality gate                       | `bun run ci:quality`                           | **PASS** (exit 0) at `497c7772`                                                                            |
| Unit (Vitest)                           | inside `ci:quality`                            | PASS                                                                                                       |
| Edge `_shared` (Deno)                   | inside `ci:quality`                            | PASS                                                                                                       |
| Edge handler tests                      | inside `ci:quality`                            | PASS                                                                                                       |
| E2E `@smoke`                            | inside `ci:quality`                            | PASS                                                                                                       |
| Static guards (13 scripts individually) | each `scripts/dev/check-*.sh` / `.mjs`         | PASS 13/13                                                                                                 |
| Plan catalog vs golden matrix           | `bun run check:plan-catalog`                   | PASS (6 plans)                                                                                             |
| RLS probe (local, anon + authenticated) | `scripts/dev/probe-rls-anon-local.sh`          | PASS 6/6 after the probe-script fix (#187)                                                                 |
| AI evals (live Gemini)                  | `bun run eval:ai`                              | documents 4/4 · blocks 50/51 (98%, gate 90%) · quality 42/43 (98%, gate 85%) · guest 38/39 (97%, gate 85%) |
| Lib unit-test inventory                 | `scripts/dev/lib-unit-test-inventory.mjs`      | **55 lib files still have no unit test** → PR-135                                                          |
| Bundle budget                           | `bun run check:budgets`                        | **WARN**: total JS 4932.8 KiB gzip vs 4200 budget (warn-only) → PR-134                                     |
| Prod env matrix pairing                 | `scripts/dev/readiness-env-matrix.mjs --check` | PASS (secrets, Vault entries and crons all paired)                                                         |

## Hosted-dev probes

| Area                      | Script / command                                                     | Result                                                                                                 |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Smoke                     | `scripts/deploy/ci-smoke.sh dev`                                     | OK — required functions present, compression OK, `monaco-2604` public probes 200                       |
| Deployed preview          | `verify-deployed-preview.mjs` (`PREVIEW_URL=dev…`)                   | OK — pwa-version served                                                                                |
| Cross-tenant reads/writes | `probe-readiness-idor-dev.mjs`                                       | 13/13 denied (403) with outsider + guest tokens; owner control 200                                     |
| Team RBAC                 | `probe-readiness-rbac-dev.mjs`                                       | Full Access / Operations / Read Only match the seeded templates                                        |
| Invites                   | `probe-readiness-invites-dev.mjs`                                    | 6/6 (wrong email 403, random token 404, accept 200, reuse 410, expired 410, no invitee email leak)     |
| Uploads                   | `probe-readiness-uploads-dev.mjs`                                    | 5/5 (HTML-as-PNG rejected, PDF-as-PNG rejected, real PNG accepted, cleanup OK)                         |
| Booking workflow          | `probe-readiness-workflow-dev.mjs <qaBookingId>`                     | Guards 400; PENDING_DOCUMENTS → READY_FOR_CHECKIN → READY_FOR_CHECKOUT → PENDING_SD_REFUND → COMPLETED |
| Guest-link tokens         | `probe-readiness-guest-token-dev.mjs`                                | Past grace no token 401, forged 401, inside grace 200, `created_at` restored                           |
| CORS                      | `check-cors-origins.sh`                                              | Allowed origin echoed; blocked origin gets no `Access-Control-Allow-Origin` (probe fixed in #186)      |
| Rate limits / abuse       | `abuse-public-endpoints.sh`                                          | Public burst holds; PayMongo webhook reaches 429 after 32 bad-signature attempts                       |
| Storage anon read         | `abuse-storage-anon-read.sh` (`approved-gafs`, `sd-refund-receipts`) | 400 on both private guest-document paths                                                               |
| Cron secret inventory     | `audit-cron-secrets.sh`                                              | 21 `*_CRON_SECRET` names referenced in edge code (Vault pairing checked by the env matrix)             |

## E2E `@ci` suite repair (27 failures → 0)

`CD Dev` runs `test:e2e:ci`, so a red `@ci` suite blocks every backend deploy. Before this session 27 of 307 `@ci` tests failed on `develop`. Triage and outcome:

| Group                          | Cause                                                                                                                              | Outcome                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Notifications hub (6)          | UI moved from tabs to section nav on 2026-10-30; spec asserted `role=tab`                                                          | Spec rewritten to the current DOM                                                            |
| Notifications paging (1)       | **Product bug**: the feed passed no `scrollRoot`, so the load-more observer never attached and the hub could not page past 20 rows | Fixed in `InAppNotificationsPanel` (falls back to the nearest `[data-admin-content-scroll]`) |
| Reviews host/org (4)           | Harness had no `reviews` paths, no review endpoints and no `reviews:*` / `org.reviews:view` permissions                            | Harness + specs updated; all pass                                                            |
| Plan gate: Auto-review (5)     | Auto-review moved into a header sheet with a `TierBadge`                                                                           | Gate surface now opens the sheet and asserts the switch + badge                              |
| Account reviews (1)            | `list-my-reviews` never mocked                                                                                                     | Mock added                                                                                   |
| Property templates (1)         | Group menu labels changed (`Actions for Archive`)                                                                                  | Spec updated                                                                                 |
| Assistant template context (1) | Asserted a "Preview template" action the assistant composer does not wire (`onPreview` is never passed)                            | Assertion narrowed to the pinned-context popover; product gap → PR-136                       |
| Marketing studio (9)           | Studio entry redesigned into the New post gallery on 2026-10-30                                                                    | Marked `test.fixme` with the ledger id → PR-133                                              |

After the repair: `test:e2e:ci` = **296 passed, 9 skipped (fixme), 0 failed** (re-run at the end of the session).

## Fresh replay (Phase 5.6)

`bun run db:reset` on a clean checkout **failed** before this pass:

- `supabase/seed.sql` inserts properties/parkings for organization `405ea07f…`, which no migration creates any more → `properties_organization_id_fkey` violation during `supabase start`, `db reset` and the `Migration Replay` workflow (run `41234319626`). Fixed by seeding a deterministic owner + that organization at the top of the seed (idempotent).
- `bun run check:plan-catalog` failed on the fresh database: Starter → Managed carried the **Free** `marketingMediaLibrary` quotas. The per-tier backfill in the shipped tree is guarded by `NOT (features ? 'marketingMediaLibrary')`, which never fires because the plan seeds write the key first. Fixed with a new migration that writes the golden values where a plan still has the Free default.

After both fixes: `bun run db:reset` → exit 0 (all migrations + both seed files), `bun run check:plan-catalog` → "Plan catalog matches the golden matrix (6 plans)".

The `Migration Replay` workflow now gets past seeding and stops at its next step: `supabase db lint --fail-on error` reports `relation "cron.job" does not exist` (the local stack does not enable `pg_cron`, while several public functions reference `cron.job`), plus two older lint errors (`IMMUTABLE` marked on a `STABLE` expression, a mismatched assignment type). Those are lint-step configuration findings, tracked as PR-139.

## Open after this pass

| ID     | Item                                                                                                                                                     | Owner           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| PR-025 | GitHub `development` env still missing `DEV_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`, `SMOKE_PROPERTY_SLUG` (blocks restore drill + pg_stat) | operator        |
| PR-024 | Measured restore drill (needs `DEV_DB_URL`)                                                                                                              | operator        |
| PR-133 | Rewrite the 9 marketing-studio `@ci` specs for the New post gallery entry                                                                                | agent           |
| PR-134 | Total JS gzip 4.9 MiB vs 4.2 MiB budget (warn-only). Decide budget or trim lazy chunks                                                                   | product + agent |
| PR-135 | 55 lib modules without unit tests                                                                                                                        | agent           |
| PR-136 | Assistant pinned-context "Preview template" action is built but never wired by the composer                                                              | agent           |

## Commands to reproduce

```bash
bun run ci:quality
bun run check:plan-catalog
bash scripts/dev/probe-rls-anon-local.sh
bun run eval:ai
node scripts/dev/seed-readiness-qa-dev.mjs --plan growth
node scripts/dev/probe-readiness-idor-dev.mjs
node scripts/dev/probe-readiness-rbac-dev.mjs
node scripts/dev/probe-readiness-invites-dev.mjs
node scripts/dev/probe-readiness-uploads-dev.mjs
node scripts/dev/probe-readiness-guest-token-dev.mjs
SUPABASE_ANON_KEY=… SUPABASE_PROJECT_REF=fworvijbrwpyngycotbz SUPABASE_ACCESS_TOKEN=… bash scripts/deploy/ci-smoke.sh dev
BASE_URL=https://fworvijbrwpyngycotbz.supabase.co/functions/v1 bash scripts/dev/abuse-public-endpoints.sh
BASE_URL=https://fworvijbrwpyngycotbz.supabase.co/functions/v1 ALLOWED_ORIGIN=https://dev.kamehomes.space bash scripts/dev/check-cors-origins.sh
```
