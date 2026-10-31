---
stage: in-progress
title: 'Super Admin: System health module'
status: in-progress
tags: [planning, super-admin, admin, observability, health, env, integrations, cron]
updated: 2026-10-22
---

# Super Admin: System health module

## 1. Goal

Give platform operators one place under `/admin/health` that answers "is every part of the app
configured and working right now, and if not, what do I fix?". It checks UI and edge environment
variables, third-party credentials (expired, revoked, or wrong-mode keys), scheduled jobs, database
prerequisites (pg_cron, pg_net, Vault secrets), tenant integration health (Meta tokens, calendar
feeds, push), and reuses the existing AI and rate-limit usage data. Every check reports one of
**OK / Warning / Error / Off / Unknown**, names the features it affects, and gives a fix hint.

The monitor must be close to free to run: passive checks read env and a handful of indexed rows;
live third-party calls only happen on demand (or once a day later), only hit free metadata
endpoints, never send email/messages, never spend AI tokens, and are throttled server-side.

## 2. Scope

**In**

- New super-admin module `/admin/health` with five pages: Overview, Configuration, Integrations,
  Jobs, Usage.
- Env registry for edge secrets and UI `VITE_*` build vars: required level, feature mapping,
  format validation, production-only rules, unsafe dev flags left on in production.
- Database snapshot RPC: extensions, registered pg_cron jobs, Vault secret presence (names only),
  DB size, integration counters.
- Job heartbeats: one row per scheduled edge function, written by `serveCronPost` (and the three
  crons that use raw `serve`), staleness derived from the registered cron schedule.
- Live probes (on demand, throttled, cached in DB): Resend, Gemini (each key), Groq, PayMongo,
  Meta app credentials + page tokens, Turnstile, Jamendo, Supabase Auth Google provider.
- Usage page reusing `super-admin-ai-usage` and `super-admin-rate-limits`, plus a capacity view
  (DB size, largest tables, storage per bucket).
- A "System health" row on the existing `/admin` Overview **Needs attention** panel.

**Out (this plan)**

- Cost metering, budgets, limits, degrade engine: owned by
  [`super-admin-service-cost-monitoring.md`](../planned/super-admin-service-cost-monitoring.md). When it
  ships, its console becomes a **Costs** page inside this module instead of a separate
  `/admin/service-health` route.
- Provider usage APIs that need extra privileged tokens (Supabase Management API, PostHog
  personal key, Vercel token). Same reason as above (amendment A9 there).
- Email delivery history: there is no send log today. Resend is checked by credentials and domain
  status only.
- Per-tenant Telegram bot checks (`getMe` per property). Listed under "Not monitored" with a reason.
- Editing env vars from the UI. Env stays in Vercel / Supabase secrets; the page only reports.

## 3. Design

### 3.1 Status model (shared UI + edge shape)

```ts
type HealthStatus = 'ok' | 'warn' | 'error' | 'off' | 'unknown';

type HealthCheck = {
  id: string; // stable, e.g. 'env.edge.RESEND_API_KEY', 'job.calendar-sync-cron'
  category: 'configuration' | 'integrations' | 'jobs' | 'database' | 'security' | 'usage';
  group: string; // 'Email', 'AI', 'Payments', ...
  label: string;
  status: HealthStatus;
  detail?: string; // one short line: 'Missing', 'Last success 3h ago (expected every 30m)'
  hint?: string; // one short fix line
  features?: string[]; // 'Booking emails', 'Guest inbox'
  checkedAt?: string;
  fixHref?: string; // in-app link (e.g. /admin/ai?tab=controls)
};
```

Rollup: category status = worst child (`error` > `warn` > `unknown` > `ok` > `off`). Overall
status = worst category. `off` means "optional and intentionally not configured", never counted
as a problem.

### 3.2 Requirement levels for env vars

| Level             | Missing in dev | Missing in production |
| ----------------- | -------------- | --------------------- |
| `required`        | error          | error                 |
| `prodRequired`    | off            | error                 |
| `recommended`     | warn           | warn                  |
| `prodRecommended` | off            | warn                  |
| `optional`        | off            | off                   |

