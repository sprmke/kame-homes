---
stage: planned
title: 'Observability split — 03 Sentry implementation (Phases S0–S6)'
status: planned
tags: [workflow, planned, observability, sentry, error-tracking]
updated: 2026-11-01
kind: plan
---

# 03 — Sentry implementation (S0–S6)

Goal: every fault in the app reaches Sentry once, with a readable stack, release,
environment, pseudonymous user, tenant tags and a request id, and the right person gets
alerted. Decisions D1–D12 in [`README.md`](./README.md) apply.

## Shared vocabulary (used by both runtimes)

| Field                                      | Browser                                             | Edge                                                                                                              | Notes                                               |
| ------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `release`                                  | `VITE_APP_VERSION` (git SHA)                        | `APP_RELEASE` secret (git SHA)                                                                                    | D6                                                  |
| `environment`                              | `local` \| `preview` \| `production`                | same, from `SUPABASE_URL` / `APP_ENV`                                                                             | Same resolver rules as `posthogEnvironment()`       |
| tag `app_track`                            | `mt`                                                | `mt`                                                                                                              | D7                                                  |
| tag `surface`                              | from `context.ts#getPostHogSurface`                 | n/a                                                                                                               | `public_marketing`, `guest_booking`, `org_admin`, … |
| tag `fn`                                   | edge path on fetch failures                         | function name                                                                                                     |                                                     |
| tag `request_id`                           | header sent / received                              | `resolveRequestId(req)`                                                                                           | Join key client ↔ edge ↔ logs                       |
| tags `org_id`, `property_id`, `parking_id` | from admin scope sync                               | from `verify*Access` result                                                                                       | UUIDs only, never names                             |
| tag `provider`                             | `turnstile`, `google_maps`, `gemini_live`           | `resend`, `gemini`, `groq`, `meta`, `paymongo`, `google_calendar`, `telegram`, `web_push`, `cloudflare_turnstile` | Lets alerts route per provider                      |
| tag `cron`                                 | n/a                                                 | monitor slug                                                                                                      |                                                     |
| `user.id`                                  | Supabase auth uid                                   | `auth.getUser` uid                                                                                                | No email, no IP (D10)                               |
| `level`                                    | `error` default; `warning` for degraded / fail-open | same                                                                                                              |                                                     |

**Scrub list** (one source per runtime, kept in sync by a parity test, doc 06):
start from `ui/src/lib/posthog/sanitize.ts` / `_shared/posthogSanitize.ts` denylist and add
`authorization`, `cookie`, `apikey`, `x-api-key`, `password`, `otp`, `code`, `signature`,
`access`, `complete`, `token`, `secret`, `iban`, `account_number`, `id_number`, `receipt`,
`file_url`, `signed_url`. Query keys `access`, `complete`, `token`, `code`, `state`,
`signature`, `t` are stripped from every URL (event `request.url`, breadcrumbs, `tags.url`).

---

## S0 — Spikes and shared foundation

- [x] **S0.1 Browser bundle spike.** Add `@sentry/react` on a throwaway branch, init with
      the planned integrations, run `bun run build` and
      `scripts/performance/check-initial-bundle-budget.mjs`. Record gzip delta for the
      initial chunk. Pass: within current budget. Fail: switch S1 to lazy-load (`import()`
      after `requestIdleCallback`) with the existing shim buffering early errors.
      **Done 2026-11-02:** `@sentry/react@11.10.0`, **+55.2 KiB gzip** (entry 156.7 → 211.9,
      initial 533.6 → 588.8, budget 500 / 1200). **Pass → eager init**, no lazy-load
      fallback. Verified in a real browser: uncaught throw → three envelope POSTs, all 200.
      Numbers in [`s0-spike-results.md`](./s0-spike-results.md).
- [ ] **S0.2 Edge cold-start spike.** Deploy two dev-only functions (`sentry-spike-envelope`,
      `sentry-spike-sdk`) with `deploy:supabase:dev`; measure cold-start p95 over 30 cold
      invocations each. Switch to `npm:@sentry/deno` only if the overhead is under 20 ms
      p95 (D4). Delete both functions after.
- [x] **S0.3 Release id plumbing.**
  - `ui/vite.config.ts`: `define` `import.meta.env.VITE_APP_VERSION` from
    `VERCEL_GIT_COMMIT_SHA ?? GITHUB_SHA ?? 'local'` (move the resolver out of the deleted
    PostHog block into `ui/vite-plugins/releaseId.ts` so Sentry plugin + define share it).
  - `scripts/deploy/deploy-supabase-dev.sh` (and the prod script, gated by `kamewave`):
    `supabase secrets set APP_RELEASE=$(git rev-parse HEAD)` before `functions deploy`.
  - `_shared/systemHealth/envRegistry.ts`: add `APP_RELEASE` (optional, info severity).
