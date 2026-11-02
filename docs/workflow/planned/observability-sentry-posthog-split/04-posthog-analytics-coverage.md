---
stage: planned
title: 'Observability split — 04 PostHog analytics coverage (Phases A0–A6)'
status: planned
tags: [workflow, planned, observability, posthog, analytics]
updated: 2026-11-01
kind: plan
---

# 04 — PostHog analytics coverage (A0–A6)

PostHog answers product questions only (D1, D2). This doc hardens the setup (A0), then
defines the full event matrix per surface (A1–A5) and the insights built on it (A6).

## Conventions (apply to every new event)

- **Name:** `object_action`, snake_case, past tense (`review_response_posted`). Declared in
  `ui/src/lib/posthog/catalog.ts` **and**, if emitted server-side, `_shared/posthogCatalog.ts`.
  The parity test (A0.3) enforces both.
- **Source of truth:** if the outcome is decided on the server (payment, submit accepted,
  workflow transition, webhook), emit on the **edge** after the write succeeds. Use the
  browser for intent and UI-only steps (opened, clicked, started, abandoned). Never emit the
  same outcome from both.
- **Properties:** ids, enums, counts, booleans, durations, buckets. Never free text, names,
  emails, phones, amounts tied to a person, URLs with query strings, file names. Money:
  `amount_bucket` (`<1k`, `1k-5k`, `5k-20k`, `20k+` PHP) or plan id.
- **Shared props** (added automatically): `environment`, `app_track`, `app_release`,
  `persona`, `surface`, `org_id`, `property_id`, `parking_id`, `plan_tier`.
- **Groups:** `organization`, `property`, `parking`. Edge events pass `groups` when the
  scope is known.
- **Outcome events that have a fault behind them** (e.g. `parking_payment_failed`) carry
  `request_id` so they can be joined with the Sentry issue. They do not carry the error
  message.
- **Volume:** no per-keystroke, per-scroll or per-row events. Bulk actions emit one event
  with `count`.

## A0 — Analytics hardening

- [x] **A0.1 URL scrub.** posthog-js `before_send`: run `scrubUrl` (S0.4) on `$current_url`,
      **Done** — `lib/posthog/beforeSend.ts`, 4 unit tests, drops the event if scrubbing throws.
      `$referrer`, `$initial_current_url`, `$initial_referrer`, `$pathname` stays. Drop
      the whole event if a sanitizer throws. Unit test with `?access=…&complete=…&token=…`.
- [ ] **A0.2 Analytics-only init** confirmed after P1: `capture_exceptions: false`,
      `capture_performance: false`, autocapture only in `full` mode, `mask_all_text` and
      `mask_all_element_attributes` for autocapture in guest surfaces, replay off.
- [x] **A0.3 Catalog parity test.** Vitest reads both catalogs and a static scan of
      **Done for the emitted→declared direction**, and it immediately caught the five review events from F-08. The declared→emitted direction waits for A1–A5.
      `capturePostHogEvent('…')` in `supabase/functions/**`; fails when an emitted name is
      missing from either catalog or a declared name has no emitter and no `// planned`
      allow-list entry. Fixes today's 5 missing review events (F-08).
- [x] **A0.4 Release prop.** `context.ts` adds `app_release` (`VITE_APP_VERSION`); edge
      **Done** — browser `app_release` in the shared props, edge `app_release` from `APP_RELEASE`.
      `capturePostHogEvent` adds `app_release` from `APP_RELEASE`.
- [x] **A0.5 Edge capture off the response path.** `capturePostHogEvent` uses
      **Done** — `runAfterResponse`, with a 3s bound kept inside the background task.
      `runAfterResponse` (`_shared/backgroundTask.ts`) instead of awaiting; keeps the 3 s
      bound inside the background task. Deno test: handler resolves before capture.
