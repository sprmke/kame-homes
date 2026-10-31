---
title: 'PostHog analytics and error tracking — production readiness'
status: for-testing
tags: [workflow, for-testing, posthog, analytics, observability, privacy]
updated: 2026-09-12
stage: in-progress
kind: plan
origin_stage: for-testing
readiness: unverified
launch_gate: F
launch_blocker: tbd
last_verified: none
---

# PostHog analytics and error tracking — production readiness

## Ship status (2026-09-12)

**Application code: complete.** Typed catalog, `captureAppEvent` / `capturePostHogEvent`, guest funnel, host activation, workflow server events, plan checkout, discovery (search/favorites/for-hosts), upgrade modal, PWA/media sinks, groups, legal copy, `/ingest` rewrite, source-map release = git SHA, E2E no-op without keys.

**Operator before prod keys:** create `kame-homes-prod` + `kame-homes-nonprod` PostHog projects; set Vercel + Supabase secrets; configure PostHog alerts (exception spike, guest_form_rejected); build funnels per § PostHog insights below.

**Deferred (non-blocking):** inbox reply/Meta connect/finance/pricing/calendar-sync/settings/public-page/notification/super-admin custom events (add incrementally when those surfaces change); masked session replay sampling (Phase 5); `analytics_mode` refresh from `get-public-app-config` when that endpoint ships; parking payment webhook events (wire with parking checkout work).

Make PostHog the production source for **product decisions** (where people drop off, which
surfaces to improve, how hosts activate, what converts) and **reliability** (exceptions
tied to the same person and session). The SDK plumbing already exists. This plan finishes
identity, taxonomy, server conversions, privacy, environments, dashboards, and the edge
cases the current 11 client-only events miss.

Prior audit: conversation review of `ui/src/lib/posthog/*`, `_shared/posthog.ts`, and every
`posthog.capture` call (2026-09-12).

## Goal

After this ships, a host-product question such as "where do Facebook guests abandon the
booking form on Solea?" or "how long until a new org publishes its first listing?" is
answerable from PostHog funnels and breakdowns, without reading logs. A 500 spike is
alerted, symbolicated, and joinable to the same session as the last product event.

## Scope

**In**

- Browser + edge PostHog: events, identify, groups, exceptions, source maps, sampled replay
- Event taxonomy for every **decision-relevant** journey (guest, host, parking, guest
  account, marketing, super-admin, PWA)
- Production config: keys, env split, legal copy, cost controls, dashboards, alerts
- Tests and docs so new features add events in the same change

**Out**

- [Host Analytics module](../../../for-testing/host-analytics-module.md) (occupancy / ADR / RevPAR). Different
  product; PostHog does not replace it.
- [Org activity / audit log](../../../for-testing/org-activity-audit-log.md). Complementary
  (accountability). Do not emit `activity_log` rows from PostHog, or PostHog events from
  every audit write.
- Sentry. Still deferred (`docs/architecture/integrations.md` §9.5).
- PostHog feature flags for plan / RBAC gates. Keep entitlements in `planFeatures` + team
  leaves.
- The full [service cost console](../../../planned/super-admin-service-cost-monitoring.md). This plan
  implements the PostHog `analytics_mode` **client/edge read** that plan already specified
  (D8.1). The Super Admin knobs stay in that plan.

**Plans / team RBAC:** N/A. Platform observability, not a host-paid module.

**activity-log:** N/A. Analytics is not an org mutation.

## Current state (do not re-do)

| Already good                                                                                           | Gap                                                                          |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `posthog-js` singleton, `defaults: '2026-05-30'`, `person_profiles: identified_only`                   | No environment / persona / plan on the browser client                        |
| Identify + reset on shared Supabase session                                                            | No `group` (org / property / parking); email sent for every identified user  |
| React boundary + window exceptions + edge `capturePostHogException` + 3s flush timeout + URL sanitizer | No **product** events from the edge; some `serve()` paths only report errors |
| Replay off in prod unless `VITE_POSTHOG_SESSION_REPLAY=true`                                           | No input masking; `analytics_mode` not built                                 |
| Hidden source maps when personal key + project id are set; upload cannot fail the build                | Keys optional; intake still says "create the project"                        |
| 11 named client events (workflow UI, plans checkout, marketing publish, tickets, review, guest chat)   | Guest booking funnel = 0; host onboarding = 0; cron/webhook conversions = 0  |
| Autocapture `$pageview`                                                                                | Form steps are React state, not URLs                                         |
| `pwaTelemetry` / `mediaTelemetry` sinks                                                                | Not pointed at PostHog                                                       |
| Cookie policy: "we do not load analytics scripts"                                                      | False the moment `VITE_POSTHOG_KEY` is set                                   |

