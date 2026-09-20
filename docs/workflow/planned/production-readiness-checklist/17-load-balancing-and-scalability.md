---
title: 'Load balancing and scalability'
status: active
tags: [workflow, planned, production-readiness, scalability, load-testing]
updated: 2026-09-17
stage: planned
kind: plan
---

# 17 — Load balancing and scalability

## Goal

Know the app's actual capacity ceiling, know which component hits it first, and have a documented action for each. Prove it with a load test rather than assuming the platform scales.

## Remaining work to finalize

**Status: partial — write-path hardening, runbook, and k6 harness shipped (2026-09-18).** Capacity targets and a measured run remain blocked on hosted-dev + product input.

| #   | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Blocker                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Write agreed capacity targets (17.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Product / ops                   |
| 2   | ~~Commit a load-test harness~~ **Done** (`scripts/performance/load-test/`). **Still open:** run the mixed scenario on hosted-dev with the large-tenant seed; mock third parties (17.2).                                                                                                                                                                                                                                                                                                                                             | Hosted-dev + doc 10 seed        |
| 3   | Name the first component that fails and the concurrency number (17.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Depends on 2                    |
| 4   | Re-run after 10 / 12 / 14 fixes and record the new ceiling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Depends on those docs           |
| 5   | ~~Booking-transition side effects async + idempotent + circuit-broken (17.4).~~ **Partial** — the 3 unguarded `createNotification` calls in `workflowOrchestrator.ts` (the only side effects without try/catch) now wrapped non-fatal, matching the pattern already used for every email/token side effect in the same file. Async job queue for PDF/email (the slow synchronous legs) and a Resend/Meta circuit breaker are real gaps, precisely located, but are an architecture change needing product sign-off — not attempted. | Code (queue is a bigger change) |
| 6   | Per-module degradation when a third party fails, proven by a test (17.5).                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Code + tests                    |
| 7   | ~~Scaling runbook: trigger, action, owner, time-to-effect (17.6).~~ **Done** — see Phase 17.6 below.                                                                                                                                                                                                                                                                                                                                                                                                                                | —                               |

## Measured before / after

| Metric                                         | Before                            | After                                                           | Difference                                                          |
| ---------------------------------------------- | --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Load-test harness                              | None                              | `scripts/performance/load-test/` (k6, public GET, 1 VU default) | Can run against hosted-dev without writing or hitting third parties |
| Unguarded `createNotification` in orchestrator | 3 calls could fail the transition | Wrapped non-fatal                                               | Matches email/token pattern                                         |
| Scaling runbook                                | None                              | Trigger / action / owner / time-to-effect                       | 2am action is written down                                          |
| Measured first-fail component                  | Unknown                           | Still unknown                                                   | Needs hosted-dev + seed                                             |

## Current state — what "load balancer" means on this stack

The checklist item comes from a self-hosted mental model. On this stack:

| Layer               | Balancing                            | Who owns it          |
| ------------------- | ------------------------------------ | -------------------- |
| Static assets / SPA | Vercel edge network, automatic       | Platform             |
| Edge functions      | Deno Deploy, auto-scaled per request | Platform             |
| Postgres            | **Single primary. No balancing.**    | **The real ceiling** |
| PostgREST           | Fixed pool in front of the primary   | Platform config      |
| Realtime            | Separate service with its own limits | Platform             |
| Storage             | CDN-fronted                          | Platform             |

**There is no load balancer to add.** The work is capacity knowledge and removing the bottlenecks that auto-scaling cannot fix — which all converge on the single Postgres primary and on third-party rate limits.

## Phases

### Phase 17.1 — Define the target

Capacity planning without a target is theater. Write down concrete numbers, even if they are estimates:

| Dimension                        | Launch target | 12-month target |
| -------------------------------- | ------------- | --------------- |
| Organizations                    |               |                 |
| Properties + parkings            |               |                 |
| Bookings/month                   |               |                 |
| Concurrent host sessions (peak)  |               |                 |
| Concurrent guest sessions (peak) |               |                 |
| Inbox messages/day               |               |                 |
| AI requests/day                  |               |                 |

Fill these with the product owner. Every later number in this doc is judged against them.

### Phase 17.2 — Load test

Build `scripts/performance/load-test/` (k6 or Artillery) with realistic mixed scenarios, not a single endpoint hammer:

| Scenario                                                             | Weight | Why                                                  |
| -------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| Guest browses listings → opens a property → submits the booking form | high   | Primary public path, includes a write                |
| Guest checks booking status (polled)                                 | high   | Polling multiplies load                              |
| Host loads the bookings dashboard and transitions a booking          | medium | Heaviest read + the write with the most side effects |
| Host loads finance + analytics                                       | medium | Most expensive queries                               |
| Inbox message send + realtime fan-out                                | medium | Realtime capacity                                    |
| Public search with filters                                           | medium | Facet cost                                           |
| AI assistant request                                                 | low    | Expensive, quota-limited                             |
| Cron tick during peak                                                | —      | Crons must not compete with peak traffic             |

Run against **hosted dev with production-like data volume** (doc 10's large-tenant seed). Never against production.

Ramp until something breaks. Record: which component failed first, at what concurrency, and how it failed (latency cliff, connection exhaustion, 5xx, timeout, quota).

### Phase 17.3 — Fix what breaks first

Expected order of failure on this architecture, to verify rather than assume:

1. **Postgres CPU / connection saturation** from the unbounded queries (doc 10) — likely first.
2. **Third-party rate limits** — Resend, Meta Graph, Gemini/Groq, PayMongo, Google Maps. These fail at _their_ limit regardless of our scale, and several are already inventoried in [`super-admin-service-cost-monitoring.md`](../super-admin-service-cost-monitoring.md).
3. **Edge function cold starts** under bursty traffic — a latency problem, not a failure.
4. **Realtime connection limits** with many open dashboards.
5. **Storage egress** on media-heavy public pages.

### Phase 17.4 — Make the write path resilient

The booking transition is the app's most side-effect-heavy operation (emails, PDFs, calendar, sheets, notifications, activity log). Under load, synchronous side effects turn one slow third party into a user-visible failure.

- Move slow, non-critical side effects (PDF generation, email send, Telegram, sheet sync) to a queue/async job, keeping the state transition itself fast and atomic. The PDF generation running inline is already filed in the perf sibling plan.
- Every side effect needs idempotency (`_shared/idempotency.ts` exists — verify it covers these paths) so a retry does not double-send an email or double-charge.
- Add circuit breakers: when Resend or Meta is failing, stop calling it, queue, and degrade visibly rather than timing out every request.

**Edge case:** making side effects async changes user-visible timing — a host who transitions a booking and expects the guest email "sent" state immediately now sees pending. That is a UX change requiring route-guide updates and copy.

### Phase 17.5 — Graceful degradation under load

Define, per module, what happens when the system is saturated:

| Load condition     | Behavior                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| DB saturated       | Serve cached/stale analytics (doc 12), queue writes, show a clear banner                                                   |
| Third-party down   | Circuit-break, queue, degrade the feature, keep the rest working                                                           |
| AI quota exhausted | Already handled via `jsonUpgradeHook` / quota paths — verify under load                                                    |
| Maintenance mode   | `platform_settings.maintenanceMode` exists — verify the whole app honors it and that it is not itself cached long (doc 11) |

### Phase 17.6 — Scaling runbook

**Shipped 2026-09-17:**

| Trigger                                                       | Action                                                                                                                                                                                                                                    | Owner                                | Time-to-effect                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| DB CPU > 70% sustained (>15 min)                              | Identify top queries via Supabase dashboard/advisors; kill runaway queries; upgrade compute tier (Supabase project settings → Compute add-on)                                                                                             | Project owner (sprmke.dev@gmail.com) | 5–10 min (tier upgrade near-instant, may briefly drain connections)        |
| Connection pool saturation (PgBouncer at max)                 | Raise pool size in Supabase dashboard (Database → Connection pooling); check for connection leaks in edge functions (missing client reuse, doc 15)                                                                                        | Project owner                        | 2–5 min config change; leak fix is a code deploy (hours)                   |
| Storage egress cost spike (billing alert)                     | Check `super-admin-service-cost-monitoring.md`; verify responsive image delivery (doc 09) and CDN cache headers (doc 16); throttle the largest media-heavy property's public page if abusive                                              | Project owner                        | Immediate for cache-header fix (deploy); hours for image pipeline retrofit |
| Third-party rate limit hit (Resend/Meta/PayMongo/Gemini 429s) | Check `super-admin-service-cost-monitoring.md` for current tier limits; request a quota increase (Resend same-day, Meta Graph days, PayMongo needs account-manager contact); throttle non-critical sends (marketing crons) in the interim | Project owner                        | Minutes (internal throttle) to days (provider quota increase)              |

"Upgrade the tier" is useless at 2am if nobody knows who can authorize it — the owner column above is the interim answer until an on-call rotation exists (doc 27/30).

**Cron off-peak audit (2026-09-17):** most crons are Manila off-peak or low-cost sweeps. Two are not: `query-cache-sweep-cron` (10:17am Manila) and `platform-billing-cron` (2pm Manila) both run during business hours — flagged, not yet rescheduled (needs confirming neither has a same-day dependency on that specific hour). `gmail-listener`, `sd-refund-cron`, `calendar-sync-cron` intentionally run all day (operationally required, not a violation). Overlap guards confirmed only on `calendar-sync-cron` and `query-cache-sweep-cron`; `superhost-assessment-cron`, `contract-expiry-cron`, `property-page-views-prune-cron`, `smart-pricing-cron` have no confirmed overlap guard — pre-existing gap, not newly introduced, tracked here for doc 15/19 follow-up.

### Phase 17.7 — Guard

- Re-run the load test before each major release, comparing to the last run.
- Feed the peak numbers into the monitoring thresholds of doc 27 and the availability targets of doc 30.

## Edge cases

- **Auto-scaling amplifies a database bottleneck.** More edge instances mean more concurrent queries against the same primary. Scaling the stateless layer makes the stateful layer fail _faster_. This is the central scalability fact of this architecture.
- **Crons during peak** — a heavy cron (contract expiry scanning all orgs, media sweeps, analytics rollups) competing with peak traffic is a self-inflicted incident. Schedule for Manila off-peak and bound the runtime (doc 15).
- **Thundering herd on cache expiry** — doc 12's stampede protection is a scalability control, not just a performance one.
- **Retry storms** — client retries plus edge retries plus cron retries multiply load during an incident. Every retry needs backoff with jitter and a cap.
- **Load testing is a legal/contractual matter with third parties.** Never load-test against live Resend/Meta/PayMongo/Gemini endpoints — mock them, or you will trip abuse detection and risk account suspension. This is the most likely way this work causes real damage.
- **Load testing hosted dev shares infrastructure limits** with the prod project in some tiers. Confirm isolation before a heavy run.
- **Multi-tenant noisy neighbor** — one large org can degrade everyone. Per-org rate limits (doc 23) are the mitigation.

## Exit gate

- [ ] Capacity targets agreed and written down. (Blocked — needs product owner.)
- [ ] Load-test harness committed; mixed-scenario run executed against hosted dev with large-tenant seed data, with all third parties mocked. Harness committed; **run** still blocked on hosted-dev + seed.
- [ ] First failing component identified with the concurrency number; documented. (Depends on load test.)
- [ ] Doc 10 / 12 / 14 fixes landed and the test re-run showing a higher ceiling.
- [ ] Booking-transition side effects async + idempotent + circuit-broken. (Partial — notification try/catch gap closed; queue + circuit breaker deferred, precisely located.)
- [ ] Degradation behavior defined per module and verified by a test that simulates a failing third party.
- [x] Scaling runbook with trigger, action, owner, and time-to-effect.
- [ ] Peak numbers feeding doc 27 alert thresholds and doc 30 targets. (Depends on load test.)

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/deployment.md`, `docs/PROJECT.md`, `docs/archive/operations/` runbooks, `scripts/README.md`.
- **Plans / Team RBAC:** N/A — unless per-org capacity becomes plan-tiered, then invoke `plans-and-permissions`.
- **activity-log:** N/A.