- [x] **A0.6 Edge groups + plan tier.** `capturePostHogEvent` accepts `{ orgId,
**Capability done** — `capturePostHogEvent`takes`{ organization, property, parking }`and sets`$groups`; wired at org/property/parking created. Remaining call sites follow in A1–A5. Org group properties (`plan_tier`, `verification_tier`) need `groupIdentify` from a plan-change event, which is A3 work.
propertyId, parkingId }` and sets `groups`; org group properties (`plan_tier`,
      `verification_tier`, `created_at`) are set once per org via `groupIdentify` from
      `org_created` and plan change events.
- [x] **A0.7 Browser group properties.** `PostHogAdminScopeSync` sets group props for
      **Blocked by data, not effort:** the `Organization` object carries no `plan_tier` or `verification_tier`, and this step forbids an extra fetch. Revisit when the org payload exposes them.
      organization (`plan_tier`, `verification_tier`, `property_count`,
      `parking_count`) from data already loaded in `AdminLayout`; no extra fetch.
- [x] **A0.8 Bot and internal filtering.** Set `person_properties.is_internal = true` for
      **Done** — `is_internal` from `VITE_SUPER_ADMIN_EMAILS` at identify time, 7 unit tests.
      `SUPER_ADMIN_EMAILS` users at identify time; PostHog project filter "exclude internal
      users" uses it. Playwright / CI never loads PostHog (doc 06).
- [ ] **A0.9 Remove unused catalog names** that the matrix below does not keep.

## Matrix legend

`Src`: `B` browser, `E` edge. `Status`: `live` (already emitted), `wire` (declared, not
emitted), `new` (add to catalog). Phase = A1–A5.

## A1 — Guest booking + host activation (launch bar)

### Guest discovery and booking

| Event                                                                    | Src       | Status | Key properties                                                           | Trigger                                   |
| ------------------------------------------------------------------------ | --------- | ------ | ------------------------------------------------------------------------ | ----------------------------------------- |
| `search_performed`                                                       | B         | live   | `result_count`, `has_dates`, `guests_bucket`, `location_kind`            | Search submit                             |
| `listing_viewed`                                                         | B         | live   | `property_id`, `source` (search, direct, marketing, share)               | Property page mount                       |
| `calendar_opened`                                                        | B         | live   | `property_id`                                                            |                                           |
| `stay_dates_selected`                                                    | B         | live   | `nights`, `lead_days_bucket`                                             |                                           |
| `guest_form_started` / `_step_completed` / `_step_failed` / `_abandoned` | B         | live   | `step`, `field_group` (no values)                                        |                                           |
| `guest_form_submitted`                                                   | E         | live   | `property_id`, `has_pets`, `has_parking`, `nights`, `source`             | After insert                              |
| `guest_form_rejected`                                                    | E         | live   | `reason` enum (captcha, antispam, rate_limit, validation, blocked_dates) | Before 4xx                                |
| `public_write_blocked`                                                   | E         | new    | `scope` (form, sd, parking, review, chat), `reason`                      | Replaces captcha/antispam exceptions (P1) |
| `guest_form_completion_submitted`                                        | E         | live   |                                                                          |                                           |
| `guest_document_opened`                                                  | B         | wire   | `document_kind` (gaf, pet, parking, contract)                            | Booking documents page                    |
| `guest_stay_guide_opened`                                                | B         | live   |                                                                          |                                           |
| `sd_form_opened` / `sd_form_submitted` / `sd_voucher_claimed`            | B / E / E | live   | `refund_method`                                                          |                                           |

### Auth and activation