## Locked decisions

1. **Two PostHog projects.** `kame-homes-prod` (Vercel Production for `kame-homes` + hosted
   mt-prod edge, when that exists) and `kame-homes-nonprod` (local, Vercel Preview,
   `dev.kamehomes.space`, mt-dev edge). Never share the prod project key with `./dev.sh`.
   Dual-track: do **not** point legacy `guest-form-management-app` / `zftt…` at the mt
   project without a `$app_track` of `legacy` vs `mt`. Prefer instrumenting **kame-homes /
   develop** first.
2. **Browser always sets** `$environment` (`local` | `preview` | `production`) and
   `$app_track`. Edge already has `environmentTag()`; align the allowed values.
3. **Consent model (PH-first).** Disclose first-party analytics on Cookies + Privacy. No
   advertising pixels. No consent banner in v1. If we later serve the EU, add a banner
   that defaults capture **off** until accept. Update the current "we do not load
   analytics" sentence **before** any production key goes live.
4. **Anonymous guests stay anonymous.** Do not `identify` until Supabase Auth. Authenticated
   guests get `persona: guest` and **no email** person property. Hosts / super-admins may
   keep email on the person profile.
5. **Groups:** `organization` (org id), `property` (property id), `parking` (parking id when
   scoped). Register group properties: `slug`, `plan_tier` (org), `name` (non-PII).
6. **Server is source of truth for conversions.** Client fires funnel _steps_ and UX.
   Edge / orchestrator / webhook / cron fire _completed_ money, booking, and status events.
   Never fire the same `*_submitted` / `*_completed` name from both sides.
7. **One typed catalog + two helpers.** UI `captureAppEvent`, edge `capturePostHogEvent`.
   Unknown names fail type-check. Helpers strip denylisted keys and require `persona`.
8. **Replay stays off** until Phase 7 (masking + sample). Do not "just turn it on" to debug.
9. **Autocapture stays on** (rageclick, dead click, pageviews). Mark dense admin tables and
   file inputs with `data-ph-mask` / `data-ph-no-capture` so receipts and IDs are not
   scraped into autocapture properties.
10. **Ad-block loss.** Add a first-party ingest rewrite (`/ingest` → PostHog) on the
    kame-homes Vercel project so guest-funnel counts are not silently truncated.
11. **Do not log PII in event properties.** Allow: ids (booking / org / property / parking /
    user), enums, booleans, counts, durations, star ratings, **rounded** money buckets if
    needed. Deny: names, emails, phones, addresses, message bodies, file URLs, `access` /
    `complete` / `token` query values, ID numbers, captions, ticket descriptions.

## Event taxonomy

Names are `snake_case`, object + past tense (`guest_form_submitted`). Shared properties on
**every** event (helpers attach; callers do not repeat):

| Property                                | Values                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `environment`                           | `local` \| `preview` \| `production`                                                                                |
| `app_track`                             | `mt` \| `legacy`                                                                                                    |
| `persona`                               | `anonymous_guest` \| `guest` \| `host` \| `super_admin` \| `system`                                                 |
| `surface`                               | `marketing` \| `guest_ops` \| `guest_account` \| `host_dashboard` \| `parking_dashboard` \| `super_admin` \| `edge` |
| `org_id` / `property_id` / `parking_id` | UUID or omitted                                                                                                     |
| `plan_tier`                             | `free` \| `starter` \| `growth` \| `pro` \| `managed` \| omitted                                                    |

Existing events keep their names. Add the shared properties; do not rename.

### P0 — Guest booking conversion

Client (step / UX):