- [x] **S0.4 Shared scrub modules.** `ui/src/lib/telemetry/scrub.ts` and
      `supabase/functions/_shared/telemetryScrub.ts` export `TELEMETRY_DENY_KEYS`,
      `TELEMETRY_DENY_QUERY_KEYS`, `scrubRecord`, `scrubUrl`. PostHog sanitizers import from
      them so both vendors share one list.
- [x] **S0.5 Env files.** Add `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE`,
      `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` to `ui/.env.example`; `SENTRY_DSN`,
      `SENTRY_SAMPLE_RATE_WARNING`, `APP_RELEASE` to `supabase/.env.example`. Teach
      `scripts/dev/env-sync-lib.mjs` to keep `SENTRY_DSN` in `supabase/.env.local` (edge
      DSN, never copied from the web DSN).

## S1 — Browser Sentry

### S1.1 Init module

- [x] New `ui/src/lib/sentry/init.ts`, imported **first** in `ui/src/main.tsx`.
      **Done 2026-11-02.** Shipping as written, except the router integration, which is still
      S1.3 (using plain `browserTracingIntegration()` for now):
  - `dsn: VITE_SENTRY_DSN` (no DSN = no-op, local default).
  - `release`, `environment`, `initialScope.tags.app_track`.
  - `sendDefaultPii: false`; `maxBreadcrumbs: 50`.
  - Integrations: `browserTracingIntegration` via `reactRouterV7BrowserTracingIntegration`
    (S1.3), `breadcrumbsIntegration({ console: false, dom: true, fetch: true, history: true })`,
    `dedupeIntegration`, `httpContextIntegration`. **No** replay (D9), **no** feedback widget.
  - `tracesSampleRate`: production `0.05`, preview `0.2`, local `0` (env override).
  - `tracePropagationTargets`: `[VITE_SUPABASE_URL + '/functions/v1']` only (never third
    parties, never PostHog).
  - `beforeSend` / `beforeBreadcrumb`: scrub (S0.4), drop events from browser extensions
    (`denyUrls: [/^chrome-extension:/, /^moz-extension:/, /^safari-extension:/]`).
  - `ignoreErrors` (start small, grow from data): `ResizeObserver loop limit exceeded`,
    `ResizeObserver loop completed with undelivered notifications`, `AbortError`,
    `Non-Error promise rejection captured with value: undefined`, `Load failed` **only when**
    the request was aborted by navigation (handled in `beforeSend`, not by string).
- [x] Deleted the hand-rolled shim `ui/src/lib/sentry/client.ts`. `ui/src/lib/sentry/capture.ts`
      is now the only SDK call surface (`captureError`, `captureMessage`,
      `captureRenderError`, `reactRootErrorHandlers`); all no-op without a DSN and never throw.
- [ ] Optional tunnel (decide from S0.1 data on ad-block loss): `tunnel: '/monitoring'` +
      Vercel rewrite to the project envelope URL. If adopted, CSP needs no change.

### S1.2 React 19 root hooks + boundaries

- [x] `createRoot(el, reactRootErrorHandlers())` — returns `{}` when no DSN is set so
      `createRoot` keeps its defaults instead of receiving undefined callbacks.
- [x] `AppErrorBoundary`: uses `captureRenderError` (`captureReactException`), so
      `contexts.react.componentStack` is attached and `dedupeIntegration` drops a repeat the
      root hook already sent. Renders the event id as `Ref: abc123` in the crash UI.
- [x] `RouteErrorFallback`: 404 `isRouteErrorResponse` stays out of Sentry; everything else
      is captured with the same `Ref:` line.

### S1.3 Router

- [ ] Wrap `createBrowserRouter` with `Sentry.wrapCreateBrowserRouterV7` so transactions
      are named by route pattern (`/org/:orgSlug/property/:propertySlug/bookings`), never by
      slug. Verify the lazy-route + `RouteSkeletonBoundary` setup still names correctly.

### S1.4 Global error coverage

- [ ] Global handlers come from the SDK (`globalHandlersIntegration`) once posthog-js
      exception capture is off (P1). Until P1, both run; that is expected for one release.