Plus per-var `validate(value)` (e.g. encryption key must decode to 32 bytes, `VAPID_KEYS` must be
JSON with both keys, Sentry DSN must parse, PayMongo `sk_test_` in production = warn) and
"posture" rules (a set value that is unsafe in production: `AI_RESPONSE_CACHE_DISABLED=1`,
`EDGE_INLINE_BACKGROUND_TASKS=1`, `GUEST_BOOKING_ACCESS_ENFORCE` not `true`, `CAPTCHA_MODE` not
`enforce`, `GEMINI_MODEL_OVERRIDE*` set). Production = `ENVIRONMENT` / `DENO_ENV` in
`production|prod` (same rule as `cronSecretGate.ts`). UI production = `import.meta.env.PROD &&
VITE_NODE_ENV === 'production'`.

**Secret values never leave the edge function.** Responses carry presence, validation result,
and for non-secret values (origins, hosts, app name) the value itself. Lists (`SUPER_ADMIN_EMAILS`,
`GEMINI_API_KEYS`) report a count only.

### 3.3 Data sources and cost per page load

| Source                                     | How                                                                    | Cost                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------ |
| Edge env                                   | `Deno.env.get` over the registry inside `super-admin-system-health`    | 0 network, ~70 reads                 |
| UI env                                     | `import.meta.env` over a client registry (reflects the deployed build) | 0                                    |
| DB snapshot                                | one `SECURITY DEFINER` RPC `get_system_health_snapshot()`              | 1 round trip, small tables           |
| Job heartbeats                             | `system_job_heartbeats` (one row per job) inside the same RPC          | included                             |
| Last live probe results                    | `system_health_probe_results` (one row per probe) inside the same RPC  | included                             |
| AI usage / rate limits                     | existing `super-admin-ai-usage` / `super-admin-rate-limits`            | existing endpoints, Usage page only  |
| Capacity (table sizes, storage per bucket) | separate `?view=capacity`, Usage page only, 10 min client stale time   | one aggregate over `storage.objects` |

The summary call is the only request on Overview / Configuration / Jobs / Integrations. Client
`staleTime` 60 s, no polling.

**Deliberately not read:** `cron.job_run_details` (unbounded, no `jobid` index, and for
`net.http_post` jobs it only proves the request was queued). Heartbeats written by the edge
function itself are the real signal. `cron.job` (small) gives registration, schedule and
`active`.

### 3.4 Job heartbeats

```sql
CREATE TABLE public.system_job_heartbeats (
  job_name             TEXT PRIMARY KEY,          -- edge function name
  last_started_at      TIMESTAMPTZ,
  last_finished_at     TIMESTAMPTZ,
  last_success_at      TIMESTAMPTZ,
  last_failure_at      TIMESTAMPTZ,
  last_status          TEXT CHECK (last_status IN ('ok','error')),
  last_error           TEXT,                       -- truncated to 500 chars, no PII
  last_duration_ms     INT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  total_runs           BIGINT NOT NULL DEFAULT 0,
  total_failures       BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- record_system_job_heartbeat(p_job, p_ok, p_duration_ms, p_error): one atomic upsert,
-- SECURITY DEFINER, service_role only.
```

- Written once per run from `serveCronPost` after `run()` resolves or throws. Never blocks or
  fails the cron (try/catch, logged). Unauthorized (401) calls are not recorded.
- Every-minute jobs produce one single-row update per minute (HOT update, no table growth).
- Expected interval comes from the registered cron expression (`cron.job.schedule`) via a small
  pure parser: `* * * * *` 1 min, `*/N * * * *` N min, `M * * * *` 60, `M H * * *` daily,
  `M H * * D` weekly, `M H D * *` monthly. Staleness: no success within `2 x interval + 10 min`
  = warn; `consecutive_failures >= 3` = error; last run failed = warn.
- A job maps to its edge function by matching `/functions/v1/<name>` in `cron.job.command`, so
  dynamically named jobs (Telegram per-slot jobs) need no hardcoded list. SQL-only jobs (for
  example `ai-data-retention-nightly`) show registration only.
- A scheduled function with no registered cron job shows **Not scheduled** (warn in production,
  off in dev), with the `SELECT public.sync_<x>_cron_job();` hint.

### 3.5 Live probes

All probes: 5 s timeout each, run in parallel, results upserted into
`system_health_probe_results (probe_id PK, status, detail, latency_ms, checked_at, meta JSONB)`.
A probe re-runs at most once per 60 s; inside that window the cached row is returned. A probe whose
env is missing is reported `off`/`error` from config without any network call.

