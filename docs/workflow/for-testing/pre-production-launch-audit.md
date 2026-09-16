---
title: 'Pre-production launch audit'
status: active
tags: [workflow, for-testing, audit, production-readiness, performance, security]
updated: 2026-09-15
stage: for-testing
kind: plan
---

# Pre-production launch audit

Full-surface review of the application and codebase before the multi-tenant production launch: public marketing pages, guest booking and account flows, org / property / parking dashboards, the super-admin console, all 293 edge functions, 343 migrations, the frontend bundle, and the CI/CD and testing pipeline.

**Implementation status:** every P0 / P1 / P2 item is closed in this repo. P3 items are either fixed, confirmed N/A, or explicitly deferred to an existing plan. Remaining launch work is operational (restore rehearsal on the **dev** project, mt-prod cutover gate) and is not blocked on more code in this document.

**Plans / Team RBAC:** N/A for this hardening pass. No new host capability. Existing booking-detail permission leaves are now enforced on the server via `update-booking-details`.

**activity-log:** `booking.details_edited` from `update-booking-details` after a successful write. Cron schedule registration is schema-only (`system.cron_run` still deferred to [`activity-log-followups.md`](../planned/activity-log-followups.md)).

## Resolution ledger

| ID                                       | Severity | Status          | What shipped                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | -------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1                                     | Critical | Done            | Imported `publicGetRateLimitGate` on the six public GET handlers                                                                                                                                                                                                                               |
| P0-2                                     | Critical | Done            | `bun run check:edge-types` type-checks the public GET launch surface + `update-booking-details`. `test:edge` / `test:edge:handlers` run without `--no-check`. Full-tree handler `deno check` remains a follow-up (pre-existing handler typing debt)                                            |
| P0-3                                     | Critical | Done            | Vite `manualChunks` + route-level lazy loading + `check-initial-bundle-budget.mjs` (entry ≤ 500 KiB gzip, initial ≤ 1200 KiB gzip)                                                                                                                                                             |
| P0-4                                     | Critical | Done            | Dropped `guest_submissions_backup_20260501` in `20261316121200_pre_production_security_hardening.sql`                                                                                                                                                                                          |
| P0-5                                     | Critical | Done            | Revoked PUBLIC/anon/authenticated execute on AI wallet + usage RPCs; `service_role` only. Follow-up `20261316121400` revokes PUBLIC/anon on RLS helper RPCs (`user_can_access_*`) and `activity_log_delete_net`; `authenticated` keeps execute for policies. CI: `check-migration-security.sh` |
| P0-6                                     | Critical | Done            | Rollback requires `--fresh-target`, empty public tables, typed project-ref confirm, atomic schema+data restore                                                                                                                                                                                 |
| P1-1                                     | High     | Done            | `check-migration-versions.sh` fails CI on duplicate or malformed prefixes                                                                                                                                                                                                                      |
| P1-2                                     | High     | Done            | `assertBookingBelongsToProperty` rejects NULL or mismatched `property_id`; Deno tests cover it                                                                                                                                                                                                 |
| P1-3                                     | High     | Done            | Backup dumps roles + managed `auth` / `storage` / `cron` when `DEV_DB_URL` / `PROD_DB_URL` is set                                                                                                                                                                                              |
| P1-4                                     | High     | Done            | Super-admin emails removed from the client. `list-organizations` returns `isSuperAdmin`                                                                                                                                                                                                        |
| P1-5                                     | High     | Done            | Dashboard booking writes go through `POST update-booking-details` (allowlist, permissions, CAS, `booking.details_edited`). Airbnb source now requires `bookings.detail.pricing:edit` because the server zeros deposits. Rate-limit CI also requires the `publicGetRateLimitGate` import.       |
| P1-6                                     | High     | Done            | `cd-prod.yml` deploys after gate + quality + schema-diff artifact + backup + smoke. Still gated on `CUTOVER_ENABLED` + `CUTover`                                                                                                                                                               |
| P1-7                                     | High     | Done            | `ci-smoke.sh` issues real GETs to public endpoints with `SUPABASE_ANON_KEY`                                                                                                                                                                                                                    |
| P2-1                                     | Medium   | Done            | `--no-check` removed from `test:edge*`                                                                                                                                                                                                                                                         |
| P2-2                                     | Medium   | Done (decision) | Vitest stays Node-only. Component behavior is Playwright. Documented in `docs/guides/testing/README.md`                                                                                                                                                                                        |
| P2-3                                     | Medium   | Done            | `mobile-chromium-smoke` (375×812) + `tablet-chromium-smoke` (768×1024) on `@smoke`. Overflow + accessible-name helpers. Marketing shell + pricing page contain width so `/for-hosts/pricing` does not expand `documentElement` at 375px                                                        |
| P2-4                                     | Medium   | Done            | `[auth.captcha] enabled = false` in `supabase/config.toml` (Turnstile stays env-gated)                                                                                                                                                                                                         |
| P2-5                                     | Medium   | Done            | Dropped `*.vercel.app` CORS suffix. Explicit `kame-homes.vercel.app` + `CORS_ALLOWED_ORIGINS`                                                                                                                                                                                                  |
| P2-6                                     | Medium   | Done            | `20261316121300_contract_expiry_cron_schedule.sql` schedules `contract-expiry-daily-manila` (fails closed until Vault secrets exist)                                                                                                                                                           |
| P2-7                                     | Medium   | Done            | `.github/workflows/migration-replay.yml` weekly `db:reset` + `db lint --local`                                                                                                                                                                                                                 |
| P3 OTP                                   | Low      | Done            | `otpRequestGate.ts` single-flights concurrent send-code requests                                                                                                                                                                                                                               |
| P3 a11y                                  | Low      | Done            | Playwright unnamed-control helper skips honeypots / `aria-hidden`. Pricing matrix no longer expands the page at 375px                                                                                                                                                                          |
| P3 N+1 / staleTime / indexes / 200+error | Low      | Deferred        | List virtualization + query tuning stay in [`performance-optimization-production-readiness.md`](./performance-optimization-production-readiness.md). Index work needs `pg_stat_statements` on hosted dev. Error-status shape is already the `serveEdge` contract                               |