- [ ] `ui/src/lib/chunkReload.ts`: on a dynamic-import failure that triggers the reload,
      capture a `warning` with fingerprint `['chunk-load-failed']`; after the reload guard
      trips (second failure), capture an `error`. Prevents noise after each deploy while
      still catching real breakage.

### S1.5 TanStack Query

- [ ] `ui/src/App.tsx`: `new QueryClient({ queryCache: new QueryCache({ onError }),
mutationCache: new MutationCache({ onError }) })` with one `reportQueryError(error,
queryKeyOrMutationKey)` helper:
  - Skip: `EdgeError` / HTTP status `< 500` except `0` (network) when online, aborted
    requests, auth-expired (401 handled by auth flow), offline (`navigator.onLine === false`).
  - Report: 5xx, network errors while online, thrown non-HTTP errors (parse, logic).
  - Tags: `query_key_root` (first element only, never ids), `request_id` if the error
    carries one, `http_status`.
  - Fingerprint: `['query', query_key_root, http_status]` so one broken endpoint is one issue.
- [ ] Per-query opt-out via `meta: { sentry: false }` for polling endpoints that are
      allowed to fail.

### S1.6 Edge call wrappers + request ids

- [ ] New `ui/src/lib/api/edgeRequestId.ts`: `newRequestId()` (UUID v4) +
      `withRequestId(headers)`.
- [ ] `adminEdgeFetch` (already sends `x-request-id`), `callEdgeFunction` (`edgeClient.ts`)
      and a new `publicEdgeFetch` helper all: send `x-request-id`, read the server's
      `x-request-id` / body `requestId` on failure, and call `reportEdgeFailure({ path,
status, requestId })` for 5xx / network errors (`fn` tag = function name). Replaces
      the PostHog `edge_request_failed` event.
- [ ] Migrate the 29 guest files and 25 dashboard files that call `fetch(.../functions/v1/...)`
      directly to `publicEdgeFetch` / `callEdgeFunction` (one PR per area; list via
      `rg -l "functions/v1" ui/src --glob '!**/*.test.ts'`). Out of scope: Supabase JS
      `functions.invoke` callers, which get a small wrapper with the same behavior.
- [ ] `_shared/cors.ts`: add `sentry-trace`, `baggage` to `Access-Control-Allow-Headers`
      and `x-request-id` to `Access-Control-Expose-Headers` (if not already).

### S1.7 User + tenant context

- [ ] `ui/src/lib/sentry/SentryIdentitySync.tsx` next to `PostHogIdentitySync` in
      `AppShell`: `Sentry.setUser({ id })` on sign-in, `setUser(null)` on sign-out. Guests on
      the anon booking form have no user.
- [ ] `AdminLayout`: set tags `org_id` / `property_id` / `parking_id` from the same source
      as `PostHogAdminScopeSync`; clear on leave.
- [ ] Every event gets `surface` tag from the current path.

### S1.8 Swallowed failures

- [ ] Audit the 37 `console.error` sites in `ui/src`: each becomes `captureError` (fault),
      a PostHog outcome event (expected user-facing result), or stays as a dev log with a
      reason comment only if truly debug-only. Tracked as a checklist in the PR.
- [ ] Shared toast: do **not** auto-report from `toast.error` (514 sites, most are
      validation). Instead, the query / mutation / fetch choke points above cover the real
      faults.
- [ ] Third parties: Turnstile `error-callback` (`provider: turnstile`, warning), Google
      Maps loader failure (`provider: google_maps`), Gemini Live / WebRTC voice failures
      (`provider: gemini_live`), PDF/image generation in browser, Web Push subscribe failure
      (warning).

### S1.9 Service worker (`ui/src/pwa/sw.ts`)

- [ ] SW cannot import `@/` modules or the SDK. Add `ui/src/pwa/swErrorRelay.ts`: wrap
      `push`, `notificationclick`, `sync`, `fetch` fallback and kill-switch handlers in
      try/catch; on error, `postMessage({ type: 'sw-error', message, stack, handler })` to
      all clients; if no client is open, send a minimal envelope directly to the web DSN
      (DSN injected at build via `define`, with the same scrub rules, release and
      environment).
- [ ] `ui/src/lib/sentry/swBridge.ts` in the page listens for `sw-error` and calls
      `captureError` with tag `runtime: service_worker`.

### S1.10 Performance (lightweight)

- [ ] Web vitals via `browserTracingIntegration` (LCP, INP, CLS) on the sampled
      transactions only. PostHog `capture_performance` is off (P1), so Sentry is the one
      source for performance.

## S2 — Edge Sentry