| Event                       | When                                                         | Extra props                                                                    |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `listing_viewed`            | Public property / parking / host profile mount               | `listing_kind`, `slug`                                                         |
| `calendar_opened`           | Calendar page ready                                          | `booking_source` (`facebook` \| `airbnb` \| `unknown`)                         |
| `stay_dates_selected`       | Guest confirms a range                                       | `nights`                                                                       |
| `guest_form_started`        | Form first interactive / step 1 shown                        | `booking_source`, `step_count`                                                 |
| `guest_form_step_completed` | Continue succeeds                                            | `step_id`, `step_name` (`guest` \| `stay` \| `parking` \| `pets` \| `payment`) |
| `guest_form_step_failed`    | Step validation fails                                        | `step_id`, `step_name`, `error_count`                                          |
| `guest_form_abandoned`      | Unload / hide after `started` and before submit (sendBeacon) | `last_step_id`, `seconds_on_form`                                              |

Edge (conversion):

| Event                             | When                                                                       | Extra props                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `guest_form_submitted`            | `submit-form` DB save ok                                                   | `booking_source`, `is_update`, `has_pets`, `need_parking`, `nights`, `reverted_to_pending_review` |
| `guest_form_rejected`             | Anti-spam / captcha / overlap / validation **after** a real submit attempt | `reason` (`spam` \| `captcha` \| `overlap` \| `validation` \| `rate_limited`)                     |
| `guest_form_completion_submitted` | `submit-form-completion` (OTA fill-in)                                     | `booking_source`                                                                                  |

Airbnb: `step_count` 4, no `payment` step. Empty `documentRequirements` does not change
submit; it changes later host workflow only.

### P0 — Host activation

| Event                                                        | Side                          | When                                                                              |
| ------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------- |
| `auth_signed_in`                                             | Client                        | Host or guest session becomes available (`method`: `google` \| `otp` \| `invite`) |
| `auth_signed_out`                                            | Client                        | Explicit sign-out (reset already runs)                                            |
| `auth_failed`                                                | Client                        | OTP / OAuth error shown                                                           |
| `onboarding_step_completed`                                  | Client                        | Host-type / listing step in `/onboarding`                                         |
| `org_created`                                                | Edge                          | `create-organization` success                                                     |
| `property_created` / `parking_created`                       | Edge                          | First persist of that listing                                                     |
| `setup_guide_step_completed`                                 | Client or `setup-guide-state` | `step_id`, `skipped`                                                              |
| `team_invite_accepted`                                       | Edge                          | `/accept-invite` success                                                          | `scope` (`org` \| `property` \| `parking`) |
| `host_verification_submitted` / `host_verification_resolved` | Edge                          | Submit + super-admin approve/reject                                               | `tier`, `outcome`                          |

### P0 — Booking lifecycle (single emitter)

Move `booking_workflow_transitioned`, `booking_document_step_completed`, and
`booking_cancelled` from `WorkflowPanel` to `workflowOrchestrator.transition()` and
`cancel-booking`. Keep the **names**. Add `actor_type` (`host` \| `guest` \| `cron` \|
`webhook` \| `ai_assistant` \| `system`), `manual`, `property_id`.

Also emit from every other caller so the funnel is complete:

- `approval-email-webhook` (GAF / pet mark-complete)
- `sd-refund-cron` (check-out move)
- `parkingPaymentOrchestrator` (nested parking complete)
- `submit-sd-form`
- Import / calendar-sync create or cancel (`booking_imported`, reuse `booking_cancelled`)
- Admin reschedule (`booking_rescheduled` — not an orchestrator transition today)

Client may keep a **UI-only** `booking_workflow_cta_clicked` if we need "clicked Proceed
but server 409'd". Do not fire `booking_workflow_transitioned` from the panel anymore.

### P1 — Stay / money after booking

| Event                                                                                                           | Side                                                                                                             | When                                              |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `sd_form_opened` / `sd_form_submitted`                                                                          | Client open; edge `submit-sd-form`                                                                               | `had_voucher_reveal`                              |
| `sd_voucher_claimed`                                                                                            | Edge `claim-sd-voucher`                                                                                          | `won`                                             |
| `guest_review_submitted`                                                                                        | Keep; also fire from `submit-guest-review` if the standalone `/guest-review` path can skip the current component | already has rating counts                         |
| `guest_stay_guide_opened`                                                                                       | Client                                                                                                           | token-gated; never send the token                 |
| `guest_document_opened`                                                                                         | Client                                                                                                           | `doc_kind` (`gaf` \| `pet`)                       |
| `parking_booking_started` / `parking_checkout_started` / `parking_payment_completed` / `parking_payment_failed` | Client start; edge/webhook complete                                                                              | `rail`, `failure_code`                            |
| `org_plan_checkout_started` / `org_plan_checkout_completed`                                                     | Keep                                                                                                             | add `org_plan_checkout_cancelled` on `cancel_url` |
| `org_plan_checkout_failed`                                                                                      | Client or webhook                                                                                                | `reason`                                          |

