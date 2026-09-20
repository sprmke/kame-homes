---
title: 'Error tracking and logs'
status: active
tags: [workflow, planned, production-readiness, observability, logging]
updated: 2026-09-19
stage: planned
kind: plan
---

# 27 — Error tracking & logs

## Goal

Every error is captured, attributed to a user/org/release, alertable, and debuggable without reproducing it. No PII in logs.

## Implementation status (2026-09-19 session)

- **Phase 27.1 — structured log helper shipped and wired centrally, on the failure path only.** `supabase/functions/_shared/requestLog.ts` emits the doc's exact JSON shape (`{ts, level, fn, requestId, orgId?, propertyId?, userId?, event, durationMs?, status?, meta?}`) via `logEvent`. Rather than retrofitting 300 individual functions by hand, wired it into the one choke point every `serve*` wrapper already routes through on error: `handleEdgeError` (`_shared/httpResponse.ts`) now emits a structured `warn`/`error` line on every wrapper-caught failure. **Code-review correction (2026-09-20):** the module's own docstring originally implied this covered every request (entry/exit, not just errors) — a review agent caught the overstatement. Corrected the docstring: there is no happy-path entry/exit log today, so this cannot yet answer request-volume or latency questions for non-erroring calls, only failure-rate/error-shape ones. `debug` level is off by default (`EDGE_LOG_DEBUG=1` to enable), matching the doc's level rules.
- **Phase 27.2 — correlation IDs threaded client → edge → logs → PostHog → user-facing error.** `resolveRequestId()` reads a client-sent `x-request-id` header (validated, falls back to `crypto.randomUUID()` server-side if absent/malformed) and threads it through `handleEdgeError` into: the structured log line, the PostHog exception's `extra.requestId`, and — **only on a 5xx** (a 4xx is usually expected client flow like validation, showing a reference id there would be noise) — the JSON error body as `requestId`, so a future UI can show "Reference: abc123". `jsonError()` gained an optional 4th param, backward compatible with every existing call site. Client side: `ui/src/lib/api/adminEdgeFetch.ts` (the single central admin/dashboard edge-fetch wrapper) now sends `x-request-id: crypto.randomUUID()` on every call and surfaces it on `AdminEdgeFetchError.requestId`. **Scoped to the admin surface this session** — the guest-side fetch call sites were not touched; extending the same header-send pattern there is the natural next slice.
- **Phase 27.5 — PII-in-logs audit run and closed.** Delegated a full audit of all 841 `console.log`/`warn`/`error` call sites across `supabase/functions/**` (300 functions + `_shared/`, excluding test files) against the doc's own rule ("never log guest names/emails/phones/addresses/ID contents/tokens/secrets/full bodies; log identifiers not values"). Found and fixed 3 real findings, all now shipped:
  - **High** — `_shared/databaseService.ts#getFormData` logged the entire reconstructed guest form object (email, phone, address, all 5 guest names, ID document URLs) on every form load/edit. Now logs `bookingId` only.
  - **High** — `submit-form/index.ts`'s overlap-detection path logged the full array of overlapping booking rows, including _other guests'_ `primary_guest_name`, on a routine user-facing error. Now logs the array of booking ids only.
  - **Medium** — `cancel-booking/index.ts` interpolated `booking.primary_guest_name` into a log line alongside the (sufficient) `bookingId`. Removed.
  - Everything else audited clean: no raw token/secret values logged anywhere (only booleans/config-missing warnings), no `console.log(body)`/full-request-body dumps, webhook handlers (Resend/PayMongo/Meta) only log `Error` objects/messages never raw payloads, admin-email logging in import functions is the _admin's own_ email for audit purposes (acceptable, not guest PII).
- **Phase 27.4/27.6 (partial) — `/health` endpoint shipped.** New `get-health` function (public, rate-limited 60/min): does a cheap `head: true`/`count: 'exact'` round-trip against the `platform_settings` singleton table to prove real DB connectivity (not just a cached-settings read, which `get-public-platform-status` already does and would miss an actual DB outage), returns `{status, version, db}` — no table names, row counts, or migration state leaked to an unauthenticated caller. Registered in `supabase/config.toml` (`verify_jwt = false`). All CI guards pass clean against it (`check-serve-public-rate-limit.sh`, `audit-edge-functions.mjs`, `audit-auth-matrix.mjs`, `check-select-star.sh`, `check-cache-class.sh`, `check-unbounded-select.sh`) — no allowlist entries needed. **Not verified against a live local request this session** — `supabase status` failed mid-session (`ERROR: supabase status failed. Run supabase start first.` despite Docker containers showing up earlier), so `bun run dev:api` couldn't boot the local functions gateway to `curl` it directly; verified instead via `deno check` + the static CI guards, which is lower confidence than an actual round-trip. **This is not the super-admin health _surface_** (27.6, a dashboard panel with cron status/integration health/queue depths) — that's a UI feature, out of scope this session; `get-health` is the narrower external-uptime-monitor probe from 30.4, done here because it shares this doc's "cheap unauthenticated liveness" concern.
- `deno check` clean on every touched file (2 pre-existing, unrelated type errors confirmed via `git stash` — `telegramStaff.ts`'s `'skipped'` mode literal and `submit-form/index.ts:548`'s `error` typed `unknown`, neither on a line this session touched). `bun run test:edge` 311/311 (4 new tests for `resolveRequestId`), `bun run test:edge:handlers` 20/20.