### S2.1 Extend `_shared/sentry.ts`

- [ ] Add: `release` (`APP_RELEASE`), `server_name` (function), `user.id`, `level`,
      `fingerprint`, `tags` merge, `contexts.request` (method, scrubbed URL, no headers
      except `user-agent`), `contexts.trace` from incoming `sentry-trace` header so browser
      and edge events link.
- [ ] `captureSentryMessage(message, { level, tags, extra })` for degraded states that are
      not exceptions (provider returned 429, fail-open rate limiter).
- [ ] Per-isolate guard: dedupe identical `(fingerprint, message)` within 60 s; cap 30
      events per isolate per minute; sample `warning` level by `SENTRY_SAMPLE_RATE_WARNING`
      (default 0.25). Errors are never sampled.
- [ ] Never throw, 3 s bound kept, `waitUntil` when available (`backgroundTask.ts`) so the
      response is not delayed for non-fatal reports.
- [ ] Unit tests (`_shared/sentry_test.ts`): envelope shape, scrub, dedupe, cap, release,
      missing DSN no-op, network failure swallowed.

### S2.2 Choke points

- [ ] `handleEdgeError`: pass `fn`, `requestId`, `userId`, scope ids (from a new optional
      `EdgeErrorContext` the `serve*` wrappers fill after auth), `http_status`.
      Deliberate 4xx `EdgeError` stays out.
- [ ] `serveAdmin` / `servePublic` / `serveAuthenticated` / `serveSuperAdmin` set the
      context once per request, so all ~300 wrapper functions get it for free.
- [ ] `serveCronPost`: capture with tag `cron`, plus check-in (S3.1).

### S2.3 Raw `serve()` functions

Migrate to a wrapper where the auth model fits; otherwise wrap the body in
`withEdgeErrorCapture(fnName, handler)` (new helper in `serveEdge.ts`).

| Function                                                                                                                                 | Action                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `submit-form`, `submit-form-completion`, `submit-sd-form`, `submit-pay-parking`                                                          | `servePublic` if multipart/body handling allows; else `withEdgeErrorCapture` |
| `sd-refund-cron`, `calendar-sync-cron`, `superhost-assessment-cron`                                                                      | `serveCronPost`                                                              |
| `ical-export`                                                                                                                            | `withEdgeErrorCapture` (GET, text/calendar)                                  |
| `meta-inbox-backfill`, `meta-inbox-oauth-callback`, `meta-inbox-webhook`                                                                 | `withEdgeErrorCapture`; webhook rules in S3.2                                |
| `upload-development-media`, `upload-property-media`, `upload-parking-media`, `upload-*-settings-asset`, `upload-property-template-asset` | Keep raw (multipart), already on `handleEdgeError`; add context              |
| `parking-broadcast-email`                                                                                                                | 410 stub; no change                                                          |

### S2.4 Swallowed side effects

- [ ] `_shared/workflowOrchestrator.ts`: each side effect (email, calendar, sheet, Telegram,
      push, AI review) that catches and continues → `captureSentryException` with tags
      `side_effect`, `booking_status_to`, `provider`; level `error` for email/calendar,
      `warning` for optional ones. Same for `subscriptionOrchestrator.ts` and
      `parkingPaymentOrchestrator.ts`.
- [ ] `_shared/backgroundTask.ts#runAfterResponse`: capture failures with tag
      `background_task: <label>`.
- [ ] Audit the 501 edge `console.error` sites by directory; any that is a real fault and
      is not re-thrown to a choke point gets `captureSentryException` or
      `captureSentryMessage`. Track per-folder in the PR description.

### S2.5 Provider wrappers

Capture at the shared client, not at each caller:

| Module                                                                  | Provider tag           | Report                                                            |
| ----------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| `emailService.ts`, `sendBookingWorkflowEmail.ts`                        | `resend`               | Non-2xx, timeouts; 4xx validation as warning                      |
| `ai/*`, `aiModelRouter.ts`, `aiGeminiKeys.ts`, `geminiLiveEphemeral.ts` | `gemini` / `groq`      | 5xx, timeouts, all-keys-exhausted (error); 429 (warning)          |
| `metaInboxGraphHttp.ts`, `metaPublishing.ts`                            | `meta`                 | Graph errors except known user errors in `metaInboxSendErrors.ts` |
| `paymongoClient.ts`                                                     | `paymongo`             | All non-2xx                                                       |
| `calendarSyncService.ts`, Google Calendar calls                         | `google_calendar`      | Per-feed failures as warning; token refresh failure error         |
| `telegramApi.ts`                                                        | `telegram`             | Non-2xx except "chat not found" (outcome, logged)                 |
| `webPushService.ts`                                                     | `web_push`             | 5xx; 404/410 are expected (subscription gone)                     |
| `captcha.ts`                                                            | `cloudflare_turnstile` | Siteverify network failure (warning)                              |
| `storageSignedUrl.ts`, upload services                                  | `supabase_storage`     | Storage 5xx                                                       |

