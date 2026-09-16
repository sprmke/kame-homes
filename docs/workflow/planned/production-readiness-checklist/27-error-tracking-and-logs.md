---
title: 'Error tracking and logs'
status: active
tags: [workflow, planned, production-readiness, observability, logging]
updated: 2026-09-16
stage: planned
kind: plan
---

# 27 — Error tracking & logs

## Goal

Every error is captured, attributed to a user/org/release, alertable, and debuggable without reproducing it. No PII in logs.

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

- [ ] Structured log helper adopted across all 300 functions; log schema documented.
- [ ] PII-in-logs audit complete with zero findings remaining.
- [ ] Correlation IDs threaded client → edge → logs → PostHog, surfaced in user-facing errors.
- [ ] PostHog prod/nonprod projects created; secrets set; source maps uploading on deploy.
- [ ] All alerts configured with a delivery channel, a named owner, and a runbook each.
- [ ] Critical-path failure detection live for booking submit, payments, email, workflow side effects, and crons.
- [ ] Log retention/access documented and reflected in the privacy policy.
- [ ] Super-admin health surface live.
- [ ] A deliberately triggered error produces an alert end to end (test the alarm).

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/integrations.md` §9.5, `docs/PROJECT.md`, `docs/architecture/edge-functions.md` (logging contract), operations runbooks.
- **Plans / Team RBAC:** N/A.
- **activity-log:** distinct from logs — `activity_log` is the user-facing accountability record, logs are operational. Do not conflate (the PostHog plan already states this).
