---
title: 'Super Admin: System health (operator guide)'
status: active
tags: [guides, routes, admin]
updated: 2026-10-19
---

# Super Admin: System health

Routes:

- `/admin/health`: Overview
- `/admin/health/configuration`: edge + UI env vars, production posture
- `/admin/health/integrations`: live credential checks, tenant integration counters, AI reliability
- `/admin/health/jobs`: scheduled job heartbeats, database prerequisites, Vault parity, SQL-only cron jobs
- `/admin/health/usage`: AI spend, rate limits, database and storage capacity

Unknown sections (`/admin/health/foo`) redirect to `/admin/health`.

> **Status:** Route shell only. `/admin/health` and its section tabs render, and unknown sections redirect home. Check data, the edge function, and job heartbeats are not in the tree yet. Plan: [`super-admin-system-health.md`](../../../workflow/in-progress/super-admin-system-health.md).
> Page title: `System health` (`appPageTitle`). Page description under the title matches the active tab (overview, configuration, integrations, jobs, usage). Sidebar: **Platform → System health** (Activity icon).

## Progress overview

| Section       | E2E     | Validation | Docs | Notes                               |
| ------------- | ------- | ---------- | ---- | ----------------------------------- |
| Overview      | pending | n/a        | Spec | Tab only. Checks are not wired yet. |
| Configuration | pending | n/a        | Spec | Tab only. Checks are not wired yet. |
| Integrations  | pending | n/a        | Spec | Tab only. Checks are not wired yet. |
| Jobs          | pending | n/a        | Spec | Tab only. Checks are not wired yet. |
| Usage         | pending | n/a        | Spec | Tab only. Checks are not wired yet. |

---

## Host-facing knowledge

System health is a super-admin-only page. Hosts never see it.

**Common operator questions**

- Q: Does opening this page use up any third-party quota?
  A: No. The page reads saved results from our own database. Third-party services are only contacted when you press **Run live checks**, and those checks use free metadata calls (listing domains, listing models, verifying a key), never sends or AI generations. Each check can run at most once a minute.
- Q: What do the colors mean?
  A: Red means something is broken now. Amber means it works but needs attention soon (expiring token, missing recommended setting, a job that missed a run). Grey "Unknown" means we have no data yet. Grey "Off" means the feature is not configured and that is allowed here (for example, production-only settings on a dev project).
- Q: A scheduled job shows "No runs recorded yet". Is it broken?
  A: Not necessarily. Jobs report in after their next run. If it stays that way past the job's interval, check that the job's Vault secret and edge secret match.
- Q: A token shows as expiring. What do I do?
  A: For Meta page tokens, the host must reconnect the page in Inbox settings. For platform keys (Resend, Gemini, PayMongo, Turnstile), create a new key in that provider's dashboard and update the edge secret.
- Q: Why does a setting show "Missing" here but things seem to work?
  A: Recommended settings have fallbacks. The hint explains what is degraded without it.