| Event                                                  | Src | Status | Key properties                                                                             | Trigger                           |
| ------------------------------------------------------ | --- | ------ | ------------------------------------------------------------------------------------------ | --------------------------------- |
| `auth_signed_in` / `_signed_out`                       | B   | live   | `method` (google, otp, password), `persona`                                                |                                   |
| `auth_failed`                                          | B   | wire   | `method`, `reason` enum (cancelled, otp_invalid, otp_expired, not_allowed, provider_error) | Auth error handlers               |
| `onboarding_step_completed`                            | B   | live   | `step`                                                                                     |                                   |
| `org_created` / `property_created` / `parking_created` | E   | live   | `vertical`                                                                                 |                                   |
| `setup_guide_step_completed`                           | B   | wire   | `step_key`, `completed_count`, `total_count`                                               | Setup guide check                 |
| `listing_published`                                    | E   | new    | `property_id`, `days_since_org_created`                                                    | First time a property goes public |
| `team_invite_sent`                                     | E   | wire   | `scope` (org, property, parking), `role`                                                   | Invite edge success               |
| `team_invite_accepted`                                 | E   | live   | `scope`, `role`                                                                            |                                   |
| `host_verification_submitted`                          | E   | wire   | `tier_requested`                                                                           | Org verification submit           |
| `host_verification_resolved`                           | E   | wire   | `outcome` (approved, rejected, needs_info), `hours_to_resolve`                             | Super-admin resolve               |

## A2 — Booking ops, guest account, reviews, trip hub

| Event                                                                                     | Src | Status      | Key properties                                                         | Trigger                             |
| ----------------------------------------------------------------------------------------- | --- | ----------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `booking_workflow_transitioned`                                                           | E   | live        | `from`, `to`, `actor_kind`                                             | Orchestrator                        |
| `booking_workflow_cta_clicked`                                                            | B   | live        | `cta`, `status`                                                        |                                     |
| `booking_document_step_completed`                                                         | E   | live        | `step`                                                                 |                                     |
| `booking_updated` / `booking_rescheduled` / `booking_cancelled`                           | B/E | live        | `changed_fields` (keys only), `actor_kind`                             |                                     |
| `booking_imported`                                                                        | E   | wire        | `count`, `source` (csv, airbnb, booking_com, sheet), `mapping_ai_used` | Import commit (one event per batch) |
| `import_started` / `import_mapping_confirmed`                                             | B   | new         | `source`, `row_count_bucket`                                           | Import wizard                       |
| `guest_review_submitted`                                                                  | E   | live        | `rating`, `has_text`                                                   |                                     |
| `host_guest_review_submitted`                                                             | E   | live        | `rating`                                                               | Add to catalogs (F-08)              |
| `review_pair_published` / `review_response_posted` / `review_reported` / `review_removed` | E   | live        | `reason` enum where relevant                                           | Add to catalogs (F-08)              |
| `review_draft_ai_used`                                                                    | E   | new         | `accepted` (bool)                                                      | `reviewDraftAi.ts` success          |
| `trip_hub_opened`                                                                         | B   | new         | `trip_stage` (upcoming, in_stay, past)                                 | `/account/trips/:id` mount          |
| `trip_hub_section_opened`                                                                 | B   | new         | `section` (guide, documents, chat, parking, review)                    |                                     |
| `guest_message_sent`                                                                      | B   | live        | `channel` (web_chat)                                                   |                                     |
| `guest_favorite_toggled` / `guest_voucher_viewed`                                         | B   | live / wire | `state`                                                                |                                     |
| `inbox_reply_sent`                                                                        | E   | wire        | `channel` (messenger, instagram, web_chat), `ai_drafted` (bool)        | Inbox send edge success             |
| `inbox_ai_suggest_used`                                                                   | B   | wire        | `action` (inserted, edited, discarded)                                 |                                     |
| `inbox_auto_reply_sent`                                                                   | E   | new         | `channel`, `handoff` (bool)                                            | `metaInboxAutoReply.ts`             |
| `meta_inbox_connected` / `_disconnected`                                                  | E   | wire        | `channel`, `reason` (user, token_expired, revoked)                     | OAuth callback / lifecycle          |
| `calendar_sync_connected`                                                                 | E   | wire        | `provider` (airbnb, booking_com, vrbo, other)                          | Feed added                          |