Fingerprint `['provider', provider, status_bucket]` so an outage is one issue, not
thousands.

## S3 — Crons, webhooks, uptime

### S3.1 Cron monitors

> **Amended by D13 (free tier, 1 cron monitor).** Sentry monitors are cut from ~24 to **one**.
> Every other scheduled job keeps its existing in-app coverage in
> `_shared/systemHealth/jobsRegistry.ts` + `/admin/health` (`SCHEDULED_JOBS`), which already
> tracks last-run/last-status and costs nothing. Do **not** build a second monitoring path for
> jobs the health page already covers.

- [ ] `_shared/sentryCron.ts`: `withCronCheckIn(slug, schedule, fn)` sends `check_in`
      envelopes (`in_progress` → `ok` / `error` with `duration`), using `monitor_config`
      (crontab, `checkin_margin: 5`, `max_runtime` per job, `timezone: 'Asia/Manila'` or
      UTC to match `cron.schedule`) so the monitor upserts without dashboard clicks.
- [ ] `serveCronPost` takes a `cron: { slug, schedule, maxRuntimeMinutes }` option.
      **Free tier: only `sd-refund-cron` passes it.** It is the money path and the only job
      whose silent failure has financial consequences. Adding a second monitor will start
      dropping check-ins until the plan is upgraded.
- [ ] Deno test (`cronMonitorConfig_test.ts`): exactly one cron function declares
      `cron.slug`, and its schedule matches the matching `cron.schedule` migration. Fails if a
      second is added, so the free-tier limit cannot be exceeded by accident.
- [ ] No change needed for the other jobs in the inventory: `activity-log-retention`,
      `analytics-ai-review`, `calendar-sync-cron`, `contract-expiry`,
      `dashboard-assistant-expire-pending-actions`, `expire-parking-broadcasts`,
      `marketing-generation-sweeper`, `marketing-media-sweeper`,
      `meta-inbox-webhook-healthcheck`, `platform-billing`, `property-page-views-prune`,
      `query-cache-sweep`, `review-lifecycle`, `send-parking-reminders`, `smart-pricing`,
      `superhost-assessment-cron`, `telegram-*-cron` (5), `voice-receptionist-reaper`,
      `push-fanout`. They are covered by `SCHEDULED_JOBS`; mark each N/A-for-Sentry in the PR.
      **At plan upgrade:** flip them on by passing `cron` — the wrapper already supports it.
- [ ] Pure-SQL `pg_cron` jobs (no edge function): list them; add them to `SCHEDULED_JOBS`
      rather than Sentry, or mark N/A.
- [ ] A cron that succeeds with partial failures (e.g. 3 of 40 calendars failed) reports
      `ok` plus one `warning` summary event with `metadata.failed_count`.

### S3.2 Webhooks

- [ ] `paymongo-webhook`, `meta-inbox-webhook`, `approval-email-webhook`, Resend inbound /
      events: signature failures → warning with `provider` tag (could be an attack or a
      rotated secret; alert on spikes). Processing errors → error, captured **inside** the
      provider dedupe guard so retries do not create duplicate issues.
- [ ] Return codes unchanged (do not start returning 500 where providers would retry storms).

### S3.3 Uptime

> **Done 2026-11-01 for mt-dev** via the Sentry MCP. Free tier allowed uptime monitors
> (separate from the 1 cron-monitor allowance), so D13 does not block this.

- [x] Sentry Uptime monitors created, both 5-minute interval, both reporting `ok`: - `Edge API liveness (mt-dev get-health)` on project `kame-homes-edge` →
      `https://fworvijbrwpyngycotbz.supabase.co/functions/v1/get-health`
      (15 s timeout: the endpoint cold-starts around 4 s). - `MT-dev app origin` on project `kame-homes-web` → `https://dev.kamehomes.space`
      (15 s timeout).
- [ ] Production URLs at release: add `get-health` on mt-prod and the production origin
      (needs `kamewave` for the secrets half, but the monitor itself is just Sentry config).