### P1 — Feature adoption (host)

Named events only for **meaningful actions**, not every field save. Autocapture covers
clicks.

| Event                                                      | When                                 |
| ---------------------------------------------------------- | ------------------------------------ |
| `inbox_reply_sent`                                         | Host send (Meta or web)              | `platform`, `is_ai_generated`              |
| `inbox_ai_suggest_used`                                    | Suggest applied or discarded         | `outcome`                                  |
| `meta_inbox_connected` / `meta_inbox_disconnected`         | OAuth success / disconnect           | `scope`                                    |
| `marketing_caption_generated` / `marketing_post_published` | Keep; add `marketing_publish_failed` |                                            |
| `ai_assistant_turn_completed`                              | Dashboard assistant turn ends        | `tool_count`, `flagged`                    |
| `finance_entry_saved`                                      | Create/update income or expense      | `kind`                                     |
| `maintenance_ticket_created`                               | New ticket                           | `priority`                                 |
| `pricing_rates_saved` / `smart_pricing_applied`            | Bulk or AI apply                     | `date_count`                               |
| `calendar_sync_connected`                                  | Feed added                           |                                            |
| `team_invite_sent`                                         | Invite created                       | `scope`                                    |
| `settings_saved`                                           | Coarse                               | `group` (`property` \| `org` \| `parking`) |
| `public_page_published`                                    | Stay guide / showcase publish        | `page_kind`                                |
| `notification_opened`                                      | Bell item opened                     | `category`                                 |
| `upgrade_modal_shown` / `upgrade_modal_cta_clicked`        | Feature gate                         | `feature_key`                              |

### P1 — Discovery + guest account

| Event                      | When                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `search_performed`         | Search submit / typeahead commit                                   | `query_len`, `result_count`, `has_dates` (never raw query if it can contain a name; hash or omit) |
| `for_hosts_cta_clicked`    | Pricing / register / login                                         | `cta`                                                                                             |
| `guest_favorite_toggled`   | Add/remove                                                         | `on`                                                                                              |
| `guest_voucher_viewed`     | Wallet row opened                                                  |                                                                                                   |
| `guest_message_sent`       | Keep                                                               |                                                                                                   |
| `support_ticket_submitted` | Keep; also fire from public `/contact` if it uses a different form |                                                                                                   |

### P2 — Super-admin + platform

| Event                    | When                                                  |
| ------------------------ | ----------------------------------------------------- |
| `super_admin_action`     | Rare, high-signal writes already in `superAdminAudit` | `action` (reuse audit key, no payload dump) |
| `host_approval_resolved` | Approvals queue                                       | `outcome`                                   |
| `platform_plan_updated`  | Pricing catalog change                                |                                             |

Do **not** mirror every admin pageview as a custom event.

### P2 — PWA + media

Point existing sinks at `captureAppEvent`:

| Current sink     | Event                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pwaTelemetry`   | `pwa_install_prompt_shown`, `pwa_install_outcome`, `pwa_installed`, `pwa_push_changed`, `pwa_offline_queued`, `pwa_sync_failed`, `pwa_update_applied`, `pwa_kill_switch` |
| `mediaTelemetry` | `media_optimized` (path, surface, ratio bucket, duration bucket)                                                                                                         |

### Explicit non-events

- Every keystroke, calendar day hover, kanban drag pixel, assistant token stream
- Raw AI prompts / replies, inbox message bodies, email HTML
- Health checks, `get-booked-dates` polls, dashboard refetch
- `parking-broadcast-email` 410 stub
- Intentional 401/403/409 (already excluded from exception capture)

## Identity, groups, init

**Files:** `ui/src/lib/posthog/client.ts`, `PostHogIdentitySync.tsx`, new
`ui/src/lib/posthog/capture.ts`, `ui/src/lib/posthog/catalog.ts`,
`ui/src/lib/posthog/context.ts` (read org/property/parking/plan from existing
dashboard hooks / route params; safe no-ops on public pages).

Init additions:

- `persistence: 'localStorage+cookie'`
- `capture_pageview: 'history_change'` (already in defaults; do not double-enable)
- `session_recording.maskAllInputs: true`, `maskTextSelector` for
  `[data-ph-mask], input, textarea`
- `opt_out_capturing_by_default: false` (v1); document the EU flip
- `loaded` callback: `register({ environment, app_track })`
- First-party `api_host: '/ingest'` in production builds when the rewrite exists;
  keep `VITE_POSTHOG_HOST` as the absolute fallback for local
- DEV: keep fail-loud if key/host missing **or** switch to a documented dummy
  `https://localhost` no-op host so new clones do not need a real project. Prefer
  **dummy host in DEV when unset** (Playwright already injects keys). Align
  `integrations.md` with whatever we ship; today's "unset no-ops" text is wrong in DEV.