## A3 — Parking, billing, plans

| Event                                                   | Src | Status | Key properties                                                     | Trigger                                                                    |
| ------------------------------------------------------- | --- | ------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `parking_booking_started`                               | B   | wire   | `parking_id`, `duration_kind` (hourly, daily, monthly)             | Pay-parking form start                                                     |
| `parking_checkout_started`                              | B   | wire   | `amount_bucket`                                                    | PayMongo redirect                                                          |
| `parking_payment_completed`                             | E   | wire   | `amount_bucket`, `method`                                          | `paymongo-webhook` paid (inside dedupe)                                    |
| `parking_payment_failed`                                | E   | wire   | `reason` enum, `request_id`                                        | Webhook failed / expired                                                   |
| `parking_request_submitted` / `_approved` / `_declined` | E   | new    | `request_kind`                                                     | Parking request edge fns                                                   |
| `parking_broadcast_sent` / `_claimed`                   | E   | new    | `recipient_count_bucket`                                           |                                                                            |
| `org_plan_checkout_started` / `_cancelled` / `_failed`  | B   | live   | `plan_id`, `interval`                                              |                                                                            |
| `org_plan_checkout_completed`                           | E   | move   | `plan_id`, `interval`, `is_upgrade`                                | Move from browser to `paymongo-webhook` (F-22)                             |
| `org_plan_changed`                                      | E   | new    | `from_plan`, `to_plan`, `cause` (upgrade, downgrade, lapse, admin) | `subscriptionOrchestrator`, `apply-org-plan-downgrade`, `platform-billing` |
| `upgrade_modal_shown` / `_cta_clicked`                  | B   | live   | `feature_key`, `required_tier`                                     |                                                                            |
| `feature_gate_hit`                                      | B   | new    | `feature_key`, `plan_tier`                                         | `useFeatureGate` deny render (once per session per key)                    |

## A4 — Host modules, AI, marketing, content

| Event                                                                                   | Src | Status | Key properties                                              | Trigger                                           |
| --------------------------------------------------------------------------------------- | --- | ------ | ----------------------------------------------------------- | ------------------------------------------------- |
| `pricing_rates_saved`                                                                   | B   | wire   | `scope` (base, season, date_override), `count`              | Pricing save success                              |
| `smart_pricing_applied`                                                                 | E   | wire   | `nights_changed`, `mode` (suggest, auto)                    |                                                   |
| `finance_entry_saved`                                                                   | B   | wire   | `kind` (income, expense), `has_receipt`, `ai_validated`     |                                                   |
| `maintenance_ticket_created`                                                            | E   | wire   | `priority`, `source` (dashboard, telegram, guest)           |                                                   |
| `settings_saved`                                                                        | B   | wire   | `section` key (never values)                                | Shared settings save hook, one place              |
| `public_page_published`                                                                 | E   | wire   | `page_kind` (custom, landing), `block_count_bucket`         | Custom page publish                               |
| `announcement_published`                                                                | E   | new    | `audience` (guests, team), `channel_count`                  |                                                   |
| `analytics_module_viewed`                                                               | B   | new    | `report` (overview, occupancy, revenue, ai_review), `range` | Host analytics page                               |
| `analytics_ai_review_opened`                                                            | B   | new    | `period`                                                    |                                                   |
| `activity_log_viewed`                                                                   | B   | new    | `filter_count`                                              |                                                   |
| `ai_assistant_turn_completed`                                                           | E   | wire   | `tool_count`, `had_pending_action`, `model_tier`            | Assistant turn end                                |
| `ai_assistant_action_confirmed` / `_rejected`                                           | E   | new    | `tool`                                                      | Pending action resolve                            |
| `ai_credit_limit_reached`                                                               | E   | new    | `scope` (org, platform)                                     | `aiLimitGuard` deny                               |
| `marketing_caption_generated` / `marketing_post_published` / `marketing_publish_failed` | B   | live   | `channel`, `media_kind`                                     | Move publish result to edge (`metaPublishing.ts`) |
| `marketing_asset_generated`                                                             | E   | new    | `kind` (image, video, template, poster), `theme`            | Generation success                                |
| `voice_*` (20 events)                                                                   | B   | live   | unchanged                                                   |                                                   |
| `contract_sent` / `contract_signed`                                                     | E   | new    | `contract_kind`                                             | Contract lifecycle                                |
| `listing_authorization_submitted` / `_resolved`                                         | E   | new    | `outcome`                                                   |                                                   |
| `development_created`                                                                   | E   | new    |                                                             | Developments module                               |
| `help_article_viewed`                                                                   | B   | new    | `article_slug` (public slug only), `surface`                | Help center                                       |
| `support_ticket_submitted`                                                              | B   | live   | `category`                                                  |                                                   |

