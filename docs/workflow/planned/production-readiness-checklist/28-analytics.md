---
title: 'Analytics'
status: active
tags: [workflow, planned, production-readiness, analytics, posthog]
updated: 2026-09-19
stage: planned
kind: plan
---

# 28 — Analytics

## Goal

Every product decision is answerable from data, every funnel is instrumented, and analytics costs and privacy obligations are controlled.

## Implementation status (2026-09-19 session)

Confirmed this doc's own assessment is accurate and current: `ui/src/lib/posthog/catalog.ts` already defines event names for most of the "deferred" surfaces this doc lists as still open — `upgrade_modal_shown`/`upgrade_modal_cta_clicked` (plan gates), `finance_entry_saved`, `inbox_reply_sent`/`inbox_ai_suggest_used`, `pricing_rates_saved`/`smart_pricing_applied`, `meta_inbox_connected`/`meta_inbox_disconnected`, `calendar_sync_connected`, `settings_saved`, `public_page_published`, `notification_opened`, `platform_plan_updated`. **What's not verified this session:** whether each is actually fired at every relevant call site (a per-surface audit across ~15 event names × their call sites, not attempted — genuinely incremental work per the doc's own Phase 28.3 framing, not a single sweep). No PostHog operator access this session either (no project/keys), so Phase 28.1's blocking gate is unchanged. Also checked: `captureAppEvent` has no per-event required-property schema to test against (28.6's "test asserting no undefined required property") — properties are untyped `Record<string, unknown>` per call site by design; building that schema is a scope decision, not attempted here.

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

## Remaining work to finalize

**Status: not started as this folder's plan.** Application event code is largely shipped (do not redo). Remaining work is operator setup, deferred events, and proof. Per the prior plan's deferral list plus this doc's exit gate:

| #   | Work                                                                                                                                                                         | Blocker                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Create `kame-homes-prod` + `kame-homes-nonprod` PostHog projects; set Vercel + Supabase secrets; upload source maps (28.1).                                                  | Operator                |
| 2   | Answer the eight decision questions from built funnels / insights (28.2).                                                                                                    | Depends on 1            |
| 3   | Close deferred events: plan gates, finance, inbox, pricing, Meta connect, calendar sync, settings, public page, notifications, super-admin, parking payment webhooks (28.3). | Code, incremental       |
| 4   | Standing dashboards + alerts with named owners (28.4).                                                                                                                       | Operator                |
| 5   | PII audit of event properties; replay masking verified on a real booking-form recording (28.5).                                                                              | Operator + display      |
| 6   | Event volume within quota; sampling where needed; cost in the doc-25 inventory.                                                                                              | Hosted + doc 25         |
| 7   | Identity stitching: anonymous → signed-in guest. Revenue-critical events server-side.                                                                                        | Code + 1                |
| 8   | PR template requires events for new features. `analytics_mode` refresh from `get-public-app-config` when that endpoint ships.                                                | Process + that endpoint |

Also still open from the prior plan: masked session replay sampling (its Phase 5).

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
