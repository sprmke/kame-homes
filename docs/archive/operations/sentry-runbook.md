---
title: Sentry runbook
status: active
tags: [operations, sentry, observability, incident-response]
updated: 2026-11-02
---

# Sentry runbook

How to triage, route and close an error in this product. Companion to
[`docs/architecture/observability.md`](../architecture/observability.md) and the plan at
`docs/workflow/planned/observability-sentry-posthog-split/`.

**The one rule:** Sentry owns faults, PostHog owns outcomes. If you are looking at an
exception, you are in the right place. If you are looking at a user journey, you want PostHog.

## 0. Before anything else: is the quota exhausted?

Free Developer tier: 5,000 errors / month, 30-day retention. A burned quota looks exactly
like "Sentry is broken": events stop arriving, nothing alerts, and the last event is hours
old.

Check **Stats → Usage** first. If the quota is gone, the calm answer is usually "one bad
deploy looped", not "Sentry failed". Grep the recent events for the loudest fingerprint and
fix that; visibility returns next cycle.

## 1. Triage an issue

1. Open the issue and read the **release** tag. It is the git SHA, the same string PostHog
   carries as `app_release`. If it is missing, the deploy did not set `APP_RELEASE` /
   `VITE_APP_VERSION` — fix that before spending time on the symptom.
2. Read the **environment** tag: `production`, `preview` or `local`. A `local` event means
   someone ran the app with a DSN set; it is not an incident.
3. Read `surface` (`guest_booking`, `host_dashboard`, `guest_account`, `super_admin`,
   `parking_dashboard`, `marketing`, `edge`) and `fn` for edge events.
4. Note `request_id`. It is the same id the browser generated and the edge echoed back, and
   it appears in the structured edge log line. One id, one story.
5. `user.id` is a Supabase uuid. **Never** join it to an email to "identify" the person in a
   ticket; use Organizations/Hosts search instead, which is audited.

## 2. Find the code

| Kind of issue        | Where to look                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Render crash         | `AppErrorBoundary` / `RouteErrorFallback`; the crash screen shows `Ref: <event id>`               |
| Failed read or write | `lib/sentry/reportQueryError.ts` fingerprints it as `[query\|mutation, key, status]`              |
| Failed edge call     | `reportEdgeFailure` → fingerprint `[edge, fn, statusBucket]`; `fn` is the function name           |
| Edge 5xx             | `handleEdgeError` in `_shared/httpResponse.ts`; check the edge log line for the same `request_id` |
| Cron did not run     | Sentry cron monitor (only `sd-refund-cron`), otherwise `/admin/health` jobs                       |
| Side effect failed   | `captureSideEffectFailure`, tagged `side_effect` + `provider`                                     |
| Service worker       | `runtime: service_worker`, `sw_handler`                                                           |

## 3. Mute vs resolve vs ignore

| Situation                                      | Action                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed and deployed                             | **Resolve**. It reopens automatically on a regression, which is the regression alert.                                                                          |
| Known, accepted, low value                     | **Ignore** with a count or a window. Never ignore indefinitely without a reason in the comment.                                                                |
| Noisy but real (a bad browser, a flaky vendor) | **Ignore until** a count/window escalates, so it still surfaces if it grows.                                                                                   |
| Duplicate of another issue                     | **Merge** into the canonical one; the fingerprint should have done this already, which means the fingerprint is wrong — note it and fix `fingerprint` in code. |

An issue that pages twice for the same root cause means the fingerprint is too narrow. Fix
the fingerprint, do not silence the alert.

## 4. Alerts

| Trigger                 | Channel                                             |
| ----------------------- | --------------------------------------------------- |
| New high-priority issue | Email to the org member (`sprmke.dev@gmail.com`)    |
| Anything else           | Not configured yet — free tier allows limited rules |

Alert rules live in Sentry → Alerts. If an alert did not fire when it should have, check the
rule's **environment filter** first; a rule scoped to `production` will never fire for a
`preview` event.

## 5. Fire drill

Run after any change to capture, releases or alerts. On `/admin/health` → **Send test error**.

| Check                  | Expected                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Button returns success | Toast `Test error sent`                                                                             |
| Sentry                 | New event, fingerprint `sentry_test`, `fn = super-admin-sentry-test`, correct release + environment |
| Audit                  | A `system.sentry_test_sent` row in the super-admin audit trail                                      |
| PostHog                | **Nothing.** No `$exception`, no event                                                              |
| Email                  | An alert arrives if the rule is set to notify on new issues                                         |

If the event does not appear: the DSN is unset or wrong for that environment, or the deploy
did not carry `APP_RELEASE`. Check `SENTRY_DSN` in the environment's secrets first — an
unset DSN fails silent on purpose.

## 6. Rollback by release

Every event carries the release id, so "what changed" is answerable: compare the first-seen
time to the deploy, then look at that SHA. Rollback uses the normal function/migration
rollback path documented in `docs/archive/operations/production-deployment.md`; Sentry
itself needs no rollback.

## 7. Privacy guardrails

- Never paste guest names, emails, phone numbers, message bodies or document links into
  Sentry, an issue comment, or a ticket.
- If an event contains PII, say so immediately: it means the scrub list missed a key. Add it
  to `ui/src/lib/telemetry/scrub.ts` and `_shared/telemetryScrub.ts` in the same change, then
  delete the offending event.
- Sentry does not store IP addresses. Do not re-add one via `extra`.