| Probe                | Endpoint (free metadata only)                                                              | Error / warn signals                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Resend               | `GET api.resend.com/domains`                                                               | 401/403 key invalid; `RESEND_FROM_EMAIL` domain not `verified`           |
| Gemini (each key)    | `GET generativelanguage.googleapis.com/v1beta/models?pageSize=1`                           | 400 invalid key, 403 disabled/leaked key, 429 quota                      |
| Groq                 | `GET api.groq.com/openai/v1/models`                                                        | 401 invalid, 429 limited                                                 |
| PayMongo             | `GET api.paymongo.com/v1/webhooks`                                                         | 401 invalid; no enabled webhook to `/paymongo-webhook`; test key in prod |
| Meta app             | `GET graph.facebook.com/oauth/access_token` (client credentials)                           | invalid app id/secret                                                    |
| Meta page tokens     | `GET graph.facebook.com/debug_token` for up to 20 connected channels, soonest expiry first | `is_valid=false`, expires in < 7 days                                    |
| Turnstile            | `POST challenges.cloudflare.com/turnstile/v0/siteverify` with a dummy response             | `invalid-input-secret` = key bad; `invalid-input-response` = key OK      |
| Jamendo              | `GET api.jamendo.com/v3.0/tracks?limit=1`                                                  | non-200                                                                  |
| Supabase Auth Google | `GET <SUPABASE_URL>/auth/v1/settings` with anon key                                        | `external.google` false                                                  |

Gemini quota exhaustion is better seen in real traffic, so the Integrations page also flags AI
**fallback rate > 20 %** or **error rate > 10 %** over the last 30 days from the existing AI
usage data.

Not probed (presence/format only): PostHog (no free auth check without a personal key), Sentry
(format), VAPID (parsed locally), Google Maps (every call is billable), Telegram bots
(per-tenant, see Out).

### 3.6 Integration (tenant) health, passive

From the snapshot RPC, counts only (no tenant secrets):

- Meta channels: connected / error / disconnected, tokens expired, expiring in 7 days, webhook
  not verified in 24 h (`webhook_last_verified_at`).
- Calendar feeds: active, failing (`consecutive_failures >= 4`), stale (no success in 6 h).
- Push: subscriptions active / disabled (`disabled_at`), high failure count.
- Marketing generation jobs: failed in 24 h, stuck in flight > 30 min.
- Voice receptionist: `ai_platform_global_settings.voice_receptionist_health_*`.
- Webhook freshness: last `processed_paymongo_events.created_at`, last
  `social_webhook_events.processed_at` (informational, no threshold; low traffic is normal).

### 3.7 Database checks

- Extensions `pg_cron`, `pg_net` installed (error in production when missing).
- Vault secrets present by **name only**: `project_url`, `anon_key`, `push_fanout_secret`, each
  `<job>_cron_secret` the registry expects. Missing `project_url`/`anon_key` = every cron is
  unscheduled = error.
- Edge env vs Vault parity for cron secrets: env set but Vault missing (or the reverse) = error
  in production (cron calls get 401).
- DB size vs a plan reference (8 GB Pro): warn at 80 %, error at 95 %.

### 3.8 Security posture (a group inside Configuration)

Production only: guest booking access enforcement off, CAPTCHA not enforcing, authenticated rate
limit in log-only mode (`platform_settings`), maintenance mode on, signups closed, AI platform kill
switch on (info), unsafe dev flags set. Each links to the setting that fixes it.

### 3.9 UI structure

Routes (nested under `SuperAdminShell`, all `usePageTitle(appPageTitle('System health - <page>'))`):