- [x] Optional: `get-health?deep=1` super-admin-only probe stays out of uptime (auth) — it
      would report 401 as "down".

## S4 — Source maps + release health

- [ ] `@sentry/vite-plugin` in `ui/vite.config.ts`, enabled only when `SENTRY_AUTH_TOKEN`,
      `SENTRY_ORG`, `SENTRY_PROJECT` are set: `release.name` = S0.3 id, `sourcemaps.assets:
'./dist/**'`, `filesToDeleteAfterUpload: ['./dist/**/*.map']`, `telemetry: false`.
- [ ] `build.sourcemap: 'hidden'` only when the plugin is enabled.
- [ ] Wrap the plugin like today's PostHog resilient wrapper: upload failure logs a
      warning and the build continues.
- [ ] Keep `scripts/performance/assert-no-sourcemaps.mjs` in CI (no public maps).
- [ ] Release health: SDK sessions on (default); deploy marker via plugin
      `release.deploy.env` = environment.
- [ ] Edge: no source maps needed (Deno stacks are readable TS paths); set `release` only.

## S5 — Alerts, runbooks, test fire drill

> **Amended by D13/D14 (free tier, email only).** The free tier does not allow a rule per
> condition. Keep the default **"Send a notification for high priority issues"** rule enabled
> in both projects (verified enabled, owner = all members, fires to the org member's email) and
> do not try to build the matrix below yet. It is recorded here so the work is ready when the
> plan is upgraded.

- [ ] **Confirm delivery:** one real error reaches `sprmke.dev@gmail.com`. Confirmed once
      already (the DSN smoke test fired the rule), but re-check after any membership or email
      change. Free tier = 1 user, so the recipient is the account email, not a per-rule list.
      **Rule config verified 2026-11-01** via MCP: action `email` → `issue_owners`,
      fallthrough `ActiveMembers`, triggers `new_high_priority_issue` +
      `existing_high_priority_issue`, `lastTriggered` set by the smoke test. So delivery is
      wired; the only open question is which address is on the account.
- [ ] **Free-tier now:** leave the default high-priority rule as the only alert. Do not add
      the rules below.
- [ ] **At plan upgrade — alert rules** (both projects, production env): new issue (first
      seen) → notify; regression → notify; issue frequency > 20 events / 5 min → urgent;
      `provider:*` error rate spike → urgent; `cron` monitor missed / failed → urgent; uptime
      down → urgent; `fn:submit-form|submit-sd-form|submit-pay-parking|paymongo-webhook` any
      error → urgent (money / booking paths).
- [ ] **Routing:** email only (D14). Telegram is a **later, optional** add-on and must stay
      free: Sentry internal-integration webhook → small `sentry-alert-relay` edge function
      (verifies the signature, posts to the super-admin Telegram chat via the free Bot API).
      Do not adopt it until the free tier is confirmed to allow internal integrations.
- [ ] **At plan upgrade — ownership rules:** `tags.fn:paymongo-*` → billing owner;
      `provider:meta` → inbox owner; default → platform owner. Single-user org today, so
      routing is a no-op until a second member exists.
- [ ] **Runbook:** new `docs/archive/operations/sentry-runbook.md` (triage, mute vs resolve,
      how to find request id in logs, how to link to booking / org safely, rollback by
      release). Add: on free tier, triage "is the quota exhausted?" first, because a burned
      5k/month quota looks identical to "Sentry is down".
- [ ] **Super-admin "Send test error"** on `/admin/health`: button calls new edge
      `super-admin-sentry-test` (`serveSuperAdmin`) which throws a tagged test error, and
      the page throws a browser test error. Writes a `superAdminAudit` row
      (`system.sentry_test_sent`). Copy: button `Send test error`, toast `Test error sent`.
      Mobile: lives inside the existing health page sections; any confirm uses
      `ResponsiveModal`.
- [ ] **Fire drill** (doc 06 §4) run in nonprod, then prod at release.

## S6 — Privacy, docs, closeout (with A7)

- [ ] Sentry project settings: data scrubber on, default scrub on, IP storage off,
      "prevent storing of IP addresses" on, additional sensitive fields = scrub list.
- [ ] Legal copy shipped (P1.6) before prod DSNs are set.
- [ ] Docs from README "Docs to update" table, new `observability.mdc` rule + skill.
- [ ] Production rollout checklist (doc 05 §6). Production Supabase secrets need `kamewave`.
- [ ] Move this folder to `docs/workflow/done/` by hand (the move script handles single
      files only) and update both READMEs + intake scratchpads.