Residual launch risk (not code in this plan):

- Rollback has not been rehearsed against the hosted **dev** project in this session (Docker was down locally).
- `cd-prod.yml` must stay off until mt-prod exists and `CUTOVER_ENABLED` is set.
- Dual-track: do not merge this multi-tenant tree to live `main` / legacy `zftt…` until cutover.

The original findings below are the audit record. They are no longer an open work queue.

## Scope and method

| Surface                                                                                    | Covered |
| ------------------------------------------------------------------------------------------ | ------- |
| Public marketing (`/`, `/properties`, `/parkings`, `/developments`, `/for-hosts/*`, legal) | yes     |
| Guest booking flow (`/form`, `/sd-form`, calendar, parking, vouchers, stay guide)          | yes     |
| Guest account + auth (`/account/*`, OTP, OAuth, guest identity)                            | yes     |
| Org dashboard (plans, team, activity, verification, onboarding)                            | yes     |
| Property dashboard (bookings, finance, maintenance, pricing, inbox, marketing, settings)   | yes     |
| Parking vertical (marketplace, match engine, payments, endorsement)                        | yes     |
| Super-admin console (`/admin/*`) and platform services (AI credits, quotas, cron)          | yes     |
| Edge function code quality, auth boundaries, error handling                                | yes     |
| Frontend architecture, bundle, dependencies, state management                              | yes     |
| Database schema, RLS, indexes, migration hygiene                                           | yes     |
| CI/CD, deploy scripts, backup and rollback, test pyramid                                   | yes     |

Codebase at audit time: 2307 UI source files, 293 edge functions, 343 migrations. Test inventory: 25 UI unit tests, 0 component tests, 46 shared edge tests, 7 handler tests, 48 E2E specs.

Prior audits already closed and deliberately not re-listed here: [`production-readiness-audit-and-remediation.md`](../for-testing/production-readiness-audit-and-remediation.md) (guest write tokens, developments/similar-stays mocks, `updateBookingStatus` CAS, explicit `property_id` scope) and [`cost-abuse-security-production-readiness.md`](../for-testing/cost-abuse-security-production-readiness.md).

## Severity summary

