---
stage: planned
title: 'Observability split: Sentry for errors, PostHog for analytics'
status: planned
tags: [workflow, planned, observability, sentry, posthog, analytics, error-tracking]
updated: 2026-11-01
kind: plan
---

# Observability split: Sentry for errors, PostHog for analytics

## Goal

Give each vendor one job across the whole app (browser, service worker, edge functions,
crons, webhooks):

- **Sentry** owns every error, crash, failed request, failed cron, failed webhook,
  third-party fault, release health, source maps, uptime and error alerting.
- **PostHog** owns product analytics only: pageviews, named product events, funnels,
  identify, groups, (optional, masked) session replay. No exception capture, no
  error alerts, no error source maps.

When this ships, an engineer answers "what broke, for whom, in which release, and did
it page us?" in Sentry, and a product question ("where do Facebook guests drop off the
booking form?", "how fast do new orgs publish a listing?") in PostHog. The two are joined
by shared ids (user id, org/property ids, request id, release), never by duplicating data.

## Why now

Today both vendors receive every exception:

- `supabase/functions/_shared/httpResponse.ts#handleEdgeError` sends each 5xx to
  `capturePostHogException` **and** `captureSentryException`.
- `AppErrorBoundary` and `RouteErrorFallback` call `captureAppException` (PostHog) **and**
  `captureSentryException`.
- `posthog-js` init has `capture_exceptions` on, so PostHog also auto-captures window
  errors and unhandled rejections; Sentry does **not** (the browser shim only reports
  errors that are explicitly passed to it).
- Source maps upload to PostHog (`@posthog/rollup-plugin`), so Sentry stack traces are
  minified.
- `serveCronPost` and ten raw `serve()` functions (including `submit-form`,
  `submit-sd-form`, `submit-pay-parking` and `sd-refund-cron`) report errors to
  **PostHog only**, so Sentry cannot see failures on the booking and money paths.
  `superhost-assessment-cron` reports nowhere.
- Non-errors are pushed through the PostHog exception pipe as a "structured logger"
  (`captcha.ts#logCaptchaEvent`, `antiSpam.ts` heuristic blocks).

Result: duplicated exception history, Sentry blind to most browser errors, no cron
monitoring, no error alerting that anyone has configured, and PostHog billing for
exceptions it should not own. Separately, about 28 catalog events were declared but never
wired, and every feature shipped since September (two-way reviews, trip hub, import,
custom pages, announcements, analytics module, AI assistant, marketing studio, parking
e2e, contracts, listing authorization, help center, push) has thin or no analytics.

## Documents in this plan

| Doc                                                                                | What it covers                                                                                 |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`01-current-state-audit.md`](./01-current-state-audit.md)                         | Inventory of every PostHog / Sentry touchpoint today, with file paths, gaps and bugs found     |
| [`02-posthog-error-removal.md`](./02-posthog-error-removal.md)                     | Phase P1: strip all error capture out of PostHog (browser, edge, build, env, docs, legal copy) |
| [`03-sentry-implementation.md`](./03-sentry-implementation.md)                     | Phases S0–S6: Sentry SDK, edge client, crons, webhooks, source maps, alerts, privacy           |
| [`04-posthog-analytics-coverage.md`](./04-posthog-analytics-coverage.md)           | Phases A0–A6: taxonomy refresh, full per-surface event matrix, server conversions, insights    |
| [`05-operator-setup.md`](./05-operator-setup.md)                                   | Every key, account, setting and dashboard click needed from you, per environment               |
| [`06-testing-verification-guardrails.md`](./06-testing-verification-guardrails.md) | Unit / Deno / Playwright tests, CI guard scripts, manual fire drills, rules and docs to update |
| [`s0-spike-results.md`](./s0-spike-results.md)                                     | S0 measurements: bundle baseline, edge cold start, and what S0.3–S0.5 shipped                  |

## Scope

**In**

- Browser app (`ui/src/**`), service worker (`ui/src/pwa/sw.ts`), all ~335 edge
  functions, `_shared/` services, crons, webhooks, build pipeline, env tooling, CI.
- Removing PostHog exception capture end to end, plus the PostHog error source-map path.
- Sentry: browser SDK, edge client, cron check-ins, uptime, source maps, release health,
  alert routing, privacy scrubbing, test fire drill.
- PostHog: analytics-only config, URL/property sanitization, full event coverage for
  every current feature, server-side conversions, groups, insights/dashboards.
- Super-admin System health registry entries for the new keys.
- Privacy / Cookies copy, route guides, architecture docs, rules, skills.

**Out**

- Host Analytics module (occupancy / ADR / RevPAR, `analytics-summary`). Different
  product; PostHog does not replace it, and it must not be fed from PostHog.