Identity sync additions:

- `persona` from route + session (super-admin email list, `/account` vs `/org`)
- `posthog.group('organization', orgId, { plan_tier, slug })` when org context exists
- Reset groups on sign-out
- Do not identify with email for `persona === 'guest'`

Edge: `capturePostHogEvent(name, { distinctId, request, properties })` in
`_shared/posthog.ts`. Reuse tracing headers. Cron/webhook: `persona: system`,
`$process_person_profile: false`. Flush + 3s timeout like exceptions.

## Error tracking (complete)

Keep the choke points. Close these holes:

| Item                    | Action                                                                                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source maps             | Set `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` (+ host) on **kame-homes Production and Preview** build env. Release name should include git SHA, not a fixed `guest-form-management-ui`.                                        |
| New `serve()` functions | Checklist in `supabase-edge-functions.mdc`: must use `serveAdmin` / `servePublic` / `serveCronPost` **or** call `handleEdgeError` / `capturePostHogException`. Add a Deno or script test that greps `serve(` without a capture import. |
| Client API failures     | Optional `edge_request_failed` (function name, status ≥ 500 only) from `callEdgeFunction` / public fetch wrapper. Do not fire on 4xx.                                                                                                  |
| Offline / SW            | SW errors already go to the page; `pwa_sync_failed` covers outbox.                                                                                                                                                                     |
| Alerts (PostHog)        | Exception volume spike; `guest_form_rejected` spike (`reason=spam` excluded); `parking_payment_failed` spike.                                                                                                                          |
| Tracing                 | Confirm `tracing_headers` hostname matches **both** `*.supabase.co` and local `127.0.0.1` functions when used.                                                                                                                         |

## Privacy, legal, replay

- Rewrite Cookies + Privacy (+ `docs/guides/routes/legal.md`) **in Phase 0**, before keys
  on Production. State: first-party product analytics and error tracking; no ads; session
  replay off or masked; how to opt out (browser storage clear; later a toggle if needed).
- `data-ph-mask` on guest form fields, ID/receipt uploads, inbox composer, finance notes.
- `sanitizeUrlForTelemetry` already redacts query values; reuse on any client
  `$current_url` override if we set one.
- Session replay: Phase 7 only. Sample ≤ 5% hosts, **0%** anonymous guest ops until we
  have a week of masked recordings from a staging project. Console/network capture off.
- Identify email (hosts only) is the only standing PII person property.

## Environments, keys, cost

Operator checklist (no secrets in the repo):

| Env                             | UI                                           | Edge                | Build                          |
| ------------------------------- | -------------------------------------------- | ------------------- | ------------------------------ |
| Local                           | nonprod key + host **or** dummy              | unset or nonprod    | unset (no maps)                |
| `dev.kamehomes.space` / Preview | nonprod                                      | nonprod `POSTHOG_*` | nonprod personal key optional  |
| kame-homes Production           | **prod**                                     | **prod**            | prod personal key + project id |
| Legacy live (`main` / `zftt…`)  | do not add until dual-track cutover decision | same                | same                           |

Also add `VITE_POSTHOG_SESSION_REPLAY` and `VITE_POSTHOG_INGEST_PATH` to
`ui/.env.example` and `scripts/dev/sync-vercel-dev-env.mjs`.

**Cost (this plan, not the full cost console):**

- `analytics_mode` in `localStorage` (`full` \| `sampled` \| `errors_only` \| `off`),
  compiled default `full` for nonprod and `sampled` for prod, refresh from
  `get-public-app-config` when that endpoint exists (see cost-monitoring plan D8.1).