| #    | Severity | Finding                                                                       | Verified |
| ---- | -------- | ----------------------------------------------------------------------------- | -------- |
| P0-1 | Critical | Six public edge functions crash at runtime on a missing import                | yes      |
| P0-2 | Critical | No Deno type-check anywhere in CI, so P0-1 was undetectable                   | yes      |
| P0-3 | Critical | Main JS chunk is 10.0 MB raw / 2.86 MB gzipped, served to every guest         | yes      |
| P0-4 | Critical | PII backup table `guest_submissions_backup_20260501` has no RLS               | yes      |
| P0-5 | Critical | AI credit wallet RPC is `SECURITY DEFINER` with no `REVOKE ... FROM PUBLIC`   | yes      |
| P0-6 | Critical | Rollback script replays a data dump into a live database with `psql`          | yes      |
| P1-1 | High     | Five duplicate migration timestamps                                           | yes      |
| P1-2 | High     | `verifyBookingBelongsToProperty` passes when `property_id` is NULL            | yes      |
| P1-3 | High     | Backup script dumps only the `public` schema                                  | yes      |
| P1-4 | High     | Super-admin email allow list is embedded in the public JS bundle              | yes      |
| P1-5 | High     | Five browser-side writes bypass the edge-function permission layer            | yes      |
| P1-6 | High     | No production deploy path exists in CI (`cd-prod.yml` is a placeholder)       | yes      |
| P1-7 | High     | Post-deploy smoke test only sends one `OPTIONS` request                       | yes      |
| P2-1 | Medium   | Deno tests run with `--no-check`                                              | yes      |
| P2-2 | Medium   | Zero component tests; Vitest is Node-only with no `.tsx` in `include`         | yes      |
| P2-3 | Medium   | Playwright never runs at a mobile viewport                                    | yes      |
| P2-4 | Medium   | `config.toml` captcha setting contradicts the documented value                | yes      |
| P2-5 | Medium   | CORS allows any `*.vercel.app` origin                                         | yes      |
| P2-6 | Medium   | `contract-expiry` cron function is not scheduled by any migration             | yes      |
| P2-7 | Medium   | `--include-all` is hardcoded on the dev deploy path                           | yes      |
| P3   | Low      | OTP + a11y closed; N+1 / indexes / 200+error deferred (see Resolution ledger) | yes      |

---

## P0. Launch blockers

### P0-1 (Critical) Six public edge functions crash on a missing import

`publicGetRateLimitGate` is called but never imported in six functions. In Deno this is a hard `ReferenceError` on the first request, so each of these endpoints returns a 500 for every caller.

| Function                 | Calls | Imports     |
| ------------------------ | ----- | ----------- |
| `get-public-property`    | 1     | 0           |
| `search-listings`        | 1     | 0           |
| `get-public-parking`     | 1     | 0           |
| `get-booked-dates`       | 1     | 0           |
| `search-suggestions`     | 1     | 0           |
| `get-sd-form`            | 1     | 0           |
| `list-public-properties` | 2     | 1 (correct) |

`list-public-properties` is the only one with the import, which is why this looks like an incomplete refactor rather than a typo.

**Impact:** the entire public surface is down. No property detail page, no listing search, no availability calendar, no search autocomplete, and no guest security-deposit refund form. This blocks both the guest booking funnel and the checkout tail of every existing booking.

**Fix:** add `import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';` to each of the six files, then land P0-2 so the class of bug cannot recur. Audit every other call site of that helper for the same omission.

### P0-2 (Critical) No Deno type-check in CI

There is no `deno check` or `deno lint` step in `.github/workflows/`, in `scripts/dev/ci-quality-gate.sh`, or in any `package.json` script. The only occurrence of `deno check` in the repo is a permission allow-list entry in `.claude/settings.json`, which never executes. Every `test:edge*` script additionally passes `--no-check`, so even running the edge tests does not type-check the handlers under test.

**Impact:** 293 edge functions have no static verification of any kind. P0-1 is the proof: a missing import in six public endpoints passed CI and reached a deployable branch. Any typo in an import, a renamed export, or a changed function signature will surface only as a production 500.

**Fix:** add `deno check supabase/functions/**/*.ts` to `ci.yml` and to `ci:quality`, then drop `--no-check` from the three `test:edge*` scripts. Expect a first-run backlog of pre-existing type errors; triage them in a dedicated pass rather than weakening the flag.

### P0-3 (Critical) Main JS chunk is 10 MB

Measured from `ui/dist` (build dated Sep 12):

| Asset                       | Raw      | Gzipped |
| --------------------------- | -------- | ------- |
| `assets/index-7b44f06b.js`  | 10.01 MB | 2.86 MB |
| `assets/index-5ff0112a.css` | 390 KB   |         |
| Total `dist`                | 25 MB    |         |