| Route                         | Page                                                                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/health`               | **Overview**: overall status hero (donut + counts), category tiles with per-status stacked bar, issues list (errors then warnings) with hint + link, "Run live checks" button + last run time |
| `/admin/health/configuration` | Edge + UI env tables grouped by area (Core, Email, AI, Payments, Meta, Security, Push, Observability, Cron secrets), status filter segmented control, security posture group                  |
| `/admin/health/integrations`  | Live probe cards per provider (status, latency, last checked, detail) + tenant integration counters + AI reliability flags                                                                    |
| `/admin/health/jobs`          | One row per scheduled function: schedule, last success, duration, failures, a "time since last success vs expected interval" bar; unregistered and SQL-only jobs; DB prerequisites            |
| `/admin/health/usage`         | AI spend trend + feature reliability (reused data), rate-limit summary, capacity (DB size gauge, largest tables, storage per bucket)                                                          |

- One sidebar entry **System health** (Platform group, `Activity` icon); pages switch with
  `SuperAdminSecondaryNav` (same as AI console).
- Mobile first at 375 px: cards and stacked rows, no wide tables (tables only from `lg`), status
  filters as `SegmentedControl` `size="dense"`, all buttons >= 44 px hit area, no dialogs needed.
- Status colors always paired with a text badge and icon (not color alone).
- Loading: page header stays mounted, layout-matched skeleton for the data region; route-level
  `SuperAdminSettingsRouteSkeleton`.
- Copy: labels only; one short hint line per failing check.

### 3.10 Server API

`super-admin-system-health` (`serveSuperAdmin`, `verify_jwt = false`):

| Method | Params / body                                 | Returns                                                                                                     |
| ------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `?view=summary` (default)                     | `{ generatedAt, environment, checks: HealthCheck[], jobs: JobRow[], integrations: {...}, probesLastRunAt }` |
| GET    | `?view=capacity`                              | `{ dbSizeBytes, dbLimitBytes, tables: [...top 10], buckets: [...] }`                                        |
| POST   | `{ action: 'run_probes', probes?: string[] }` | `{ results: HealthCheck[] }`; throttled per probe (60 s)                                                    |

POST is read-only diagnostics (no tenant or platform state changes besides the probe cache), so no
step-up OTP and no audit row.

## 4. Decisions required by repo gates

- **Plans:** N/A. Platform super-admin tool, not a host feature.
- **Team RBAC:** N/A. Gated by `SUPER_ADMIN_EMAILS` via `serveSuperAdmin` / `RequireSuperAdmin`.
- **Activity log:** N/A. Heartbeats and probe cache are platform-only system rows with no org
  scope; running probes mutates nothing operator-visible.
- **Assistant parity:** exempt (`serveSuperAdmin`).
- **Unsaved changes:** exempt, no editable forms.
- **PostHog:** N/A for the read/diagnostic endpoint.

## 5. Implementation tasks

Phases 1 to 4 shipped (local only, not deployed). Layout differs slightly from the task list:
cron interval parsing lives in `jobsRegistry.ts`; DB, posture and tenant integration checks live in
`snapshotChecks.ts`; the UI uses one `SuperAdminHealthPage` with `super-admin-health/*Section.tsx`
components instead of a layout + per-section pages. Route guide:
[`admin/health.md`](../../guides/routes/admin/health.md).

### Phase 1: Foundation + Configuration

- [x] `supabase/functions/_shared/systemHealth/types.ts`: `HealthStatus`, `HealthCheck`, rollup helpers.
- [x] `supabase/functions/_shared/systemHealth/envRegistry.ts`: edge env registry (level, group,
      features, secret flag, validator, posture rule) + `evaluateEdgeEnv(env, isProd)`.
- [x] `supabase/functions/_shared/systemHealth/envRegistry_test.ts`: levels x environments,
      validators (32-byte key, VAPID JSON, DSN, PayMongo mode), never returns secret values.
- [x] `ui/src/features/dashboard/super-admin/lib/systemHealth/` : `healthStatus.ts` (rollup,
      sort, labels), `uiEnvRegistry.ts` (+ evaluator), tests for both.
- [x] `supabase/functions/super-admin-system-health/index.ts` GET summary (env only first).
- [x] `supabase/config.toml` entry (`verify_jwt = false`).
- [x] `superAdminPaths.health*`, nav item, routes, `SuperAdminHealthLayout` (secondary nav),
      `useSystemHealth` hook, Overview + Configuration pages, shared `HealthStatusBadge`,
      `HealthCheckList`, `HealthCategoryTile`, `HealthOverviewDonut`.

### Phase 2: Database + Jobs

- [x] Migration `<ts>_system_health_monitoring.sql`: `system_job_heartbeats`,
      `system_health_probe_results`, `record_system_job_heartbeat()`,
      `get_system_health_snapshot()` (extensions, `cron.job` rows, Vault names, DB size,
      integration counters, heartbeats, probe rows, platform posture flags). RLS on, no
      policies; `REVOKE ... FROM PUBLIC, anon, authenticated`; grant `service_role`.
- [x] `_shared/systemHealth/jobHeartbeat.ts#recordJobHeartbeat` (never throws).
- [x] Wire into `serveCronPost`; add explicit calls to `sd-refund-cron` (unscoped runs),
      `calendar-sync-cron` (global sweep only), `superhost-assessment-cron`.
- [x] `_shared/systemHealth/cronSchedule.ts#expectedIntervalMinutes` + `_test.ts`.
- [x] `_shared/systemHealth/jobsRegistry.ts` (function -> secret env + Vault name) +
      `evaluateJobs(...)` + `_test.ts` (stale, failing, unscheduled, SQL-only, never run).
- [x] Jobs page + database group on Overview.

### Phase 3: Integrations + live probes

- [x] `_shared/systemHealth/probes.ts`: probe registry, `runProbes(ids, env)` with timeouts and
      throttle; pure response classifiers in `probeClassifiers.ts` + `_test.ts`.
- [x] POST `run_probes` in the edge function; summary merges cached probe rows.
- [x] Passive tenant integration evaluation (`evaluateIntegrations(snapshot)`) + test.
- [x] Integrations page + "Run live checks" on Overview.

### Phase 4: Usage + entry points

- [x] GET `?view=capacity` (RPC `get_system_health_capacity()`).
- [x] Usage page reusing `useSuperAdminAiUsage('30d')`, `useSuperAdminRateLimits()`, capacity hook.
- [x] AI reliability checks (fallback/error rate) on Integrations.
- [x] `/admin` Overview **Needs attention**: "System health issues" row linking to `/admin/health`
      (count from the summary query, lazy, no extra endpoint).

### Phase 4b: Review pass (coverage, accuracy, actions, UX)

- [x] Coverage diff: every edge `Deno.env.get` and UI `import.meta.env.VITE_*` key has a registry
      row or posture rule (tuning defaults, legacy fallbacks, `REVIEW_IDENTITY_PEPPER`, UI build
      posture: `VITE_NODE_ENV`, inbox mock, image kill switch).
- [x] Snapshot v2 (`20261316127800`): Telegram bots enabled without credentials, Meta webhook
      failing, AI provider rate-limit / rejected-key errors (24h), email bounces / complaints /
      inbound approvals (7d), affected-org drill-downs (max 5). Still one RPC, ~5 ms locally.
- [x] Telegram `getMe` probe (distinct enabled tokens, max 20); Meta page probe names affected pages.
- [x] UI and edge match: project ref + VAPID public key.
- [x] Actions: Manage (Supabase secrets / Vault / extensions / function logs, provider consoles),
      Check now per probe, deep links from Overview to the exact row, job Logs link, org links.
- [x] UX: search on Configuration and Integrations, masonry group layout on desktop, issue list
      capped at 8 with Show all, live-check age on phone, AI by feature + storage vs 100 GB on Usage,
      active section tab scrolls into view, `/admin` attention count uses the same merged list.
- [x] Tests: Deno (44 in `systemHealth/`), Vitest UI posture + parity, E2E deep link / search /
      Manage / Check now / Logs.

### Phase 5: Scheduled checks + alerts (follow-up, not in the first pass)

- [ ] `system-health-cron` daily: run probes, diff against last status, email
      `SUPER_ADMIN_EMAILS` only on transitions to error (deduped), `system.cron_run`-style
      heartbeat. Needs `SYSTEM_HEALTH_CRON_SECRET` + Vault + `sync_system_health_cron_job()`.
- [ ] Meta page tokens expiring in 7 days included in that email.

### Phase 6: Costs page (when the cost plan ships)

- [ ] Mount the service cost console as `/admin/health/costs`.

## 6. Testing

| Layer     | Where                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Deno unit | `_shared/systemHealth/{envRegistry,cronSchedule,jobsRegistry,probeClassifiers,integrations}_test.ts` |
| Vitest    | `ui/src/features/dashboard/super-admin/lib/systemHealth/*.test.ts`, nav + paths tests                |
| Migration | `bun run db:migrate` locally; call both RPCs as service role                                         |
| Manual    | `/admin/health` at 375 / 768 / 1280 px; run live checks against local secrets                        |

## 7. Docs to update

- New route guide `docs/guides/routes/admin/health.md` + row in `docs/guides/routes/README.md`.
- `docs/guides/routes/admin/overview.md` (Needs attention row).
- `docs/architecture/validation-and-env.md`: note that new env vars must be added to the health
  registries (edge + UI) in the same change.
- `docs/PROJECT.md` + `docs/architecture/edge-functions.md`: new function + tables.
- `docs/archive/operations/scheduled-jobs-and-testing.md`: heartbeats section.
- `.cursor/rules/admin-auth.mdc`: new `serveSuperAdmin` endpoint (not step-up gated, why).
- `super-admin-service-cost-monitoring.md`: its console moves under `/admin/health/costs`.

## 8. Open questions

None blocking. Defaults chosen: probes on demand only in the first pass; DB size reference 8 GB
(Supabase Pro), adjust the constant if the plan changes.