**Not attempted this session (need operator/hosted access or are large product surfaces):** PostHog project creation/secrets (Phase 27.3, operator-blocked — same blocker as doc 28), the 10-alert table with named owners and a tested end-to-end alarm fire, full critical-path detection wiring (booking submit/payment/email/workflow-transition/PDF/calendar/cron failure detection as distinct alerted paths — 27.4's broader scope beyond the health endpoint), log retention/access policy + privacy-copy reflection (27.5's other half), and the super-admin health _surface_ itself (27.6, a UI feature).

## Remaining work to finalize

**Status: partial.** PostHog exceptions / source maps have prior art (not redone). This session shipped the structured-log helper + correlation IDs (wired centrally, not per-function), closed the PII-in-logs audit (3 fixes), and added a `/health` liveness endpoint. Remaining work is operator-blocked alerting/PostHog setup, the broader critical-path detection buildout, log retention policy, and the super-admin health surface.

| #   | Work                                                                                                                                                   | Blocker           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 1   | ~~Structured log helper across all 300 functions; document the schema (27.1).~~ **Done** — wired centrally via `handleEdgeError`, not per-function.    | —                 |
| 2   | ~~PII-in-logs audit to zero findings.~~ **Done** — 3 findings, all fixed.                                                                              | —                 |
| 3   | ~~Correlation IDs client → edge → logs → PostHog, surfaced in user-facing errors (27.2).~~ **Done on the admin surface.** Guest-side fetch still open. | Code (guest side) |
| 4   | PostHog prod/nonprod projects created; secrets set; source maps uploading on deploy (27.3). Cross-check doc 28.                                        | Operator setup    |
| 5   | Every alert has a channel, a named owner, and a runbook.                                                                                               | Ops               |
| 6   | Critical-path detection: booking submit, payments, email, workflow side effects, crons (27.4). ~~`/health` endpoint~~ **done** (30.4 overlap).         | Code + hosted     |
| 7   | Log retention/access documented and reflected in the privacy policy (27.5).                                                                            | Docs + legal      |
| 8   | Super-admin health surface live (27.6). Deliberately trigger an error and prove the alert fires.                                                       | Hosted + display  |

## Prior art — do not redo

[`posthog-analytics-production-readiness.md`](../../for-testing/posthog-analytics-production-readiness.md) shipped the application code:

| Shipped                         | Detail                                                         |
| ------------------------------- | -------------------------------------------------------------- |
| Client exception capture        | React error boundary + window exception handlers               |
| Edge exception capture          | `_shared/posthog.ts#capturePostHogException`, 3s flush timeout |
| URL sanitizer                   | `_shared/posthogSanitize.ts` (+ test)                          |
| Source maps + release = git SHA | Symbolication path ready                                       |
| Identify + groups               | User, org, property attribution                                |
| E2E no-op without keys          | Tests do not pollute analytics                                 |

**Operator-blocked:** create the `kame-homes-prod` / `kame-homes-nonprod` PostHog projects, set Vercel + Supabase secrets, configure alerts. Sentry remains deferred (`docs/architecture/integrations.md` §9.5).

## Current state gaps

1. **Alerting is not configured** — errors are captured but nobody is told.
2. **Structured logging is inconsistent** across 300 edge functions; `serveEdge` takes a `logPrefix` but there is no defined log schema.
3. **No correlation ID** threading a single user action through client → edge → DB → third party.
4. **PII-in-logs has not been audited** (the URL sanitizer covers URLs, not log bodies).
5. **No log retention/access policy.**

## Phases

### Phase 27.1 — Structured logging standard

Define one JSON log shape emitted by every edge function via a shared helper:

```
{ ts, level, fn, requestId, orgId?, propertyId?, userId?, event, durationMs?, status?, meta? }
```

Rules:

- **Never** log: guest names, emails, phone numbers, addresses, ID/document contents, tokens, secrets, full request bodies.
- Log identifiers, not values. `bookingId`, not the booking.
- Levels used consistently: `error` (needs a human), `warn` (degraded, self-healing), `info` (state change), `debug` (off in prod).