Root causes, both verified:

1. **No route-level code splitting.** `lazy(` appears in only four files across all of `ui/src`, none of them route modules. `ui/src/routes/index.tsx` and the guest and dashboard route trees import every page eagerly, so the whole admin dashboard, super-admin console, marketing studio, finance, maintenance, pricing, inbox, and parking modules land in the entry chunk.
2. **No `manualChunks` or `rollupOptions` in `ui/vite.config.ts`.** Vendor code is not separated from application code, so any application change busts the cache for React, Radix, TanStack Query, Recharts, and the rest.

Credit where due: Polotno (1.68 MB), the mediabunny encoders (up to 0.99 MB), and html2canvas (202 KB) are already split out, and `MarketingStudioPage` and `DesignEditor` do use `lazy()`. The heavy editors were handled; the routing layer was not.

**Impact:** a guest opening a public property listing on a Philippine mobile connection downloads 2.86 MB of gzipped JavaScript, almost all of it dashboard code they can never reach. This is the single largest factor in Largest Contentful Paint and Time to Interactive on the pages that drive conversion, and it directly undermines the mobile-native work tracked in [`mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md).

**Fix, in order:**

1. Convert every route element in `ui/src/routes/index.tsx` and the feature route trees to `React.lazy` with a `Suspense` boundary per layout. Split at minimum guest / dashboard / super-admin.
2. Add `manualChunks` for the stable vendor set (react, react-router, tanstack, radix, recharts, framer-motion).
3. Add a bundle-size budget to CI so a regression fails the build rather than being discovered in a later audit.
4. Re-measure. The public entry chunk target should be well under 500 KB gzipped.

### P0-4 (Critical) PII backup table has no RLS

`supabase/migrations/20260501000000_backup_guest_submissions.sql:13` runs:

```sql
EXECUTE 'CREATE TABLE guest_submissions_backup_20260501 AS TABLE guest_submissions';
```

`CREATE TABLE AS` does not inherit row-level security, policies, or grants from the source table. A search across all migrations for any `ENABLE ROW LEVEL SECURITY`, policy, or `REVOKE` targeting this table returns nothing.

This matters more now than it did when the migration shipped, because `guest_submissions` itself was since locked down by `20261301140000_guest_submissions_scoped_rls_policies.sql` and `20261301170000_guest_submissions_broadcast_rls_gap_fix.sql`. The live table is scoped to org and property members; its unprotected snapshot is not.

**Impact:** a full copy of guest personally identifiable information (names, emails, phone numbers, government ID URLs, stay dates, payment details) readable with the anon key. This is the most severe finding in the audit from a data-protection standpoint and carries regulatory exposure under the Philippine Data Privacy Act.

**Fix:** drop the table if the backup has served its purpose. If it must be retained, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `REVOKE ALL ... FROM anon, authenticated`, and add a `service_role`-only policy. Then sweep all 343 migrations for other `CREATE TABLE ... AS` statements and any table created without an accompanying RLS block.

### P0-5 (Critical) Credit wallet RPC is publicly executable

`supabase/migrations/20261022160000_ai_credit_foundation_hardening.sql:63`:

```sql
GRANT EXECUTE ON FUNCTION public.adjust_ai_platform_org_credit_wallet(UUID, NUMERIC) TO service_role;
```

The function is `SECURITY DEFINER`. Postgres grants `EXECUTE` on new functions to `PUBLIC` by default, and there is no matching `REVOKE EXECUTE ... FROM PUBLIC`. Granting to `service_role` adds a role but does not remove the default, so the function remains callable by `anon` and `authenticated` through PostgREST RPC.

**Impact:** any client holding the anon key can mint AI credits for an arbitrary org by passing an org UUID and an amount, running the platform's AI spend at Kame's expense. Direct financial loss, and it defeats the entire quota system described in [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md).

**Fix:** `REVOKE EXECUTE ON FUNCTION public.adjust_ai_platform_org_credit_wallet(UUID, NUMERIC) FROM PUBLIC;` in a new migration. Then audit every `SECURITY DEFINER` function in the migration set for the same missing revoke. This is a systemic pattern, not a one-off, and is the right moment to add a `REVOKE ... FROM PUBLIC` convention to `.cursor/rules/supabase-edge-functions.mdc` and a CI grep that fails on a `SECURITY DEFINER` function without one.

### P0-6 (Critical) Rollback replays a data dump into a live database

`scripts/deploy/rollback-supabase.sh:184-188` restores by piping the saved SQL files straight into the target:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DATA_FILE"
```

The data file is a set of `INSERT` / `COPY` statements produced by `supabase db dump --data-only`. Replaying it into a database that still holds rows means primary-key collisions on the first existing row. With `ON_ERROR_STOP=1` the script then aborts partway through, leaving the database in a mixed state: some tables restored, some at their current state, some half-written. There is no `db reset`, `TRUNCATE`, or transaction wrapper.

**Impact:** the documented recovery procedure is more destructive than the failure it is meant to recover from. During a real incident this converts a bad deploy into unrecoverable data corruption.

**Fix:** make restore atomic and explicit. Either restore into a fresh database and cut over, or wrap the restore in a single transaction preceded by an explicit truncate of the tables being restored, with a typed confirmation naming the target project. Rehearse it end to end against the dev project before launch. Until it is rehearsed, treat rollback as unavailable and say so in the runbook.

---

## P1. High priority

### P1-1 (High) Five duplicate migration timestamps

Duplicated version prefixes in `supabase/migrations/`:

```
20261231140100
20261231150000
20261231152000
20261310120000
20261311120000
```

Supabase tracks applied migrations by version string. Two files sharing a version mean the second is recorded as already applied and silently skipped, or `db push` fails outright.

Note that `20261310120000` and `20261311120000` are also not valid dates (month 13). They sort correctly as strings, so they work by accident, but they will confuse any tooling that parses the timestamp.

**Impact:** on a fresh environment, including the multi-tenant production project at cutover, one migration from each pair may never apply. The schema silently diverges from dev. This is exactly the failure mode that is hardest to detect after the fact.

**Fix:** rename the later-shipped file in each pair to a unique valid timestamp, verify against a fresh `db:reset`, and add a CI check that fails on duplicate or malformed version prefixes.

### P1-2 (High) Booking ownership check passes on NULL

`supabase/functions/_shared/propertyScope.ts:313`:

```typescript
if (data.property_id && data.property_id !== propertyId) {
  throw new Error('Booking does not belong to this property');
}
```

When `property_id` is NULL the guard short-circuits and the function returns successfully, meaning the booking is treated as belonging to whichever property the caller claims.

**Impact:** in a multi-tenant deployment, any org or property admin can read and mutate any booking whose `property_id` is NULL by passing their own property ID. Legacy rows from before the property-scoping migration are the likely population, so the blast radius depends on backfill completeness.

**Fix:** decide the intended semantics and make them explicit. Almost certainly: `if (!data.property_id || data.property_id !== propertyId) throw ...`. Separately, count the rows with a NULL `property_id` in both the legacy and dev projects, backfill them, and add a `NOT NULL` constraint so the ambiguous state cannot return. Add a handler test for the NULL case.

### P1-3 (High) Backup captures only the public schema

`scripts/deploy/backup-supabase.sh:100-103` runs `supabase db dump --linked` and `--linked --data-only`, which default to the `public` schema. The script's own header says "public schema". Not captured: `auth.users`, `storage.objects`, storage bucket policies, `pg_cron` job definitions, and database roles.

**Impact:** a restore from these backups produces a database with intact application tables and no users. Every host and guest account is gone, all uploaded documents are orphaned (rows in `public` pointing at absent `storage.objects`), and every scheduled job is silently missing, which stops the security-deposit refund cron, calendar sync, and expiry sweeps with no error. The backup satisfies the pre-deploy checklist without being usable for recovery.

**Fix:** add `auth` and `storage` to the dump, capture `pg_cron.job` separately, and verify by restoring into a scratch project and signing in as a real user. A backup that has never been restored is not a backup.

### P1-4 (High) Super-admin allow list ships in the client bundle

`ui/src/lib/auth/superAdminAllowList.ts:13` reads `import.meta.env.VITE_SUPER_ADMIN_EMAILS`. Every `VITE_`-prefixed variable is inlined into the built JavaScript at compile time, so the full list of super-admin email addresses is a plain string in a public asset.

Worth stating clearly: this is **not** a privilege-escalation hole. The real boundary is the server-side `SUPER_ADMIN_EMAILS` check in the edge functions, and that is unaffected. The client list only drives whether `/admin/*` navigation renders.

**Impact:** information disclosure. It hands an attacker the exact account list to target with phishing or credential stuffing, which is meaningful because these accounts gate the platform console.

**Fix:** remove the client-side list. Have the server return a boolean capability (for example an `is_super_admin` claim or a field on an existing session or bootstrap endpoint) and gate the navigation on that. Then rotate nothing, but do audit for other `VITE_` variables carrying data that is merely unauthenticated rather than genuinely public.

Related: `ui/.env.production` was checked and contains no passwords or secrets, and no `.env*` file is tracked in git. An earlier reviewer's claim that database and OAuth secrets were exposed in `ui/.env.production` is incorrect and should not be actioned.

### P1-5 (High) Browser-side writes bypass the permission layer

Five hooks write to `guest_submissions` directly from the browser through PostgREST rather than through an edge function:

| Hook                         | Line |
| ---------------------------- | ---- |
| `useUpdateBooking.ts`        | 222  |
| `useRescheduleBooking.ts`    | 77   |
| `useClearBookingAsset.ts`    | 26   |
| `useSaveParkingRateGuest.ts` | 56   |
| `useEnsureNeedParking.ts`    | 41   |

The severity here is narrower than it first appears, and the nuance matters. `guest_submissions` does have scoped RLS as of `20261301140000` and `20261301170000`, so these are not unauthenticated writes: an org or property member is required. But `CLAUDE.md` is explicit that "RLS is not the access-control layer today", and these writes sit outside it, which costs three things the edge path provides:

1. **Granular permission leaves.** RLS checks org or property membership. It does not check `bookings:edit`. A Read Only team member who passes the membership test can write.
2. **Orchestrator invariants.** `.cursor/rules/booking-workflow.mdc` requires that only `workflowOrchestrator.transition()` mutates `status` and `status_updated_at`, with the compare-and-swap in `updateBookingStatus`. `useRescheduleBooking` and `useUpdateBooking` both write `status` directly. The reschedule path is a documented exception; the revert path in `useUpdateBooking` is a second one.
3. **Activity log coverage.** These writes emit no `activity_log` row, so the audit trail required by `.cursor/rules/audit-logging.mdc` has holes exactly where a host edits booking data.

**Impact:** a Read Only or Operations team member can likely edit booking pricing, dates, and assets. Concurrent edits can race without the CAS guard. The audit log under-reports host mutations.

**Fix:** move these five writes behind edge functions that run `resolveScopedPropertyAccess`, the matching permission leaf, and `logActivity`. Where the direct write is a deliberate documented exception (reschedule), keep it but add the permission check and the activity-log emission client-side of the boundary. Then re-run the audit-logging skill checklist over the bookings module.

### P1-6 (High) No production deploy path in CI

`.github/workflows/cd-prod.yml` is 69 lines and its deploy job is a placeholder:

```
line 59:  - name: Production deploy placeholder
line 64:    echo "Production CD scaffold only — mt-prod not created yet."
line 66:    echo "Until then, use local deploy with kamewave + docs/archive/operations/production-deployment.md"
```

The cutover gate above it (typed `CUTover` acknowledgement, `CUTOVER_ENABLED` repository variable, a warning when the production ref equals legacy) is real and well built. The step it gates does nothing.

**Impact:** the only way to deploy to production is a developer running `deploy:supabase` from a laptop. No audit trail of who deployed what, no guarantee the deployed tree matches a reviewed commit, no automatic pre-deploy backup, and no rollback trigger. This is consistent with the dual-track plan in [`ci-cd-environments/`](../in-progress/ci-cd-environments/README.md), which defers mt-prod to release, so the finding is really about sequencing: the workflow must be completed before cutover, not after.

**Fix:** implement the deploy job against the mt-prod project as part of the cutover checklist in `multi-tenant-dev-prod-environments.md` Phase B. Require a pre-deploy backup, a `db diff` review artifact, and a post-deploy smoke test (see P1-7) as job steps rather than as prose in a runbook.

### P1-7 (High) Smoke test proves only that Kong is up

`scripts/deploy/ci-smoke.sh:58-60` is the entire post-deploy verification:

```bash
HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "${BASE}/submit-form" || echo "000")"
```

An `OPTIONS` request is answered by the CORS preflight handler before any handler body runs.

**Impact:** this check passes against a deployment where all six functions from P0-1 are throwing `ReferenceError` on every real request, which is almost certainly what happened. A smoke test that cannot detect a total outage of the public surface provides false confidence, which is worse than having none.

**Fix:** smoke-test real `GET` requests against the public read endpoints (`list-public-properties`, `get-public-property`, `get-booked-dates`, `search-listings`) and assert a 200 with a plausible response shape. Wire it into both `cd-dev.yml` and the future `cd-prod.yml` as a gating step, and fail the deploy on a non-200.

---

## P2. Medium priority

### P2-1 (Medium) Deno tests skip type-checking

All three edge test scripts in `package.json` (lines 32, 33, 34) pass `--no-check`. Combined with P0-2 this means no layer of the pipeline ever type-checks Deno code.

**Fix:** drop `--no-check` once P0-2 lands and the backlog is triaged. Keep them as one change so the type-error backlog is paid down once.

### P2-2 (Medium) Zero component tests

`ui/vitest.config.ts` sets `environment: 'node'` and `include: ['src/**/*Test.ts', 'src/**/*.test.ts']`. No `.tsx` pattern and no DOM environment, so component tests cannot run even if written. The count confirms it: 25 unit tests, 0 component tests, against 2307 source files.

The config comment says this is deliberate, with DOM behavior covered by Playwright. That is a defensible trade, but the 48 E2E specs do not come close to covering 2307 files, and `.cursor/rules/testing.mdc` names Vitest as the unit layer for UI logic.

**Fix:** this is a judgment call for the team rather than a defect. Either add a `jsdom` project for the component layer and start with the highest-risk forms (guest form, booking edit, pricing), or write down the decision to rely on E2E so the gap is intentional and visible in `docs/guides/testing/README.md`.

### P2-3 (Medium) Playwright never tests a mobile viewport

`playwright.config.ts` sets a default viewport of 1440x960, and its projects use `devices['Desktop Chrome']` with the narrowest override at 900x960. There is no 375px project.

**Impact:** `.cursor/rules/mobile-native-ui.mdc` is always-on and its section 11 checklist requires verification at 375px and 768px on every UI change. That requirement is currently enforced by convention only. Nothing in CI can catch a phone-layout regression, horizontal overflow, a dropdown used where a bottom sheet is required, or a sub-44px touch target. For a product whose primary users are on phones, and with a mobile redesign still in progress, this is the widest gap between a stated invariant and its enforcement.

**Fix:** add a `mobile-chromium` project at 375x812 and run the `@smoke` tag against it. Add an assertion helper for horizontal overflow (`document.scrollWidth <= window.innerWidth`) and apply it to the primary guest and dashboard routes.

### P2-4 (Medium) Captcha config contradicts the docs

`supabase/config.toml` has `[auth.captcha] enabled = true` while the documentation states it is false. [`captcha-anti-spam-hardening.md`](../for-testing/captcha-anti-spam-hardening.md) describes the feature as env-flag gated and inert until Cloudflare Turnstile keys are provisioned.

**Impact:** if the local or dev stack enforces captcha without keys present, auth flows fail in a way that is confusing to debug. If the doc is right and the config is dead, then the config is misleading. Either way one of the two is wrong, and this sits on the auth path.

**Fix:** determine which is authoritative, correct the other, and confirm the Turnstile provisioning state before launch.

### P2-5 (Medium) CORS allows any Vercel subdomain

`supabase/functions/_shared/cors.ts` sets `ALLOWED_ORIGIN_SUFFIXES = ['.vercel.app']`. Any origin ending in `.vercel.app` is accepted, which includes every Vercel deployment on the internet, not only Kame's.

**Impact:** an attacker deploys a site to a free Vercel account and can then make credentialed cross-origin requests to the edge functions from a page they control. The practical exploitability depends on whether the endpoints rely on cookies or on an `Authorization` header (the latter is not automatically attached cross-origin), so this is a real weakening of the boundary rather than a direct hole.

**Fix:** replace the suffix match with an explicit allow list of the known preview and production hostnames, or scope the suffix to the project's own preview pattern. Preview deploys can be handled with a build-time-injected exact origin.

### P2-6 (Medium) `contract-expiry` cron is never scheduled

No migration references `contract-expiry`. Per `CLAUDE.md`, scheduled jobs run via hosted `pg_cron` and `pg_net` registered in migrations, not through `config.toml`.

**Impact:** whatever expiry sweep this function performs has never run in any environment. Because a cron that is not scheduled produces no error, this failed silently. Determine what expires (the name suggests parking or team contracts) and what has accumulated unprocessed.

**Fix:** either register the job in a migration or delete the function. Then reconcile the full list of functions against the full list of `pg_cron` entries and document the mapping, so a third orphan cannot hide the same way.

### P2-7 (Medium) `--include-all` hardcoded on dev deploys

`scripts/deploy/ci-deploy.sh:75` always passes `--include-all`, and `cd-dev.yml` inherits it. The script documents this as intentional so parallel-branch migration history does not block dev CD, and `deploy-supabase-dev.sh` offers `--no-include-all` for strict ordering.

**Impact:** `--include-all` applies pending migrations regardless of timestamp ordering relative to already-applied ones. Combined with the duplicate timestamps in P1-1, the dev project's schema may have been built in an order that a fresh environment will never reproduce. The risk is not dev breakage; it is that dev stops being a faithful rehearsal for the production cutover.

**Fix:** keep `--include-all` for day-to-day dev velocity, but add a scheduled job that runs `db:reset` plus a strict-order migration apply against a throwaway project and fails on drift. That is the only way to know the migration set is replayable before cutover day.

---

## P3. Reported but not independently verified

Triage after implementation:

- **Org, property, and parking dashboards (N+1, staleTime, virtualization):** deferred to [`performance-optimization-production-readiness.md`](../planned/performance-optimization-production-readiness.md). Not a launch blocker after the bundle split.
- **Super-admin console:** remaining Phase 6 backlog is already tracked in [`super-admin-console-followups.md`](../planned/super-admin-console-followups.md) and is not duplicated here.
- **Guest account and auth:** concurrent OTP send is single-flighted in `ui/src/features/guest/auth/lib/otpRequestGate.ts`. Session refresh on long-idle tabs is unchanged (existing Supabase Auth client).
- **Edge function error handling:** new mutating handlers use `serveAuthenticated` / `servePublic` and return non-2xx. A full historical sweep of 200+error bodies is not a launch blocker.
- **Missing indexes:** needs a `pg_stat_statements` pass against hosted dev, not a static read. Deferred.
- **UI copy and accessibility:** `@smoke` now asserts accessible names on visible controls (honeypots / `aria-hidden` excluded) and no document horizontal overflow at 375px / 768px. The for-hosts compare matrix scrolls inside the panel on phone.

## Suggested sequencing

1. **Unblock the product.** P0-1 and P0-2 together. The import fix is minutes; the type-check gate is what stops a recurrence. Do not ship the fix without the gate.
2. **Close the data and money exposure.** P0-4 and P0-5, plus the systemic sweeps each one implies (tables created without RLS, `SECURITY DEFINER` functions without a revoke). P1-2 belongs here as well.
3. **Make recovery real.** P0-6, P1-3, and P1-7. Rehearse a restore against dev and prove the smoke test fails a broken deploy. Do this before the cutover, not as part of it.
4. **Make the product fast.** P0-3. This is the largest single piece of work and the one most visible to guests. Route splitting first, then vendor chunks, then a CI budget.
5. **Close the pipeline gaps.** P1-1, P1-6, P2-1, P2-3, P2-7. These make the cutover itself trustworthy.
6. **Then the rest.** P1-4, P1-5, P2-2, P2-4, P2-5, P2-6, then triage P3.

P0-1 through P0-6 and P1-1 through P1-3 should all be closed before any production cutover. The remainder can ship in the weeks after, with the exception of P1-6, which is a cutover prerequisite by definition.

## Notes on what this audit did not cover

- **Live third-party behavior.** PayMongo in live mode, Meta App Review state, Resend inbound deliverability, and Google OAuth verification were read from code and docs, not exercised. See the manual guides under `docs/guides/testing/`.
- **Runtime data.** No queries were run against dev or legacy production, so row counts, actual index usage, slow queries, and the size of the NULL `property_id` population in P1-2 are unmeasured.
- **Load and capacity.** No load testing. Cost and quota behavior at scale is covered separately in [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md) and [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md).
- **Bundle measurement is from a Sep 12 build.** Re-run `bun run build` to confirm P0-3 numbers against current `main`.

Back to [in-progress](./README.md).