- `sampled`: pageviews + named P0/P1 events + exceptions; autocapture off; replay 0.
- `errors_only`: exceptions only.
- Autocapture exclusion list for `/org/**` table bodies if event volume is high.

## PostHog insights to create (no app code)

Create in the **prod** project after Phase 2–3 data exists. Repeat in nonprod for QA.

1. Guest submit funnel: `calendar_opened` → `guest_form_started` → each
   `guest_form_step_completed` → `guest_form_submitted`. Break down by
   `booking_source`, `property_id`.
2. Guest reject reasons (last 7 days).
3. Host activation: `auth_signed_in` (host) → `org_created` → `property_created` →
   first `booking_workflow_transitioned` or first inbound `guest_form_submitted` for
   that org.
4. Plan checkout: started → completed / cancelled / failed.
5. Inbox: threads with reply vs AI suggest apply rate (pageview on inbox + events).
6. Exception dashboard: browser vs `runtime=deno-edge-function`, top `logPrefix`.
7. PWA install rate (`pwa_install_prompt_shown` → `pwa_installed`).
8. Saved **actions** for each catalog name so HogQL / trends stay stable if we add props.

Weekly review (human): top drop-off step, new exception fingerprints, checkout conversion.

## Edge cases (must handle)

| Case                                  | Handling                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared device / second login          | Existing `reset()` before re-identify                                                                                                            |
| StrictMode double mount               | Helpers idempotent; form `started` once per page session (`sessionStorage` key)                                                                  |
| Multi-tab checkout                    | Existing checkout session storage; complete event once (`successHandledRef` pattern)                                                             |
| Guest closes tab mid-form             | `guest_form_abandoned` via `visibilitychange` / `pagehide` + `sendBeacon`                                                                        |
| Ad blockers                           | First-party `/ingest`                                                                                                                            |
| Token URLs (`?access=`, `?complete=`) | Never in properties; sanitizer on errors                                                                                                         |
| Airbnb vs Facebook steps              | `step_count` + skip `payment`                                                                                                                    |
| SD = 0 / no review page               | Do not expect `sd_form_*`; review may use `/guest-review`                                                                                        |
| D2 empty document requirements        | Orchestrator still emits transition (`PENDING_REVIEW` → `READY_FOR_CHECKIN`)                                                                     |
| Calendar-sync / import bookings       | `booking_imported`; no guest_form_submitted                                                                                                      |
| Status 409 on Proceed                 | No transition event; optional CTA-clicked + exception if 500                                                                                     |
| Plan-gated email skip                 | Not a product event (already in activity / toast)                                                                                                |
| Feature-gate upgrade modal            | `upgrade_modal_*`                                                                                                                                |
| Offline queue                         | `pwa_offline_queued` / `pwa_sync_failed`; mutation success events fire after drain                                                               |
| Captcha / rate limit                  | `guest_form_rejected` only, not exceptions (already true for <500 `Response`)                                                                    |
| Playwright                            | Dummy key + **route.abort** PostHog ingest so CI does not hit US Cloud                                                                           |
| Local without keys                    | DEV dummy host or documented throw; E2E already injects keys                                                                                     |
| Preview = prod key mistake            | Two projects; fail CI quality? optional script that asserts Preview key ≠ hardcoded prod (cannot know prod in CI). Document in deploy checklist. |
| Legacy + mt same key                  | `$app_track`; prefer separate projects at cutover                                                                                                |
| Super-admin using an org              | `persona: super_admin` still, plus org group                                                                                                     |
| Parking vs property scope             | `parking_id` group when under `/parking/`                                                                                                        |
| I18n / copied legal                   | Cookies text is the source; keep Privacy in sync                                                                                                 |
| `compareFormData` omitting `petType`  | Out of scope (workflow bug); do not hide it with analytics                                                                                       |

## Implementation tasks

### Phase 0 — Foundation (block production keys until legal copy lands)

- [ ] `catalog.ts` — string-union of all event names above (existing + new).
- [ ] `capture.ts` — `captureAppEvent`; denylist; attach context; no-op when disabled.
- [ ] `context.ts` — persona / ids / plan from route + entitlements (best-effort).
- [ ] Edge `capturePostHogEvent` + flush timeout; unit test denylist + cron profile flag.
- [ ] Identity: groups, persona, guest email omitted; environment + app_track register.
- [ ] Init: mask selectors; DEV behavior documented and tested.
- [ ] Cookies + Privacy + `docs/guides/routes/legal.md` rewrite.
- [ ] `ui/.env.example`, `supabase/.env.example`, `validation-and-env.md`,
      `integrations.md` §9.5 (fix the no-op / replay / flags claims).