- Org activity / audit log (`activity_log`). Accountability record, not analytics or
  errors. Do not emit `activity_log` from either vendor or vice versa.
- PostHog feature flags for plan / RBAC gates (entitlements stay in `planFeatures`).
- Legacy live app (`main` + `guest-form-management-app` + `zftt…`). Per the dual-track
  rule, instrument **kame-homes / develop / mt-dev** only. Legacy waits for cutover.
- Session replay in Sentry (deferred decision D9 below).
- The full service-cost console (`../super-admin-service-cost-monitoring.md`); this plan
  only amends its `analytics_mode` values (see D8).

**Plans / Team RBAC:** N/A. Platform observability, not a host-facing or paid capability.

**Feature availability:** N/A. Not a host module that super admins toggle.

**activity-log:** N/A for capture paths. The one new mutating surface (super-admin
"Send test error" in S5) is a platform-only diagnostic and writes a `superAdminAudit`
row, not an org `activity_log` row.

## Locked decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Faults go to Sentry, outcomes go to PostHog.** A fault is something an engineer must fix (exception, 5xx, provider outage, cron failure). An outcome is what a user experienced in a journey (`guest_form_rejected`, `parking_payment_failed`, `marketing_publish_failed`). An outcome event may also have a Sentry fault behind it; they are linked by `request_id`, never duplicated.                                                            |
| D2  | **Zero exception capture in PostHog.** `capture_exceptions` off, `captureException` / `$exception` banned in PostHog modules by a CI guard, PostHog project Error tracking disabled.                                                                                                                                                                                                                                                                 |
| D3  | **Browser uses the official `@sentry/react` SDK** (replacing the hand-rolled envelope shim) for global handlers, breadcrumbs, dedupe, React 19 root hooks, React Router 7 integration, release health and source maps. Bundle impact is measured in S0 and must stay inside the existing budgets (`check-initial-bundle-budget.mjs`). If it cannot, fallback is lazy-loading the SDK after first paint with the current shim as the pre-load buffer. |
| D4  | **Edge keeps a lightweight envelope client** (extended `_shared/sentry.ts`), not `@sentry/deno`, because SDK init cost is paid on every isolate cold start. S0 runs a timed spike of `npm:@sentry/deno` against the extended client; we switch only if cold-start overhead is under 20 ms p95.                                                                                                                                                       |
| D5  | **Source maps go to Sentry only** via `@sentry/vite-plugin`, `hidden` maps, deleted after upload, upload failure never fails the build. `@posthog/rollup-plugin` and `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID` are removed.                                                                                                                                                                                                                  |
| D6  | **One release id everywhere** = git SHA (`VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA`), exposed as `VITE_APP_VERSION` in the browser and `APP_RELEASE` on edge. PostHog events carry it as `app_release` so product and error data line up per deploy.                                                                                                                                                                                                     |
| D7  | **Sentry projects:** one org, two projects: `kame-homes-web` (browser + SW) and `kame-homes-edge` (Deno). Environments (`local`, `preview`, `production`) separate data inside each project. `app_track` tag (`mt` / `legacy`) is set now so a future legacy hookup does not mix data.                                                                                                                                                               |
| D8  | **`analytics_mode` becomes analytics-only:** `full` \| `sampled` \| `off`. `errors_only` is removed (Sentry sampling is configured separately). The cost-monitoring plan D8.1 is amended in the same change.                                                                                                                                                                                                                                         |
| D9  | **No Sentry session replay in v1.** PostHog replay stays off (as today) until its masking phase. Revisit Sentry "replay on error" only after a privacy review.                                                                                                                                                                                                                                                                                       |
| D10 | **Privacy parity.** Neither vendor gets names, emails, phones, addresses, message bodies, ID/receipt contents, file URLs, or `access` / `complete` / `token` query values. Sentry gets `user.id` only (no email, `sendDefaultPii: false`, IP not stored). PostHog keeps today's rule: host/super-admin email on the person profile, guests never.                                                                                                    |
| D11 | **Telemetry never breaks UX or blocks a response.** Every capture swallows its own errors. Edge analytics move off the response path via `_shared/backgroundTask.ts`; edge Sentry capture keeps its 3 s bound.                                                                                                                                                                                                                                       |
| D12 | **Choke points first.** Errors are captured at shared wrappers (`handleEdgeError`, `serveCronPost`, `adminEdgeFetch`, `callEdgeFunction`, TanStack `QueryCache` / `MutationCache`, error boundaries). Per-call-site capture is only for swallowed failures that never reach a choke point.                                                                                                                                                           |

## Phase map

Order matters: Sentry must be receiving errors **before** PostHog stops, so there is never
a window with no error capture.