Retrofit across all 300 functions as part of doc 18's conformance sweep rather than as a separate pass.

### Phase 27.2 — Correlation IDs

Generate a request ID at the client, send it as a header, thread it through the edge function, include it in logs and PostHog events, and surface it in user-facing error messages ("Reference: abc123"). This turns "it broke yesterday" into a single query, and is the highest-leverage debuggability change available.

### Phase 27.3 — Alerting

Configure, with a named owner and a real delivery channel (Telegram is already integrated and is the natural fit here):

| Alert                   | Condition                                       |
| ----------------------- | ----------------------------------------------- |
| Exception spike         | Rate above baseline over a short window         |
| New error type          | First occurrence of an unseen exception in prod |
| 5xx rate                | Above threshold per endpoint                    |
| Payment failures        | Any failed capture or webhook processing error  |
| Email delivery failures | Bounce/complaint spike via Resend webhooks      |
| Auth failure spike      | Possible attack or a broken auth deploy         |
| Cron failure            | A scheduled job did not run or errored          |
| Rate-limit spike        | Doc 23                                          |
| Cost threshold          | Doc 25                                          |
| Availability            | Doc 30                                          |

**Every alert needs a documented response.** An alert with no runbook gets muted within a week.

### Phase 27.4 — Critical-path error handling

For the paths where a silent failure is worst, add explicit failure detection rather than relying on generic capture:

- Booking submission — a guest who thinks they booked and did not.
- Payment webhook processing — money received, booking not updated.
- Email send failures — a guest never receiving check-in instructions.
- Workflow transitions with partial side-effect completion.
- Document/PDF generation failures.
- Calendar sync failures (silent drift causes double bookings).
- Cron jobs that silently stop running.

Each needs: detection, an alert, and an operator-visible surface (a super-admin health panel is the natural home).

### Phase 27.5 — Log access, retention, privacy

- Supabase edge logs and Postgres logs: who can read them, for how long.
- PostHog retention and who has access.
- A PII-in-logs audit: grep every `console.log`/`console.error` in edge functions for logged bodies or user fields.
- Document log access in the privacy policy if logs contain any personal data (IP addresses usually count).

### Phase 27.6 — Health surface

Extend the existing super-admin console with an operational health view: recent error rates per module, cron last-run and status, third-party integration health (Meta healthcheck already exists via `metaInboxHealthcheckCron.ts`), queue depths. This is the operator's first stop during an incident.

## Edge cases

- **PostHog blocked by an ad blocker** means client-side errors from those users are never reported — a systematically invisible segment. The `/ingest` rewrite mitigates most of this; verify it.
- **Error capture failing during an outage** — if the network is down, the exception cannot be sent. Buffer and retry on reconnect where practical.
- **Alert fatigue** is the main failure mode. Start with few, high-signal alerts; add only after a real incident shows a gap.
- **Sampling** — high-volume errors can exhaust quota. Sample repeats, keep the first of each type.
- **The 3-second flush timeout** in edge functions can drop an exception if the function returns first. Verify the flush is awaited on error paths.
- **Sensitive data in stack traces** — a stack can include argument values. Scrub before sending.
- **Errors during deploy** spike naturally as clients transition; alert thresholds need to tolerate deploy windows or they page every release.
- **Console logging is not free** at high volume and can slow edge functions; use levels rather than deleting logs.

## Exit gate

- [x] Structured log helper adopted across all 300 functions (via the central `handleEdgeError` choke point); log schema documented in `requestLog.ts`.
- [x] PII-in-logs audit complete with zero findings remaining (3 found and fixed this session).
- [x] Correlation IDs threaded client → edge → logs → PostHog, surfaced in user-facing errors — **admin surface only**; guest-side fetch call sites not yet wired.
- [ ] PostHog prod/nonprod projects created; secrets set; source maps uploading on deploy.
- [ ] All alerts configured with a delivery channel, a named owner, and a runbook each.
- [ ] Critical-path failure detection live for booking submit, payments, email, workflow side effects, and crons. `/health` liveness probe shipped (overlaps 30.4); the broader per-path detection is not.
- [ ] Log retention/access documented and reflected in the privacy policy.
- [ ] Super-admin health surface live.
- [ ] A deliberately triggered error produces an alert end to end (test the alarm).

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/integrations.md` §9.5, `docs/PROJECT.md`, `docs/architecture/edge-functions.md` (logging contract), operations runbooks.
- **Plans / Team RBAC:** N/A.
- **activity-log:** distinct from logs — `activity_log` is the user-facing accountability record, logs are operational. Do not conflate (the PostHog plan already states this).
