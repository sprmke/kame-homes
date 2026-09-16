---
title: 'Analytics'
status: active
tags: [workflow, planned, production-readiness, analytics, posthog]
updated: 2026-09-16
stage: planned
kind: plan
---

# 28 — Analytics

## Goal

Every product decision is answerable from data, every funnel is instrumented, and analytics costs and privacy obligations are controlled.

## Prior art — this is largely SHIPPED

[`posthog-analytics-production-readiness.md`](../../for-testing/posthog-analytics-production-readiness.md) states: **"Application code: complete."**

| Shipped                                 | Detail                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Typed event catalog                     | `_shared/posthogCatalog.ts`, `captureAppEvent` / `capturePostHogEvent` |
| Guest funnel                            | Booking flow instrumented                                              |
| Host activation                         | Onboarding/activation events                                           |
| Workflow server events                  | Transitions captured server-side                                       |
| Plan checkout, discovery, upgrade modal | Instrumented                                                           |
| PWA / media sinks                       | Instrumented                                                           |
| Identity + groups                       | Identify, org/property/parking groups                                  |
| Privacy                                 | `person_profiles: identified_only`, URL sanitizer, legal copy          |
| Infrastructure                          | `/ingest` rewrite, release = git SHA, E2E no-op without keys           |

Also distinct and separate: the [Host Analytics module](../../for-testing/host-analytics-module.md) is a _product feature_ (occupancy/ADR/RevPAR for hosts), not platform analytics. **Do not conflate the two.**

## Remaining work

Per that plan's own deferral list:

1. **Operator setup** — create `kame-homes-prod` + `kame-homes-nonprod` PostHog projects, set Vercel + Supabase secrets, configure alerts, build the funnels.
2. **Deferred event coverage** — inbox reply, Meta connect, finance, pricing, calendar sync, settings, public page, notification, super-admin custom events (to be added incrementally as those surfaces change).
3. **Masked session replay sampling** (that plan's Phase 5).
4. **`analytics_mode` refresh** from `get-public-app-config` when that endpoint ships.
5. **Parking payment webhook events**.

## Phases

### Phase 28.1 — Operator setup (blocking)

Nothing else in this doc matters until keys exist:

- Create both PostHog projects; keep prod and nonprod strictly separate so test traffic never pollutes product data.
- Set `VITE_*` keys in Vercel per environment and the server key in Supabase secrets.
- Verify source maps upload on deploy and that a deliberately thrown error symbolicates to a real line.

### Phase 28.2 — Define the questions first

Instrumentation without questions produces dashboards nobody opens. Write the questions, then check the events answer them:

| Question                                              | Needs                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Where do guests abandon the booking form?             | Step-level funnel with drop-off reasons                                |
| Which acquisition source converts best?               | Origin bucketing (`guestOriginBucketing.ts` exists) through to booking |
| How long from host signup to first published listing? | Activation funnel with timestamps                                      |
| Which dashboard modules are actually used?            | Module-level page/action events                                        |
| Where do hosts hit plan gates?                        | Upgrade-hook events by feature                                         |
| What causes failed bookings?                          | Error events joined to the funnel                                      |
| Which AI features earn their cost?                    | Usage joined to the cost model                                         |
| What does a host do before churning?                  | Retention + last-session behavior                                      |

### Phase 28.3 — Close the deferred event gaps

Add events for the deferred surfaces, prioritized by decision value: plan gates and finance first (revenue), then inbox and pricing (engagement), then settings and super-admin (low value, add opportunistically).

**Rule:** every new feature adds its events in the same change. Add this to the PR template (doc 26) so it does not decay.

### Phase 28.4 — Dashboards and alerts

Build the standing views: guest conversion funnel, host activation funnel, module adoption, error rate by release, plan conversion, AI usage vs cost.

Alerts: exception spike and `guest_form_rejected` (already named in the prior plan), plus conversion-rate collapse, which is the fastest signal that a deploy broke something a smoke test missed.

### Phase 28.5 — Privacy and cost

- Verify no PII is in event properties. Names, emails, phone numbers, and document contents must never be event properties; use IDs.
- Confirm `person_profiles: identified_only` keeps anonymous guests out of person profiles.
- Session replay (if enabled): mask all inputs by default; the guest form contains IDs and payment details. **Replay on the booking form is the single highest privacy risk in the app** — either exclude those routes or mask aggressively and verify by watching a recording.
- Event volume drives cost; sample high-volume, low-value events. Feed the quota into doc 25.
- Cookie/consent obligations — verify the legal copy matches actual behavior for the PH market and any EU visitors.

### Phase 28.6 — Data quality

- Naming convention enforced by the typed catalog (already in place — keep it).
- A test asserting no event is sent with an undefined required property.
- Verify events fire exactly once per action; duplicates corrupt funnels and are easy to introduce with re-renders (doc 06).

## Edge cases

- **Test/dev traffic in prod project** — the strict project split plus the E2E no-op prevents this. Verify Playwright never sends events when keys are present locally.
- **Ad blockers** suppress a meaningful share of client events; the `/ingest` rewrite helps but is not complete. Server-side events (already implemented for workflow transitions) are the reliable path for anything business-critical — revenue events should be server-side.
- **Identity stitching** — a guest who browses anonymously then signs in must have their pre-signin events attributed. Verify `identify` merges correctly and that `reset` on sign-out does not orphan the session.
- **Two identity systems** (guest auth vs admin auth) can collide in analytics if both map to the same distinct ID space. Verify separation.
- **Groups** — org/property/parking groups on every relevant event, or breakdowns by tenant are impossible.
- **Renaming an event** breaks historical funnels. Version or alias rather than renaming.
- **Analytics is not audit.** `activity_log` is the accountability record; PostHog is product measurement. Never derive one from the other (the prior plan states this explicitly).

## Exit gate

- [ ] Both PostHog projects created, keys set per environment, source maps symbolicating.
- [ ] The eight decision questions each answerable from a built funnel or insight.
- [ ] Deferred event gaps closed for plan gates, finance, inbox, pricing; remainder scheduled.
- [ ] Standing dashboards + alerts live with owners.
- [ ] PII audit of event properties clean; replay masking verified by watching a real recording of the booking form.
- [ ] Event volume within quota with sampling where needed; cost in the doc-25 inventory.
- [ ] Identity stitching verified across anonymous → signed-in guest.
- [ ] Revenue-critical events captured server-side.
- [ ] PR template requires events for new features.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/integrations.md`, `docs/PROJECT.md` (env vars), legal/privacy pages.
- **Plans / Team RBAC:** N/A — platform observability, not a host-paid module.
- **activity-log:** N/A — analytics is not an org mutation.