- Q: How do I fix an issue from here?
  A: Each issue has a short hint. **Manage** opens the right dashboard (Supabase secrets, Vault, function logs, or the provider's key page). **Check now** re-runs just that live check after you fix it. Rows that list hosts link to that organization so you can contact them.
- Q: Telegram alerts show "missing a token or chat". What does that mean?
  A: The host turned the alert on but never added the bot token or chat, so nothing is sent. Open the organization from the list and ask the host to finish the Telegram setup.

---

## Behavior notes

- **Data path.** `useSystemHealth` → `GET super-admin-system-health?view=summary` (`staleTime` 60s,
  refetch every 2 min). The function makes **one** RPC (`get_system_health_snapshot`) plus in-memory
  `Deno.env` reads; it never calls a third party. UI env checks are evaluated client-side from
  `uiEnvRegistry.ts#readUiEnv()` (build-time Vite values) and merged into the same list.
- **Status model.** `ok | warn | error | off | unknown`; rollups take the worst (`error` > `warn` >
  `unknown` > `ok` > `off`). Env requirement levels: `required` (error when missing anywhere),
  `prodRequired` (error in production, off elsewhere), `recommended` (warn), `prodRecommended`,
  `optional`. Production = `ENVIRONMENT` / `DENO_ENV` set to `production` or `prod`. UI checks use the
  server's environment.
- **Secrets are never returned.** Env checks report `Set`, a count (`GEMINI_API_KEYS`, `*_EMAILS`),
  or a validation result (AES-256 key length, URL shape, VAPID JSON, Sentry DSN, PayMongo
  `sk_live_`/`sk_test_`). Only non-secret keys (URLs, `ENVIRONMENT`, app name) show their value.
  Vault is read for **names** only.
- **Coverage.** Every `Deno.env.get` key used by edge functions and every `import.meta.env.VITE_*`
  key used by the UI has a registry row (tuning knobs show `Default N` when unset; legacy social URL
  fallbacks are grouped under **Legacy**). New keys this round: `REVIEW_IDENTITY_PEPPER`
  (prodRecommended), `META_OAUTH_EXTRA_SCOPES`, `CALENDAR_SYNC_MIN_INTERVAL_MINUTES`,
  `AI_ASSISTANT_ATTACHMENT_RETENTION_DAYS`, `GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS`,
  `FACEBOOK_REVIEWS_URL` / `AIRBNB_URL` / `INSTAGRAM_URL` / `TIKTOK_URL`; UI
  `VITE_SUPABASE_PROJECT_URL`, `VITE_PLATFORM_CONTACT_PHONE`, `VITE_PLATFORM_SOCIAL_*`,
  `VITE_POSTHOG_HOST` / `_INGEST_PATH` / `_SESSION_REPLAY`, `VITE_APP_TRACK`,
  `VITE_SUPABASE_IMAGE_TRANSFORMS`, `VITE_IMAGE_OPT_SURFACES`.
- **UI and edge match** (Configuration): compares the UI build's Supabase project ref
  (`VITE_SUPABASE_URL`) with the edge runtime's, and `VITE_VAPID_PUBLIC_KEY` with the public half of
  `VAPID_KEYS`. Skipped when either side cannot be compared (local URLs).
- **Production posture** (Configuration, Security group): guest booking access enforcement,
  `CAPTCHA_MODE`, AI response cache, inline background tasks, Gemini model override,
  `META_OAUTH_EXCLUDE_PUBLISHING_SCOPES=1` (new Meta connections cannot publish), `EDGE_LOG_DEBUG=1`;
  UI build: `VITE_NODE_ENV` must be `production` (otherwise the guest form shows dev controls),
  `VITE_INBOX_MOCK_DATA=true`, `VITE_DISABLE_IMAGE_OPTIMIZATION=1`; plus platform
  settings (maintenance mode, signups, authenticated rate-limit enforcement) and AI switches (platform
  AI on, quota enforcement). Rows with a fix link go to Platform settings or the AI console.
- **Jobs.** Every `serveCronPost` function, plus `sd-refund-cron` (unscoped runs), `calendar-sync-cron`
  (global sweep) and `superhost-assessment-cron` (cron-secret runs), writes one row per run to
  `system_job_heartbeats` via `record_system_job_heartbeat`. Auth failures are not recorded. The
  expected interval comes from the matching `cron.job` schedule (matched by `/functions/v1/<fn>` in the
  command). Status order: not used in production → off; no pg_cron → unknown; not scheduled / paused →
  warn in production, off elsewhere; 3+ consecutive failures → error; no heartbeat → unknown; last run
  failed → warn; no success within 2× interval + 10 min → warn; else ok. Cron jobs that do not call an
  edge function are listed under **SQL jobs**.
- **Database checks** (Jobs page): `pg_cron` / `pg_net` installed, Vault `project_url` / `anon_key`,
  per-job secret parity between the edge secret and its lowercase Vault twin (edge set + Vault missing =
  error, because every call 401s), database size vs 8 GB (warn 80%, error 95%).
- **Live checks.** `POST { action: 'run_probes', probes? }` runs configured probes not checked in the
  last 60s, upserts `system_health_probe_results`, and returns the merged checks. Probes: Resend
  domains (sender domain verified), Gemini `models` per key, Groq `models`, PayMongo webhooks (an
  enabled `paymongo-webhook` endpoint), Meta app token + `debug_token` for up to 20 connected page
  tokens (oldest first), Turnstile siteverify with a dummy response, Jamendo `tracks?limit=1`,
  Supabase Auth settings (Google enabled), Telegram `getMe` for each distinct enabled bot token across
  the 7 Telegram config tables (decrypted in memory, capped at 20, rejected tokens list the affected
  org and unit). 5s timeout each. Read-only, so no step-up OTP and no audit row. **Check now** on a
  row posts `probes: [id]` for just that probe.
- **Tenant integration counters** (from the snapshot, no third-party calls): Meta connections
  (error / expired / expiring in 7 days; webhook failing or not verified in 24h), iCal feeds (failing /
  stale 6h), Telegram bots enabled without a token or chat, push subscriptions (failing), Marketing
  Studio jobs (24h failures, stuck >30 min), voice canary (production with no report = off). Problem
  rows list up to 5 affected orgs/pages/feeds with links to `/admin/orgs/<slug>`.
- **Real-traffic checks** (snapshot, 24h / 7d): Gemini and Groq calls with failures, rate-limit
  (`rate_limited`) and rejected-key (`auth`) counts from `ai_platform_usage_events` (rejected key =
  error, rate limited or >10% errors = warn); email bounces and complaints (any complaint or 10+
  bounces = warn); inbound approval emails received / unmatched (only when
  `RESEND_INBOUND_WEBHOOK_SECRET` is set); PayMongo webhook events (only when PayMongo is configured).
- **Actions.** Issue rows can show **Manage** (external: Supabase secrets / Vault / extensions /
  function logs from the project ref, or the provider's key console), **Check now** (single probe),
  and a chevron to the in-app fix page. Overview issues deep link to
  `/admin/health/<section>#check-<id>`; the row scrolls into view and is highlighted briefly.
  Configuration and Integrations have a search box (key, label, group, feature).
- **AI reliability** (Integrations): reuses `super-admin-ai-usage?range=30d`; features with ≥20 calls
  warn above 10% errors or 20% fallback.
- **Usage.** Reuses `useSuperAdminAiUsage('30d')` (AI spend + top 6 features by cost) and
  `useSuperAdminRateLimits`. Capacity comes from `GET ?view=capacity` (`get_system_health_capacity`: DB
  size, top 10 tables, per-bucket storage), loaded only on this page, `staleTime` 10 min. Storage total
  is shown against 100 GB (Supabase Pro included storage).
- **Overview → Needs attention.** `/admin` shows a **System health issues** row (count of error + warn
  across server, UI env and UI/edge match checks, same list as this page) linking here.

## Permissions

Super admin only (`serveSuperAdmin`). Plans: **N/A** (platform operator tool). Team RBAC: **N/A**
(no org scope). Activity log: **N/A** (read-only; probe results are platform cache rows, not org data).

## Testing

| Layer     | File                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge unit | `supabase/functions/_shared/systemHealth/*_test.ts` (env levels, defaults, posture, manage links, no secret leakage; cron parser + job status order; probe classifiers incl. Telegram + Meta token; Vault parity / DB size / tenant counters + drill-downs; AI / email / payments traffic; project ref) |
| UI unit   | `ui/src/features/dashboard/super-admin/lib/systemHealth/*.test.ts` (UI env, UI posture, UI and edge match)                                                                                                                                                                                              |
| E2E       | `ui/e2e/features/admin/adminSystemHealth.spec.ts` (`@ci`, overview `@smoke`; deep link highlight, search, Manage / Check now / items, job Logs link)                                                                                                                                                    |
| Manual    | Run live checks against local secrets; 375 / 768 / 1280 px                                                                                                                                                                                                                                              |

## Implementation map

| Concern          | Path                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Page             | `ui/src/features/dashboard/super-admin/pages/SuperAdminHealthPage.tsx`                                                                     |
| Sections         | `components/super-admin-health/Health{Overview,Integrations,Jobs,Usage}Section.tsx`, `HealthCheckList.tsx`, `HealthStatusBadge.tsx`        |
| Hooks            | `hooks/useSystemHealth.ts` (`useSystemHealth`, `useSystemHealthCapacity`, `useRunHealthProbes`)                                            |
| UI lib           | `lib/systemHealth/{healthStatus,healthSections,uiEnvRegistry,aiReliability}.ts`                                                            |
| Edge function    | `supabase/functions/super-admin-system-health/index.ts`                                                                                    |
| Edge lib         | `supabase/functions/_shared/systemHealth/{types,envRegistry,jobsRegistry,jobHeartbeat,snapshotChecks,probes,probeClassifiers}.ts`          |
| Heartbeat wiring | `_shared/serveEdge.ts#serveCronPost`, `withCronHeartbeat` in `sd-refund-cron`, `calendar-sync-cron`, `superhost-assessment-cron`           |
| Migration        | `20261316127100_system_health_monitoring.sql`, `20261316127800_system_health_snapshot_v2.sql` (Telegram, AI providers, email, drill-downs) |

**Adding a new env var or cron:** add a row to `EDGE_ENV_REGISTRY` (edge) or `UI_ENV_REGISTRY` (UI), and
a `SCHEDULED_JOBS` entry for a new scheduled function (its cron secret is added to the env registry
automatically).