| Order | Phase                                          | Doc | Depends on          | Ships                                                                                                                    |
| ----- | ---------------------------------------------- | --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1     | **O0 Operator setup** (accounts, DSNs, tokens) | 05  | none                | Sentry org + 2 projects, DSNs, auth token, nonprod PostHog verified                                                      |
| 2     | **S0 Spikes and shared foundation**            | 03  | O0                  | Bundle + cold-start measurements, shared scrub list, release id plumbing                                                 |
| 3     | **S1 Browser Sentry**                          | 03  | S0                  | SDK init, global handlers, React hooks, router, query cache, fetch wrappers, filters                                     |
| 4     | **S2 Edge Sentry**                             | 03  | S0                  | Extended envelope client, every serve path, raw `serve()` functions, swallowed side effects, providers                   |
| 5     | **S3 Crons, webhooks, uptime**                 | 03  | S2                  | Cron check-in for `sd-refund-cron` only (free tier: 1 monitor); webhook fault capture; **uptime monitors done (mt-dev)** |
| 6     | **S4 Source maps + release health**            | 03  | S1                  | `@sentry/vite-plugin`, release = SHA, deploy markers                                                                     |
| 7     | **P1 Remove PostHog error capture**            | 02  | S1 + S2 live on dev | All PostHog exception paths gone, PostHog source maps gone, CI guard added                                               |
| 8     | **S5 Alerts, runbooks, test fire drill**       | 03  | S1–S4               | Alert rules, routing, owners, super-admin "Send test error", runbook                                                     |
| 9     | **A0 PostHog analytics hardening**             | 04  | P1                  | `before_send` URL scrub, catalog parity, release prop, background flush, analytics-only init                             |
| 10    | **A1–A5 Analytics coverage**                   | 04  | A0                  | Every feature surface instrumented per matrix (guest, host, parking, billing, AI, super-admin, PWA)                      |
| 11    | **A6 Insights + dashboards**                   | 04  | A1–A5 data          | Funnels, retention, activation, feature adoption dashboards in PostHog                                                   |
| 12    | **S6 / A7 Closeout**                           | 06  | all                 | Docs, rules, legal copy, route guides, prod rollout (prod secrets need `kamewave`), workflow move                        |

**Launch bar (minimum before prod keys):** O0, S0–S5, P1, A0, A1 (guest booking + host
activation), plus the legal copy update from P1. A2–A6 can follow without blocking.

## Operator inputs needed from you

Full checklist with where to click and where to paste: [`05-operator-setup.md`](./05-operator-setup.md).
Short version:

1. Sentry org + two projects (`kame-homes-web`, `kame-homes-edge`), region choice (US or DE).
2. `VITE_SENTRY_DSN` (web DSN), `SENTRY_DSN` (edge DSN).
3. `SENTRY_AUTH_TOKEN` (org token, `project:releases` + `org:read`), `SENTRY_ORG`,
   `SENTRY_PROJECT` for the build.
4. Alert destination(s): email list, and whether you want Telegram (needs a small relay).
5. PostHog: confirm the `kame-homes-prod` / `kame-homes-nonprod` projects exist, then turn
   **off** Error tracking / exception autocapture in both projects.
6. Remove `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID` from Vercel once S4 lands.
7. Production Supabase secrets (`SENTRY_DSN`, `APP_RELEASE`) are a prod edge-secret change:
   say **`kamewave`** when you want that step run.

## Docs to update (same change as the matching phase)