## A5 — Notifications, PWA, super-admin

| Event                                       | Src | Status     | Key properties                                                                    | Trigger                                           |
| ------------------------------------------- | --- | ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `notification_opened`                       | B   | wire       | `kind`, `channel` (in_app, push, email_link)                                      | Notification click / SW `notificationclick` relay |
| `push_opt_in_prompted` / `pwa_push_changed` | B   | new / live | `outcome`                                                                         |                                                   |
| `pwa_*` (8 events)                          | B   | live       | unchanged; `pwa_sync_failed` stays as an outcome, its fault goes to Sentry (S1.9) |                                                   |
| `media_optimized`                           | B   | live       |                                                                                   |                                                   |
| `super_admin_action`                        | E   | wire       | `action` key (same key as `superAdminAudit`), no target names                     | Super-admin edge writes                           |
| `host_approval_resolved`                    | E   | wire       | `outcome`                                                                         |                                                   |
| `platform_plan_updated`                     | E   | wire       | `plan_id`, `fields_changed` (keys)                                                |                                                   |

Every row ends as wired or explicitly N/A with a reason in the PR. Rows marked `new` are
added to both catalogs in the same PR as the emitter.

## A6 — Insights and dashboards (prod PostHog project)

| #   | Insight                               | Definition                                                                                                                                       |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Guest booking funnel                  | `listing_viewed` → `stay_dates_selected` → `guest_form_started` → `guest_form_submitted`, by `source`, 7-day window                              |
| 2   | Guest form step drop-off              | `guest_form_step_completed` by `step`, plus `guest_form_abandoned` by last step                                                                  |
| 3   | Host activation                       | `auth_signed_in` (host) → `org_created` → `property_created` → `listing_published` → first `guest_form_submitted` (group: organization), 30 days |
| 4   | Time to first booking                 | Median days `org_created` → first `guest_form_submitted` per org                                                                                 |
| 5   | Parking funnel                        | `parking_booking_started` → `parking_checkout_started` → `parking_payment_completed`                                                             |
| 6   | Plan conversion                       | `upgrade_modal_shown` / `feature_gate_hit` → `org_plan_checkout_started` → `org_plan_checkout_completed`, by `feature_key`                       |
| 7   | Feature adoption (weekly active orgs) | Unique orgs per week emitting inbox, AI assistant, marketing, pricing, finance, maintenance, reviews events                                      |
| 8   | Retention                             | Host retention by `org_created` week (returning with any host event); guest repeat booking                                                       |

Dashboards: **Growth** (1, 3, 4, 6), **Guest experience** (1, 2, 5, review events),
**Adoption** (7, 8). Each dashboard filters `environment = production`, excludes internal
users, and has a `app_release` breakdown option to compare deploys.

## Done when

- Parity test green; every matrix row wired or N/A.
- A0.1 test green and a manual Live events check shows no token query values.
- No edge handler awaits PostHog on the response path.
- Insights 1–8 exist in prod and show data after one week.