- [ ] Operator: create two PostHog projects; fill Preview + Production + mt-dev secrets
      (human). Do not enable replay.

### Phase 1 — Errors

- [ ] Source map release = git SHA; confirm Preview/Production build env.
- [ ] Grep/script: every `serve(` catch reports exceptions.
- [ ] Optional `edge_request_failed` on 5xx from shared fetch wrappers.
- [ ] PostHog alert: exception spike.
- [ ] Tracing host list includes deployed functions hostname.

### Phase 2 — Guest conversion + stay

- [ ] Client events on calendar, form steps, abandon, listing view, stay guide, document,
      SD open.
- [ ] Edge: `guest_form_submitted` / `rejected` / `completion_submitted`, `sd_form_submitted`,
      `sd_voucher_claimed`, `submit-guest-review` if needed.
- [ ] Parking checkout + payment completed/failed (edge/webhook).
- [ ] First-party `/ingest` rewrite on kame-homes.
- [ ] PostHog funnel 1 + reject breakdown.

### Phase 3 — Host activation + booking ops

- [ ] Auth / onboarding / setup guide / org / property / parking create / invite accept.
- [ ] Move workflow events to orchestrator + cancel + reschedule + import/sync.
- [ ] Remove duplicate captures from `WorkflowPanel`.
- [ ] Keep `booking_updated` on admin edit; add shared props.
- [ ] Host activation insight.

### Phase 4 — Revenue + adoption + discovery

- [ ] Plan checkout cancelled/failed; upgrade modal events.
- [ ] Inbox, Meta connect, marketing fail, assistant turn, finance/maintenance/pricing/
      calendar-sync/team/settings/public-page/notification events (meaningful writes only).
- [ ] Search, for-hosts CTA, favorites, voucher view; contact ticket path.
- [ ] Super-admin high-signal actions only.
- [ ] Wire `pwaTelemetry` + `mediaTelemetry`.
- [ ] Remaining insights (checkout, inbox, PWA).

### Phase 5 — Cost, replay, closeout

- [ ] `analytics_mode` read (localStorage + public config when available).
- [ ] Masked, sampled replay on **nonprod** first; then ≤5% prod hosts.
- [ ] Vitest/Deno tests for helpers; catalog exhaustiveness test.
- [ ] Playwright: abort analytics ingest.
- [ ] Route-guide **Testing** rows for form / onboarding / plans / legal only (behavior
      change). `docs/PROJECT.md` observability paragraph.
- [ ] `.cursor/rules/supabase-edge-functions.mdc` + a short `docs/architecture` note:
      new mutating UX must add a catalog event or mark `posthog: N/A — <why>` (mirror
      activity-log discipline, but only for user-visible journeys).
- [ ] Flip intake "create the project / turn on recording" to done; Sentry stays deferred.

**Launch bar:** Phases 0–3 + insights 1–4 + 6. Phases 4–5 can follow in the same epic
without blocking first useful dashboards.

## Docs to update (same change as the matching phase)

| Doc                                                                                                | Why                                           |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `docs/architecture/integrations.md` §9.5                                                           | Accurate init, consent, groups, server events |
| `docs/architecture/validation-and-env.md`                                                          | New env vars; fix HOST default claim          |
| `docs/PROJECT.md`                                                                                  | Observability / env inventory                 |
| `docs/guides/routes/legal.md` + Cookies / Privacy pages                                            | Honest analytics disclosure                   |
| `docs/guides/routes/form.md`, `calendar.md`, `onboarding.md`, `org/setup-guide.md`, `org/plans.md` | Testing / behavior if events are mentioned    |
| `.cursor/rules/supabase-edge-functions.mdc`                                                        | Exception + product-event checklist           |
| `ui/.env.example`, `supabase/.env.example`, Vercel sync scripts                                    | Key list                                      |
| This plan → `/workflow-start` when implementation begins                                           | Lifecycle                                     |

## Open questions

None that block Phase 0–3. EU consent banner is a later add if we market there.
Legacy-prod instrumentation waits on the dual-track cutover decision in
`docs/workflow/in-progress/ci-cd-environments/`.