| Doc                                                                                               | Change                                                                                  |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/architecture/integrations.md` §9.5                                                          | Split into §9.5 PostHog (analytics only) and new §9.6 Sentry (errors)                   |
| `docs/architecture/validation-and-env.md`                                                         | Add Sentry vars; remove PostHog personal key / project id; `APP_RELEASE`                |
| `docs/architecture/overview.md`, `docs/PROJECT.md`                                                | Observability paragraph + env inventory                                                 |
| `docs/architecture/edge-functions.md`                                                             | Error-capture contract, cron check-in contract                                          |
| `docs/architecture/third-party-origins.md`                                                        | Sentry ingest origins; CSP notes                                                        |
| New `docs/architecture/observability.md`                                                          | Canonical "fault vs outcome" rule, data flow, ids, scrub list, how to add a new surface |
| `docs/archive/operations/alerting-setup.md`, `incident-response.md`                               | Sentry alert rules, owners, runbook links                                               |
| `docs/guides/routes/legal.md` + `CookiesPage.tsx` / `PrivacyPage.tsx`                             | PostHog = analytics; Sentry = error monitoring processor                                |
| `docs/guides/routes/admin/health.md`                                                              | New registry rows + "Send test error"                                                   |
| `.cursor/rules/supabase-edge-functions.mdc` (checklist item 9)                                    | PostHog = conversions only; Sentry = faults; cron check-in rule                         |
| `.cursor/rules/security.mdc`                                                                      | Telemetry PII rule names both vendors                                                   |
| New `.cursor/rules/observability.mdc` + skill `observability`                                     | Always-on gate: new feature must decide its analytics events and error capture (or N/A) |
| `docs/workflow/in-progress/production-readiness/audits/posthog-analytics-production-readiness.md` | Mark error-tracking sections superseded by this plan                                    |
| `docs/workflow/in-progress/production-readiness/checklist/27-*.md`, `28-*.md`                     | Point alerting and analytics items here                                                 |
| `docs/workflow/planned/super-admin-service-cost-monitoring.md`                                    | Amend D8.1 (`errors_only` removed)                                                      |
| `ui/.env.example`, `supabase/.env.example`, `scripts/dev/env-sync-lib.mjs`, `sync-dev-env.mjs`    | Key lists                                                                               |

## Deployment state (2026-11-02)

**mt-dev (`fwor…`) is deployed and verified.**

| Item           | State                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge functions | All ~300 deployed, `EXIT=0`, plus `super-admin-sentry-test`                                                                                                 |
| Edge secrets   | `SENTRY_DSN` (**was missing**), `SENTRY_SAMPLE_RATE_WARNING=1`, `APP_RELEASE` stamped from git HEAD                                                         |
| Verified live  | `x-request-id` on real responses, `Access-Control-Expose-Headers: x-request-id, retry-after`, `sentry-trace`/`baggage` preflight accepted, `get-health` 200 |
| Vercel Preview | `VITE_SENTRY_DSN`, traces `0.2`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` set (takes effect on the next Preview build)                           |
| Not deployed   | Production. Requires `kamewave`; nothing here touches it.                                                                                                   |

**Still open on dev, in order:** one real event must be seen arriving in Sentry for each
runtime. The fastest way is `/admin/health` → **Send test error** (edge) and the same page in
a browser with the Preview DSN (web). This session could not confirm receipt because the
Sentry MCP tools went away mid-session and there is no super-admin JWT here.

## Exit gate

- [ ] A thrown error in each surface (render crash, unhandled rejection, failed query,
      failed mutation, edge 500, cron failure, webhook failure, SW error) appears in Sentry
      with a readable stack, release, environment, user id and request id, and **not** in
      PostHog.
- [ ] `rg -n "captureException|\\$exception|capturePostHogException|captureAppException"` over
      `ui/src` and `supabase/functions` returns only Sentry modules (CI guard green).
- [ ] Every scheduled job has a Sentry cron monitor; a deliberately skipped run alerts.
- [ ] Alerts route to a named owner with a runbook; the super-admin test error fires an
      alert end to end in nonprod and prod.
- [ ] Every row of the coverage matrix in doc 04 is either wired or marked N/A with a
      reason; UI and edge catalogs are in parity (test green).
- [ ] PostHog `$current_url` / `$referrer` never contain token query values (unit test +
      manual check in Live events).
- [ ] Insights 1–8 from doc 04 exist in the prod PostHog project.
- [ ] Privacy / Cookies copy updated and shipped before prod keys.

## Open questions

None block S0–S2. **Both resolved 2026-11-01** — see decisions D13/D14 below.

1. ~~Alert channel: email only, or email + Telegram relay (doc 05 §4)?~~ **Email only.**
2. ~~Sentry plan tier: Developer (free, 5k errors/month, 1 user) or Team (paid)?~~ **Developer (free).**

## Plan-tier decisions (D13/D14) and what they change

| #   | Decision                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D13 | **Sentry = Developer (free) tier** until there are paying users. 1 user, 5k errors/month, 30-day retention, **1 cron monitor**, limited alert rules. Revisit at first paid customer.                                        |
| D14 | **Alerts = email only.** Paged address `sprmke.dev@gmail.com` (the org member's account email). No Telegram relay, no paid integration. Telegram is a later option only if it stays free (Sentry webhook → edge → Bot API). |

Consequences, applied in the phase docs:

- **S3.1 crons:** the ~24 Sentry cron monitors are not possible. The one free monitor goes to
  `sd-refund-cron` (money path). Every other scheduled job keeps its existing in-app coverage
  in `_shared/systemHealth/jobsRegistry.ts` + `/admin/health`, which already exists and costs
  nothing. No new work, just no Sentry monitors.
- **S5 alerts:** the free tier's default "high priority issues" rule is what pages. Narrowing
  per-`fn` rules (money paths → urgent) is deferred until the tier supports it; until then the
  in-app `systemHealth` jobs view is the fallback for "did the cron run".
- **DSN rate limits** are set low enough to survive a normal incident but **cannot** protect the
  5k/month quota from a bad deploy (5000 errors can be burned in under a day). Accepted
  tradeoff of the free tier. Sentry spike protection stays on as the real backstop.
