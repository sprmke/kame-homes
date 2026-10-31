---
stage: done
title: 'Airbnb / OTA Two-Way Sync — availability + reservation ingestion + outbound feed'
status: done
tags: [planning, planned-modules, bookings, calendar, integrations, airbnb, ical]
updated: 2026-08-30
---

# Airbnb / OTA Two-Way Sync

**Goal:** a genuine two-way sync between GFM and Airbnb (and, on the same rails, Booking.com /
VRBO / any iCal channel):

- **Airbnb → GFM (ingestion):** pull reservation + availability data out of Airbnb into GFM so a
  new / cancelled / rescheduled Airbnb reservation shows up in GFM automatically — on the calendar,
  in Bookings, in Finance — without anyone re-keying it.
- **GFM → Airbnb (outbound):** publish GFM's own busy nights (direct bookings + owner blocks) back
  to Airbnb so a direct GFM booking blocks the corresponding Airbnb dates automatically.

> **Framed as "Airbnb sync", but channel-agnostic.** Airbnb is the first and default provider; the
> same engine serves every OTA that speaks iCal. Airbnb-specific behavior is called out inline.

---

## Build status (Phase 1 — updated 2026-08-30)

**Done — foundation batch (migrations + tested engine core):**

- `supabase/migrations/20261213120000_calendar_sync_feeds.sql` — `property_calendar_feeds` + `property_calendar_export`
- `…120100_calendar_sync_blocked_dates_source.sql` — `property_blocked_dates` `source`/`feed_id`/`external_uid`/`external_summary`/`last_seen_at` + `(feed_id, external_uid)` unique index; `unblock_property_blocked_dates` gains `p_source_filter text DEFAULT 'manual'` (2-arg callers unchanged)
- `…120200_calendar_sync_events.sql` — `calendar_sync_events` audit table
- `…120300_calendar_sync_plan_feature.sql` — `calendarSync` `PlanFeatureKey`, `true` on `growth`/`pro`/`managed`/`business_plus`
- `…120400_calendar_sync_notification_types.sql` — `calendar_sync_failing` + `calendar_conflict` added to `notifications_type_check`
- `…120500_calendar_sync_cron.sql` — self-invoking `sync_calendar_sync_cron_job()` → job `calendar-sync-every-30m` (`*/30 * * * *`), optional `X-Calendar-Sync-Cron-Secret` (Vault `calendar_sync_cron_secret`)
- `supabase/functions/_shared/calendarSyncService.ts` — pure engine: RFC-5545 unfold + parse, provider `SUMMARY` classifier (airbnb/booking_com/vrbo/other), Manila-floor date parsing, `diffFeed` (create/reschedule/touch/remove), `buildExportCalendar` (fold-at-75, PII-free, sorted), SSRF-guarded `fetchExternalIcs` (https-only, private-IP literal + resolved rejection, per-hop redirect re-validation, timeout, 2 MB cap, provider host allowlist), `hashFeedBody`, date helpers
- `supabase/functions/_shared/calendarSyncService_test.ts` — 18 Deno tests (parse/classify/diff/overlap/export/SSRF). **Not run — `deno` is not installed on this machine and CI has no Deno step; tests are written correct-by-construction, run with `deno test --allow-net --allow-env`.**

**Done — `calendarSync` plan wiring (cards + comparison table):**

- `supabase/functions/_shared/planFeatures.ts` — `calendarSync: boolean` in `PlanFeatures` type + `DEFAULT_PLAN_FEATURES` + `parsePlanFeatures`
- `ui/src/features/dashboard/plans/lib/planFeatures.ts` — mirror (type + default + `PLAN_FEATURE_LABELS: 'Airbnb & OTA calendar sync'`)
- `ui/src/features/dashboard/plans/lib/planPresentation.ts` — `PLAN_FEATURE_ROWS` gets `boolRow('calendarSync', …, 'pricing')` (drives the **Compare matrix** row under the Pricing section) + `PLAN_TIER_CARD_GAINS.growth` gets the **Pro plan-card bullet**
- `ui/src/features/dashboard/plans/lib/featureGateCopy.ts` — upgrade-modal copy ("available on Pro and above")
- `ui/.../super-admin-pricing/EditPricingPlanDialog.tsx` — `BOOLEAN_FEATURE_KEYS` gets `calendarSync` (super-admin per-plan toggle on `/admin/pricing/plans`)
- Docs: `plans-feature-matrix.md` (new `calendarSync` section), `org/plans.md` (Pro highlights), `for-hosts.md` (keep-in-sync list)
- `bun run type-check` ✅ · `bun run lint` ✅ (0 errors)

**Done — permission leaf (Q4):**

- `_shared/propertyTeamPermissions.ts` — `TEAM_PERMISSION_IDS` gains `pricing.channels:view` / `pricing.channels:edit`
- `_shared/propertyTeamTemplates.ts` — `SEEDED_TEMPLATE_PERMISSIONS.OPERATIONS` gets both, `.READ_ONLY` gets `:view`
- `ui/.../team/lib/propertyTeamConstants.ts` — `TEAM_PERMISSIONS` catalog entries ("View / Manage channel sync", `Pricing` category) + seeded templates mirror
- `ui/.../team/lib/propertyPermissionCatalog.ts` — `pricing.channels` group node, chip labels, `sectionParent`, `COARSE_PLAN_FEATURES` → `calendarSync`

**Done — edge functions + run engine:**

- `supabase/functions/_shared/calendarSyncRun.ts` — DB-orchestration wrapper: `runFeedSync` (claim → decrypt URL → `fetchExternalIcs` → 304 / feed-hash short-circuit → parse → empty-feed guard → `diffFeed` → apply block create/reschedule/touch/remove → `markFeedSuccess`), `runConflictPass`, `loadDueCalendarFeeds`, `loadExportRanges`, failing-feed + conflict notification emit (dedupe keyed), `CALENDAR_SYNC_FAILING_THRESHOLD = 4`
- `supabase/functions/ical-export/index.ts` — `servePublic` GET `?property=<slug>&token=<t>[&as=<provider>]`; constant-time token compare, weak ETag + 304, identical 404 on every failure, `Cache-Control: public, max-age=900`
- `supabase/functions/calendar-sync-cron/index.ts` — global sweep (`CALENDAR_SYNC_CRON_SECRET` gate, `loadDueCalendarFeeds(100)`, 55 s budget, per-property `calendarSync` entitlement check) + scoped `{feedId}`/`{propertyId}` "Sync now" (`resolveScopedPropertyAccess('pricing.channels:edit')` + `requirePropertyFeature('calendarSync')`)
- `supabase/functions/calendar-sync-settings/index.ts` — `serveAuthenticated`; GET (`pricing.channels:view`) returns shaped feeds (masked URL + health), export URLs, recent events; PATCH (`pricing.channels:edit` + `requirePropertyFeature`) actions `addFeed`/`updateFeed`/`removeFeed`/`setExportEnabled`/`syncNow`
- `supabase/config.toml` — `[functions.ical-export]` / `[functions.calendar-sync-cron]` / `[functions.calendar-sync-settings]` (+ Phase 2 `get-form-completion` / `submit-form-completion` / `issue-guest-form-completion-token`), all `verify_jwt = false`

**Done — notification wiring:**

- `_shared/notificationService.ts` — `NotificationType` gains `calendar_sync_failing` / `calendar_conflict`; emitted from `calendarSyncRun.ts` (dedupe `feed:<propertyId>:<label>:failing` at exactly threshold 4; `conflict:<uid>:<partnerId>`)
- `ui/.../notifications/lib/notificationsApi.ts` + `notificationsDisplay.ts` — union mirror + `NOTIFICATION_ICONS` (`CalendarX` / `AlertTriangle`)

**Done — pricing UI:**

- `ui/.../pricing/lib/calendarSyncApi.ts` + `pricing/hooks/useCalendarSync.ts` — typed client + TanStack Query hooks (settings query, add/update/remove feed, rotate token, set export enabled, sync-now with result toast)
- `ui/.../pricing/components/ChannelSyncCard.tsx` — connected-calendars list (health badge, relative last-success, "Sync now"), add-feed form, export section (enable switch, per-provider read-only URL + copy, rotate), recent-activity list, remove-confirm dialog with "also delete synced dates" choice; `useFeatureGate('calendarSync')` locked-state fallback → `openUpgradeModal('calendarSync')`
- Wired into `PropertyPricingPage.tsx` (below the calendar/rates grid)
- `_shared/propertyBlockedDates.ts#loadBlockedDateKeys` + `_shared/propertyPricing.ts` — `PropertyPricingDto.importedBlockedDateKeys` (server, `source='ical_import'` subset); client DTO mirror in `pricing/lib/propertyPricingApi.ts`
- `PricingCalendarGrid.tsx` — `PricingDayState.isImported`; OTA-synced nights render with a dashed muted cell + `RefreshCw` marker + "Synced from Airbnb / OTA" tooltip/legend, and are **not selectable / not unblockable** from the grid (`PropertyPricingPage` selection guards + `isInteractive`); `ParkingPricingPage` passes `isImported: false`
- `bun run type-check` ✅ (only pre-existing unrelated `stayGuideChapters.ts` errors from a separate in-progress refactor) · pricing/calendar-sync files `eslint` clean

**Phase 1 — complete.** Docs synced (`PROJECT.md`, `data-model.md`, `edge-functions.md`, `validation-and-env.md`, `booking-workflow.mdc`, `scheduled-jobs-and-testing.md`, `migration-runbook.md` §11b, `pricing.md` route guide). `bun run type-check` clean for all calendar-sync files; migrations still need `bun run db:migrate` against a running local stack.

---

## Build status (Phase 2 — 2026-08-30)

**Done — migrations:**

- `20261214120000_calendar_sync_external_bookings.sql` — `guest_submissions` `external_source` / `external_uid` / `external_feed_id` (FK SET NULL) / `external_raw` + unique partial index `(external_feed_id, external_uid)` + feed index
- `20261214120100_calendar_sync_guest_form_token.sql` — `guest_form_token` (unique partial index) / `guest_form_token_issued_at` / `guest_form_completed_at`
- `20261214120200_calendar_sync_phase2_notification_types.sql` — `notifications_type_check` gains `booking_external_imported` + `booking_guest_form_completed`

**Done — reservation ingestion (`create_bookings`):**

- `_shared/calendarSyncService.ts` parse call now passes `feed.create_bookings` so `classifyEventKind` promotes reservation VEVENTs
- `_shared/calendarSyncRun.ts` — `reconcileExternalBookings()` after the block pass: creates `guest_submissions` rows (`status='PENDING_REVIEW'`, `booking_source='Airbnb'`, `external_*`, `primary_guest_name` = `Airbnb <confirmationCode>` \| `Airbnb guest ··<last4>` \| `Airbnb guest`, `guest_email=NULL`, DP/SD 0), guarded reschedule (revert to `PENDING_REVIEW`, skipped after review), cancel via `WorkflowOrchestrator.transition(id,'CANCELLED')` with the `past_checkin_feed_drop` guard. `calendar_sync_events` `booking_created` / `booking_rescheduled` / `booking_cancelled` / `skipped`; `RunFeedResult` gains `bookingsCreated/Updated/Cancelled`. Emits `booking_external_imported` (dedupe `booking:<id>:external_imported`).

**Done — no-guest-side-effect guard:**

- `_shared/workflowOrchestrator.ts` — `suppressGuestSideEffects = !guest_email.trim()`; skips booking acknowledgement, stay-guide token, ready-for-check-in email, SD-refund-form email; `TransitionResult.sideEffects.externalSuppressed`
- `sd-refund-cron/index.ts` — `noGuestContact` folds into `suppressStaleEmail` (direct `sendSdRefundFormRequest` path)

**Done — guest-form completion link (§6.5):**

- `_shared/guestFormCompletion.ts` — token mint/rotate, resolve (404/410), `checkCompletionEligibility`, `markGuestFormCompleted`, `guestFormCompletionPath` (`<origin>/form?complete=<token>&property=<slug>`)
- `issue-guest-form-completion-token` (serveAuthenticated, `bookings.detail.workflow:edit`), `get-form-completion` (servePublic), `submit-form-completion` (hand-rolled `serve`, UPDATE-only, stored dates win, `checkOverlappingBookings(..., { skipOwnerBlockCheck: true })`, emits `booking_guest_form_completed`)
- `_shared/databaseService.ts#checkOverlappingBookings` — optional `{ skipOwnerBlockCheck }` 5th arg
- Guest form `ui/.../guest/form/components/GuestForm.tsx` — `?complete=<token>` mode: fetches `get-form-completion`, locks the Stay step's dates behind a read-only banner, treats the booking as Airbnb (no Payment step), submits to `submit-form-completion`; "Link unavailable" / "expired" states
- Host UI — `useBookingGuestFormCompletionLink` + `useIssueGuestFormCompletionToken`; "Copy guest form link" row in the booking-detail action menu for OTA-sourced `PENDING_REVIEW` bookings; `BookingRow` type gains `external_*` + `guest_form_*`
- Notification mirrors — `notificationService.ts` + `notificationsApi.ts` unions + `notificationsDisplay.ts` `NOTIFICATION_ICONS` (`RefreshCw` / `ClipboardCheck`)

**Done — docs:** `data-model.md`, `edge-functions.md`, `PROJECT.md`, `migration-runbook.md` §11b Phase 2 batch, `booking-workflow.mdc`, `form.md` + `pricing.md` route guides.

**Verified 2026-08-30 — full test pass, all green:**

_CI gates_ — `bun run type-check` · `bun run lint` · `bun run check:filenames` · **`bun run build`** all pass, 0 errors. (`stay-guide/lib/api.ts` re-exports the v1 `StayGuideChapterConfig` / `StayGuideSectionConfig` aliases the in-flight v2 refactor removed while `stayGuideChapters.ts` still consumes them — additive.)

_Automated tests_ — **32/32 Deno tests pass**:

- `calendarSyncService_test.ts` (16) — unfold, RFC-5545 date parse, provider classifier, `diffFeed` (create/reschedule/touch/remove), `dateRangesOverlap` half-open, `buildExportCalendar` (sorted / PII-free / fold-75), `hashFeedBody`, `fetchExternalIcs` SSRF guard (non-https + private-IP rejected)
- `guestFormCompletion_test.ts` (7) — `guestFormCompletionPath`, `isCompletionLinkLive` (future ok / past / cancelled / no-date), `checkCompletionEligibility` (happy, legacy `booking_source='Airbnb'`, non-OTA → `not_external`, advanced → `wrong_status`, stay over / cancelled → `link_expired`)
- `calendarSyncRun_integration_test.ts` (9) — real local Postgres via a stubbed ICS fetcher (`runFeedSync({ fetchIcs })` seam):
  - block-only feed: create / in-place reschedule / remove; feed health (`consecutive_failures`, `last_success_at`, `last_feed_hash`)
  - reservation ingestion: `Reserved` VEVENT → `PENDING_REVIEW` `guest_submissions` row (`booking_source='Airbnb'`, `external_source/uid`, `guest_email=NULL`, `MM-DD-YYYY` dates, `number_of_nights`, `Airbnb <HMcode>` name) + `ical_import` block + `booking_created` event + `booking_external_imported` notification; `Airbnb (Not available)` VEVENT → block only
  - reschedule while `PENDING_REVIEW` → guarded UPDATE reverts to `PENDING_REVIEW`; reschedule after review → guarded UPDATE = 0 rows, dates unchanged, logs `reschedule_after_review`
  - cancellation: UID gone + `PENDING_REVIEW` → `transition(CANCELLED)` with side-effects suppressed (orchestrator log confirmed); UID gone + `READY_FOR_CHECKIN` → NOT cancelled, logs `past_checkin_feed_drop`
  - 304 / byte-identical body → no-op; HTTP error → `consecutive_failures++`, blocks untouched; single empty pull → `skipped`, blocks kept, `empty_pull_streak=1`
  - `calendar_sync_failing` fires exactly once at the 4th consecutive failure (dedupe, not re-fired on the 5th)
  - conflict pass: import overlapping a manual block is still applied + `conflict_detected`

_Live HTTP_ (`supabase functions serve` + local stack):

- `ical-export`: valid token → 200 `text/calendar` + `Cache-Control: public, max-age=900` + weak ETag + well-formed VCALENDAR; `If-None-Match` → **304**; `?as=airbnb` → 200; wrong token / `is_enabled=false` → identical **404 "Not found"**
- `calendar-sync-cron` global sweep → 200 `{success:true,…}`
- `get-form-completion`: valid → 200 (locked stay + prefill); CANCELLED booking → **410**; past-checkout → **410**; bad token → **404**
- `submit-form-completion`: **happy path → 200** and every invariant holds — status stays `PENDING_REVIEW`, **tampered payload dates (2099) ignored** (stored `10-09..10-12 / 3 nights` kept), `guest_email`/name/phone/nationality/valid-ID written, `booking_source='Airbnb'` + `external_*` preserved, `guest_form_completed_at` stamped, `booking_guest_form_completed` notification emitted; advanced booking → **409**; CANCELLED mid-flight → **410**; missing valid-ID file → 400 (same as normal `/form`)
- `issue-guest-form-completion-token` no admin JWT → **401**

_Migrations_ — all 10 applied to a real local Postgres (`bun run db:migrate`), no SQL errors; schema verified by direct query (columns, indexes, `guest_email` nullable, `notifications_type_check` = 12 types, `unblock_property_blocked_dates` 3-arg).

_Regression_ — `submit-form` (normal booking) still rejects owner-blocked dates → **400 `DATES_BLOCKED`** (the `checkOverlappingBookings` 5th `skipOwnerBlockCheck` param defaults off).

**Remaining:** a browser walk-through with a live public-HTTPS Airbnb `.ics` (the SSRF guard blocks local fixtures — this is staging QA). Every layer is independently verified above.

---

## 1. TL;DR — is a true two-way sync possible?

**Yes for availability + reservation records today; guest PII and messaging need a partnership.**
Three tiers, only the first needs zero commercial relationship with Airbnb:

| Tier                                                                    | Mechanism                                                                                    | Airbnb → GFM pulls                                                                                                                                                                   | GFM → Airbnb pushes                                                   | Latency                                                                      | Needs                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **1. iCal two-way** (this plan)                                         | We poll Airbnb's "Export calendar" `.ics`; we serve an "Import calendar" `.ics` Airbnb polls | Busy/free nights; **reservation date ranges** + stable reservation id + (Airbnb only) last-4 phone & reservation URL from `DESCRIPTION`. No guest name/email, no price, no messages. | Our busy nights (bookings + blocks) as opaque "Booked/Blocked" events | Airbnb→us: our poll (30–60 min). us→Airbnb: Airbnb re-reads every **~2–4 h** | Nothing — host pastes two URLs                                                                              |
| **2. Airbnb official API**                                              | Airbnb Partner API                                                                           | Everything real-time: full guest details, messages, price, payout, real cancellation events                                                                                          | Rates, availability, listing content                                  | Seconds                                                                      | Approved **Airbnb Software Partner** — listing minimums, security review, certification, ongoing compliance |
| **3. Channel manager middleman** (Hostaway / Beds24 / Smoobu / Lodgify) | Their REST API + webhooks; they hold the Airbnb certification                                | Reservations + guest contact details + (some) messaging, across Airbnb **and** Booking.com / VRBO                                                                                    | Rates + availability + content                                        | Seconds–minutes                                                              | A paid channel-manager account per host, or a platform partner account                                      |

**Recommendation:** build **Tier 1 now** (Phases 1–2 below) — it satisfies the literal request
("new / cancelled / rescheduled … always synced") for dates and reservation records, needs no
approval, and is what every small PMS ships first. Build the ingestion path behind a **provider
adapter interface** so a Tier 3 connector (real guest data, real-time) drops in later as one more
adapter feeding the same tables, with no schema churn. Tier 2 is a business/legal decision — see
[§18](#18-non-goals--future).

### The irreducible limits of Tier 1 — surfaced in the UI, never hidden

1. **iCal carries no guest PII, price, or messages.** Airbnb's export feed gives dates + a
   reservation id + (for Airbnb) the guest's phone last-4 and the reservation URL. That is the
   ceiling. GFM reservation rows created from it have `guest_email = NULL` and a placeholder name;
   the host fills in the rest from the Airbnb app if they want the full GFM workflow (GAF, etc.).
2. **Double-booking window.** Between a direct GFM booking and Airbnb next re-reading our export
   (~2–4 h), a guest can book the same night on Airbnb (and vice-versa). The engine **detects and
   flags every overlap**; it never silently drops or overwrites either side.
3. **Silent cancellation.** Airbnb sends no cancellation event — the `VEVENT` just disappears from
   the next pull. Detected by **snapshot diff** ([§7](#7-sync-engine-algorithm)), with truncation
   guards so a broken feed is never mistaken for "everything cancelled".

Hosts with high-velocity listings are told (help text + docs) that Tier 3 is the upgrade path.

---

## 2. What we implement now vs. defer

The engine core is decision-independent and safe to build immediately. The schema shape, the
public endpoint contract, and the plan gate depend on the [finalization questions](#17-finalization-questions--answer-before-phase-1)
below — **hold those until answered** so we don't migrate twice.

| Buildable now (no decision needed)                                                                                                                                                                                                                                                        | Blocked on a finalization answer                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `_shared/calendarSyncService.ts` pure logic: RFC-5545 unfold + parse, provider `SUMMARY` classifier (Airbnb/Booking.com/VRBO adapters), ICS **generation**, UID set-diff (create/update/reschedule/remove), truncation guards, conflict detection via `availabilityService.rangesOverlap` | Q1 ingestion depth (availability-only vs reservation rows vs channel-manager) → whether migration 4.5 + Phase 2 code ship in this batch |
| SSRF-guarded fetch client (`fetchExternalIcs`) + its Deno tests                                                                                                                                                                                                                           | Q2 export URL granularity → `ical-export` querystring contract + `property_calendar_export` columns                                     |
| Deno test suite with real `.ics` fixtures (Airbnb / Booking.com / VRBO exports) under `supabase/functions/_shared/__fixtures__/calendar/`                                                                                                                                                 | Q3 plan tier → the `pricing_plans` seed migration                                                                                       |
| `calendar_sync_events` + `property_calendar_feeds` + `property_calendar_export` migrations **if** Q2/Q3 are answered (they touch these tables' columns)                                                                                                                                   | Q4 permission leaf → `calendar-sync-settings` access check + `propertyTeamPermissions.ts`                                               |
| `property_blocked_dates` `source`/`feed_id`/`external_uid` ALTER (4.3) — shape is decision-independent; safe to land early                                                                                                                                                                | Q5 Phase 2 `create_bookings` default, Q6 imported-row naming, Q7 Booking.com ambiguity — Phase 2 behavior only                          |

**Proposed order once questions are answered:** 4.3 ALTER + `calendarSyncService` + tests →
4.1/4.2/4.4 migrations → `ical-export` → `calendar-sync-cron` + cron migration →
`calendar-sync-settings` → `ChannelSyncCard` UI → (Phase 2) 4.5 + orchestrator path.

---

## 3. How this maps onto the existing codebase

Everything needed has a precedent here — this is mostly assembly.

| Need                                                        | Existing pattern to mirror                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-property external feed config + encrypted secret        | `telegram_*_settings.bot_token_encrypted` + `_shared/propertySecretCrypto.ts` (`GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`, AES-256-GCM)                                                                                                                                                                                                           |
| Owner-managed unavailable nights                            | `property_blocked_dates` (`[start_date, end_date)` checkout-exclusive; `unblock_property_blocked_dates` RPC for partial removal)                                                                                                                                                                                                          |
| Availability / overlap math                                 | `_shared/availabilityService.ts` (`rangesOverlap`, half-open), `_shared/propertyBlockedDates.ts`, `get-booked-dates`                                                                                                                                                                                                                      |
| Booking lifecycle + side effects                            | `_shared/statusMachine.ts` + `_shared/workflowOrchestrator.ts` (single side-effect choke point). `booking_source === 'Airbnb'` is **already** a first-class branch: skips the guest payment step, DP/SD default ₱0, skips the SD-refund stage, `sd-refund-cron` suppresses the check-out email — see `.cursor/rules/booking-workflow.mdc` |
| Scheduled sweep + "run now" button                          | `sd-refund-cron` (global `POST {}` via cron; scoped `POST {bookingId}` + admin JWT), `telegram-marketing-cron`, `serveCronPost`, the self-invoking `sync_*_cron_job()` migration (`20261201120200_parking_reminder_cron.sql`)                                                                                                             |
| Integration health surfaced to the host                     | Meta inbox: `social_channel_connections` health columns (`webhook_last_verified_at`, `webhook_verify_attempts`, `status`, `error_message`) + `meta-inbox-webhook-healthcheck` cron + "Fix connection" after ≥3 fails; `_shared/propertyIntegrationStatus.ts`                                                                              |
| Manual admin trigger from a page                            | `useRunGmailPoll` / `useRunSdRefundCron` hooks + WorkflowPanel buttons                                                                                                                                                                                                                                                                    |
| Plan-gating a new capability                                | `_shared/planEntitlements.ts` (`requirePropertyFeature`, `catchPlanFeatureError`, `resolvePropertyEntitlements`), a new `PlanFeatureKey` seeded by migration, `useFeatureGate` client-side                                                                                                                                                |
| Notification event                                          | `_shared/notificationService.ts#createNotification` — **type CHECK widened by migration**                                                                                                                                                                                                                                                 |
| Imported historical rows that must not email or block oddly | `IMPORTED` status + `imported_from_batch_id` (`get-booked-dates` treats `IMPORTED` like `CANCELLED` for blocking)                                                                                                                                                                                                                         |

**No existing iCal / channel-manager code** (`grep` for `ical` / `VEVENT` / `channel manager` is
clean). The `inbox` `SocialPlatform` union has a dormant unused `'airbnb'` literal — unrelated.

---

## 4. Scope

### In scope

- **Ingestion (Airbnb → GFM):** poll ≥1 external `.ics` per property; reflect busy nights as GFM
  availability so `get-booked-dates`, `submit-form` server-side rejection, and public search all
  respect OTA-held dates. **Phase 2:** promote reservation events to real `guest_submissions` rows
  (dates only, `booking_source='Airbnb'`, **held in `PENDING_REVIEW`**), so the dates are blocked
  everywhere the instant the row exists.
- **Guest-form completion link (§6.5):** host copies a per-booking link and forwards it to the
  Airbnb guest, who completes the normal GFM guest form against that row with the **dates
  pre-filled and locked** (server-enforced, not just UI).
- **Outbound (GFM → Airbnb):** per-property, token-guarded, read-only `text/calendar` feed of
  GFM's own busy nights (direct bookings + owner blocks), loop-safe (a provider's feed excludes
  events that originated from that provider).
- **Change classes handled both directions:** new reservation, cancellation, reschedule,
  extension/shortening, block add/remove.
- **Multi-OTA:** Airbnb + Booking.com + VRBO + "Other (iCal URL)" providers on one engine.
- **Observability:** per-run log, per-event audit trail, health status, "last synced", manual
  "Sync now", conflict surfacing.

### Out of scope (this plan)

- Guest name / email / full phone / messages / price / payout ingestion — iCal cannot carry it
  (Tier 2/3 only).
- Pushing nightly **rates** to Airbnb (Tier 2/3 only).
- Real-time webhooks (iCal is poll-only).
- Parking (`parking_id`) listings — property-only for v1; a `parking_calendar_feeds` sibling later.
- Automatic double-booking resolution — we flag, a human decides.

---

## 5. Data model (migrations)

Additive only; no shipped migration edited (a hook blocks that).

### 5.1 `property_calendar_feeds` — external import feeds (NEW)

```sql
CREATE TABLE public.property_calendar_feeds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider              text NOT NULL CHECK (provider IN ('airbnb','booking_com','vrbo','other')),
  label                 text,                       -- host-facing, e.g. "Airbnb – Monaco 2604"
  ics_url_encrypted     text NOT NULL,              -- AES-256-GCM (URL embeds a secret token)
  is_active             boolean NOT NULL DEFAULT true,
  create_bookings       boolean NOT NULL DEFAULT false,  -- Phase 2 opt-in; Phase 1 forces false
  last_attempted_at     timestamptz,
  last_success_at       timestamptz,
  last_error            text,
  consecutive_failures  integer NOT NULL DEFAULT 0,
  empty_pull_streak     integer NOT NULL DEFAULT 0,  -- truncation guard (see §7 step 6)
  last_etag             text,
  last_modified_header  text,
  last_feed_hash        text,                        -- sha-256 of normalized body; skip diff when unchanged
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_calendar_feeds_property_idx ON public.property_calendar_feeds(property_id) WHERE is_active;
ALTER TABLE public.property_calendar_feeds ENABLE ROW LEVEL SECURITY;  -- no policies: service-role edge fns only
```

### 5.2 `property_calendar_export` — outbound feed token (NEW)

One row per property, lazily created on first read (mirrors `custom_pages` lazy-create).

```sql
CREATE TABLE public.property_calendar_export (
  property_id    uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  token          text NOT NULL,                -- 32B CSPRNG base64url, rotatable
  is_enabled     boolean NOT NULL DEFAULT true,
  rotated_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_served_at timestamptz                   -- "Airbnb last fetched your feed …"
);
ALTER TABLE public.property_calendar_export ENABLE ROW LEVEL SECURITY;
```

Rejected alternative: token on `app_settings` (per-property settings table) — separate table
keeps rotation/audit clean and avoids widening a hot row.

### 5.3 `property_blocked_dates` — mark OTA-synced blocks (ALTER — decision-independent, land early)

```sql
ALTER TABLE public.property_blocked_dates
  ADD COLUMN IF NOT EXISTS source            text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','ical_import')),
  ADD COLUMN IF NOT EXISTS feed_id           uuid REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS external_uid      text,
  ADD COLUMN IF NOT EXISTS external_summary  text,
  ADD COLUMN IF NOT EXISTS last_seen_at      timestamptz;
CREATE UNIQUE INDEX property_blocked_dates_feed_uid_key
  ON public.property_blocked_dates(feed_id, external_uid) WHERE feed_id IS NOT NULL;
```

- `source='manual'` default keeps every existing row and write path correct with no code change.
  `pricing.blocks:add` / `pricing.blocks:delete` still only touch `manual` rows; the UI **disables
  delete** on `ical_import` rows (they round-trip — deleting locally just recreates next sync).
- `unblock_property_blocked_dates` RPC gains `p_source_filter` (default `'manual'`) so partial
  unblocks never shatter an imported range. The engine deletes imported ranges directly by
  `(feed_id, external_uid)`.

### 5.4 `calendar_sync_events` — per-event audit trail (NEW)

```sql
CREATE TABLE public.calendar_sync_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_id         uuid NOT NULL REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  run_id          uuid NOT NULL,
  external_uid    text,
  action          text NOT NULL CHECK (action IN
                    ('block_created','block_updated','block_removed',
                     'booking_created','booking_cancelled','booking_rescheduled',
                     'conflict_detected','skipped','error')),
  start_date      date,
  end_date        date,
  summary         text,
  blocked_date_id uuid REFERENCES public.property_blocked_dates(id) ON DELETE SET NULL,
  booking_id      uuid REFERENCES public.guest_submissions(id) ON DELETE SET NULL,
  detail          jsonb,                        -- diff, conflict partner id, parse warning, raw VEVENT on error
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_sync_events_feed_created_idx ON public.calendar_sync_events(feed_id, created_at DESC);
ALTER TABLE public.calendar_sync_events ENABLE ROW LEVEL SECURITY;
```

Retention: a follow-on cron prunes >90 days (noted, not scheduled now).

### 5.5 `guest_submissions` — external-reservation provenance (ALTER — Phase 2 only)

```sql
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS external_source   text CHECK (external_source IN ('airbnb','booking_com','vrbo','other')),
  ADD COLUMN IF NOT EXISTS external_uid      text,
  ADD COLUMN IF NOT EXISTS external_feed_id  uuid REFERENCES public.property_calendar_feeds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_raw      jsonb;
CREATE UNIQUE INDEX guest_submissions_external_feed_uid_key
  ON public.guest_submissions(external_feed_id, external_uid) WHERE external_feed_id IS NOT NULL;
```

`booking_source` stays the display/behavior switch (`'Airbnb'`); `external_source` + `external_uid`
are the sync identity. Reuse the existing `booking_source='Airbnb'` branches, don't duplicate.

### 5.6 `guest_submissions` — guest-form completion token (ALTER — Phase 2, §6.5)

```sql
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS guest_form_token             text,
  ADD COLUMN IF NOT EXISTS guest_form_token_issued_at   timestamptz,
  ADD COLUMN IF NOT EXISTS guest_form_completed_at      timestamptz;  -- set when the guest submits via the link
CREATE UNIQUE INDEX guest_submissions_guest_form_token_key
  ON public.guest_submissions(guest_form_token) WHERE guest_form_token IS NOT NULL;
```

Mirrors `stay_guide_token` / `document_share_token`. No expiry column — the link 410s once
`check_out_date` is in the past (or the row is `CANCELLED`).

### 5.7 New `PlanFeatureKey`: `calendarSync`

Seed into `pricing_plans` via migration (pattern: `20261106130000_pricing_plan_new_feature_keys.sql`).
**Proposed: Pro (`growth`) +**, peer to `bookingImport` / `publicPagesAutosave`. Confirm in
[Q3](#17-finalization-questions--answer-before-phase-1). Client copy in `featureGateCopy.ts`.

---

## 6. The ingestion direction in depth (Airbnb → GFM)

The request specifically calls out "seeking data from Airbnb to our application" — this section is
the detailed contract for that direction.

### 6.1 What data is actually available from Airbnb's `.ics`

A reservation `VEVENT` in Airbnb's host export:

```
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260112
DTEND;VALUE=DATE:20260115
UID:1a2b3c4d5e@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCDE123\n
 Phone Number (Last 4 Digits): 6789
END:VEVENT
```

| Field                                                                                           | Present?                                  | We use it as                                                                                                                       | We do **not** do                                       |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `DTSTART` / `DTEND`                                                                             | always                                    | check-in / check-out (DTEND exclusive = GFM model)                                                                                 | —                                                      |
| `UID`                                                                                           | always, **stable across date edits**      | the reservation identity across polls; `external_uid`                                                                              | —                                                      |
| `SUMMARY`                                                                                       | always                                    | classifier input: `Reserved` → reservation, `Airbnb (Not available)` / `Blocked` / `Not available` → owner-block                   | —                                                      |
| `DESCRIPTION` → reservation URL                                                                 | reservations only                         | stored in `external_raw`; shown to `pricing.channels:edit` holders as a "Open in Airbnb" link                                      | not parsed for logic                                   |
| `DESCRIPTION` → phone last-4                                                                    | reservations only, when guest has a phone | optional suffix on the placeholder name (`Airbnb guest ··6789`) if [Q6](#17-finalization-questions--answer-before-phase-1) says so | never stored in a phone field, never used to contact   |
| guest name / email / full phone / price / payout / message thread / guest count / review status | **absent**                                | —                                                                                                                                  | cannot be inferred; host adds manually or we go Tier 3 |

Airbnb "blocked" (host-blocked or unavailable-gap) events have **no `DESCRIPTION`** and a
non-`Reserved` `SUMMARY`. They are always imported as `property_blocked_dates` rows, never
promoted to `guest_submissions`, even in Phase 2.

### 6.2 Phase 1 ingestion — availability only

Every parseable `VEVENT` (reservation or block) becomes one `property_calendar_feeds`-linked
`property_blocked_dates` row (`source='ical_import'`). That alone makes OTA-held nights
unbookable in `submit-form`, invisible in public search, and visible (styled distinctly) on the
Pricing calendar. `create_bookings` is forced `false` in Phase 1.

### 6.3 Phase 2 ingestion — reservation records

When `feed.create_bookings = true` **and** the classifier returns `kind='reservation'`, in
addition to the block row, create a `guest_submissions` row through a dedicated
`DatabaseService.createExternalBooking()` → `WorkflowOrchestrator` seam:

- `property_id`, `booking_source='Airbnb'` (provider display name), `external_source` /
  `external_uid` / `external_feed_id` / `external_raw`,
- `check_in_date` / `check_out_date` normalized to `MM-DD-YYYY` (dominant stored format),
  `check_in_time` / `check_out_time` = property defaults, `number_of_nights` computed,
- `primary_guest_name` per [Q6](#17-finalization-questions--answer-before-phase-1)
  (`'Airbnb guest'` ± last-4), `guest_email = NULL`, `number_of_adults = 1` placeholder,
- `status = 'PENDING_REVIEW'`, `imported_from_batch_id = NULL`.

**The row stays in `PENDING_REVIEW` and never auto-advances.** The sync engine only ever
_creates_ it in `PENDING_REVIEW`, _reschedules_ it (back to `PENDING_REVIEW`), or _cancels_ it.
It never calls a forward transition. Advancing past review is always a deliberate admin action in
the WorkflowPanel — an ingested stub with no guest details should not flow through GAF / pet /
ready-for-check-in automatically. The guest-form completion link (§6.5) also leaves the status
untouched — it only enriches the row's fields.

**No guest-facing side effects, ever.** A single guard in `workflowOrchestrator` (+ `sd-refund-cron`,

- `submit-form`'s notification path): when `external_source IS NOT NULL` or `guest_email` is blank,
  skip every guest email / stay-guide token / SD-form send and record `skipped_external` in
  `sideEffects`. The `booking_source='Airbnb'` branch already zeroes payment/DP/SD and skips the
  SD-refund stage — verify each tolerates a null `guest_email` (mostly already true for zero-balance
  Airbnb bookings; audit `sendReadyForCheckin`, `ensureGuestStayGuideToken`, `sendBookingAcknowledgement`).

**Reschedule** (same `UID`, new dates) → orchestrator date edit; the existing rule reverts a
workflow-sensitive change to `PENDING_REVIEW` and clears downstream state. Log `booking_rescheduled`.

**Cancellation** (`UID` gone from a healthy feed) → `WorkflowOrchestrator.transition(id,'CANCELLED')`
— **unless** the booking is already past `READY_FOR_CHECKIN` / past checkout date, in which case a
feed-drop is stale, not a cancel: log `skipped` (`detail.reason='past_checkin_feed_drop'`), notify,
do not cancel. Airbnb drops completed reservations from the feed after checkout — without this
guard every past stay flips to `CANCELLED` a day later.

**Manual promotion:** even with `create_bookings=false`, a "Convert to booking" action on an
imported calendar range lets a host pull one OTA-held stay into the real workflow on demand.

**Downgrade safety:** losing the `calendarSync` entitlement stops the cron for that property but
**never deletes** existing imported blocks/bookings/config — matches the plan matrix's
"view past output, don't generate new" rule.

### 6.4 Beyond iCal — what a Tier 3 adapter would add to ingestion (future)

Same `fetch → normalize → diff → apply` interface, `provider='hostaway'`/`'beds24'`, over REST +
webhooks instead of `.ics` polling. It would fill in `guest_email`, full phone, guest count,
price, and deliver real cancellation/alteration webhooks (no snapshot-diff needed) and Airbnb
message threads (into the Guest Inbox, reusing the dormant `'airbnb'` `SocialPlatform`). Separate
plan; the tables above are already shaped for it (`external_raw` JSONB, provider enum extensible).

### 6.5 Guest-form completion link for an ingested booking (host → Airbnb guest)

An ingested row has dates but no guest details. Let the host **copy a link and forward it to the
Airbnb guest** (via the Airbnb message thread) so the guest completes the normal GFM guest form
against **that existing booking** — dates pre-filled and **locked**.

**Token.** Add `guest_form_token` (`text`, unique partial index) to `guest_submissions` — same
mechanism as `stay_guide_token` / `document_share_token`. Issued on demand by a new
`issue-guest-form-completion-token` edge function (authenticated, `bookings.detail.*` permission),
returned as `<app-origin>/form?complete=<token>`. Nullable; one active token per booking;
re-issue rotates. Optional `guest_form_token_expires_at` (default none — a stay is completable any
time before check-out; after check-out the link 410s).

**Public resolve.** The guest form (`ui/src/features/guest/form/`) gains a `?complete=<token>`
mode:

- New public edge fn **`get-form-completion`** (`servePublic`) resolves the token → returns the
  property, the **locked** `check_in_date` / `check_out_date` / times, and any already-known
  fields (placeholder name, `booking_source='Airbnb'`) to pre-fill. 404 on bad/rotated token,
  410 once `check_out_date` is past.
- The form **skips the calendar/date step entirely** in this mode and renders the dates as
  read-only text ("Your Airbnb stay: Jan 12 → Jan 15 · not changeable here"). The Airbnb-source
  branch already skips the payment step, so the guest sees: guest details → IDs → (pets/parking
  if they add them) → submit.
- **Submit → `submit-form` token branch (or a sibling `submit-form-completion` fn).** It
  **UPDATEs the existing row**, never inserts. Server-side, dates in the payload are **ignored**
  — `check_in_date` / `check_out_date` / `number_of_nights` are taken from the stored row, not
  the request, so a tampered client cannot move them. `booking_source` stays `'Airbnb'`;
  `external_source` / `external_uid` / `external_feed_id` are preserved. `status` stays
  `PENDING_REVIEW` (no transition fired). `guest_email` and the rest are now populated, so the
  normal admin workflow (and, once the admin advances it, the normal guest emails) work from
  here on.
- **Overlap check exception.** `submit-form`'s existing `hasOverlap` / `blockedByOwner`
  rejection must **exclude the row being completed** (and its own `ical_import` block) from the
  conflict scan — otherwise the booking collides with itself. Every _other_ overlap still rejects.
- **Idempotency / races.** Guarded `UPDATE … WHERE id = :id AND status = 'PENDING_REVIEW'`. If
  the admin already advanced the booking past review, the completion form shows "this booking is
  already being processed — contact your host" rather than silently overwriting workflow state.
  If the sync engine cancelled the row (Airbnb cancellation) before the guest submits, the token
  resolves 410.
- **No new availability risk.** The dates were already blocked the moment the ingested row was
  created (it's a non-`CANCELLED` `guest_submissions` row → `get-booked-dates` returns it) **and**
  by the `ical_import` block. Completing the form changes no dates, so nothing new to block. This
  is the mechanism that satisfies "if host or guest try to select this date from the public
  calendar it is already blocked": a real booking row exists from ingestion onward.

**UI.** Booking detail page (Airbnb-source bookings): a "Copy guest form link" action next to the
existing share actions, with a short explainer ("send this to your Airbnb guest so they complete
check-in details; dates are locked to the reservation"). Mirrors the stay-guide link affordance.

---

## 7. Sync engine algorithm

Per feed, per run (`run_id = uuid`). Lives in `_shared/calendarSyncService.ts`; the same code
path serves the global cron and the scoped "Sync now".

1. **Advisory lock** `pg_try_advisory_xact_lock(hashtext('calsync:'||feed_id))` — a feed already
   being processed by a concurrent invocation is skipped (`skipped`, `detail.reason='locked'`).
2. **Fetch** decrypted `ics_url` via the SSRF-guarded client ([§9](#9-security)): `If-None-Match`
   / `If-Modified-Since` from stored headers, 10 s timeout, ≤2 MB, ≤3 redirects, HTTPS only.
   - `304` → `skipped`, bump `last_success_at`, reset failure counters, done.
   - non-2xx / timeout / body without `BEGIN:VCALENDAR` / HTML error page →
     `consecutive_failures++`, `last_error`, write an `error` event, **leave every imported block
     untouched**, return. At `consecutive_failures >= 4` emit `calendar_sync_failing` (dedupe
     `feed:<id>:failing`) and set feed health `error` (mirror Meta "Fix connection after ≥3").
3. **Hash** the normalized body; equal to `last_feed_hash` → `skipped` (covers providers with no
   ETag).
4. **Parse** → `{ uid, start, end, summary, kind, raw }[]`. Malformed `VEVENT` (no `UID`,
   `DTEND <= DTSTART`, unparseable date) → dropped + `skipped` event, run continues. **Zero
   parseable events from a 200** → treat as `error` (step 2), not mass-cancel.
5. **Empty-feed guard.** Valid `VCALENDAR`, no `VEVENT`: `empty_pull_streak++`; only proceed to
   treat missing UIDs as cancellations when `empty_pull_streak >= 2`. Otherwise `skipped`. Reset
   the streak to 0 on any non-empty parse.
6. **Load current state** for this feed: `property_blocked_dates WHERE feed_id` keyed by
   `external_uid`; Phase 2 also `guest_submissions WHERE external_feed_id`.
7. **Diff** (set algebra on `UID`):
   - **in feed, not in DB → create.** Insert the `ical_import` block (`feed_id`, `external_uid`,
     `external_summary`, `last_seen_at`). Phase 2 && `create_bookings` && `kind='reservation'` →
     also create the `guest_submissions` row (§6.3). Events: `block_created` / `booking_created`.
   - **in both, dates equal → touch.** `last_seen_at=now()`; refresh `external_summary`. Event
     only if summary changed.
   - **in both, dates differ → reschedule.** Single `UPDATE` of the block range in place (keeps
     `id`, keeps `calendar_sync_events` FKs). Phase 2 → orchestrator date edit → `PENDING_REVIEW`.
     Events: `block_updated` / `booking_rescheduled` with `detail.from` / `detail.to`.
   - **in DB, not in feed → remove.** Only when this run was a healthy 200 with ≥1 recognizable
     event (or `empty_pull_streak >= 2`). Delete the `ical_import` block by
     `(feed_id, external_uid)`. Phase 2 → `transition(id,'CANCELLED')` with the past-checkin guard
     (§6.3). Events: `block_removed` / `booking_cancelled`.
8. **Conflict pass.** For every create/reschedule, `rangesOverlap` against: other
   `guest_submissions` (non-`CANCELLED`, non-`IMPORTED`), `manual` blocks, and imported blocks
   **from other feeds**. On overlap → **still apply the import** (the OTA already sold it — our
   calendar must reflect reality) **and** write `conflict_detected` + emit `calendar_conflict`
   (dedupe `conflict:<uid>:<partnerId>`) naming both sides. Never auto-cancel.
9. **Persist feed state:** `last_success_at`, `last_attempted_at`, `consecutive_failures=0`,
   `last_error=null`, `last_etag`, `last_modified_header`, `last_feed_hash`, `empty_pull_streak`
   (0 unless step 5 bumped it).

Blocks mutate transactionally per feed; Phase 2 orchestrator calls run after, each wrapped so one
failure logs `error` and the run continues. The whole pass is **reconcile-to-desired-state** — a
re-run after a mid-failure converges; the `(feed_id, external_uid)` unique indexes + guarded
`WHERE status=…` updates (parking-broadcast idiom) prevent doubles.

---

## 8. Outbound feed (GFM → Airbnb)

- One `VEVENT` per unavailability source for the property:
  - every `guest_submissions` row not `CANCELLED` / not `IMPORTED`, any `booking_source`, with a
    resolvable check-in/out → `SUMMARY:Booked`;
  - every `property_blocked_dates` row with `source='manual'` → `SUMMARY:Blocked`.
- **Loop / cross-OTA safety:** never emit `source='ical_import'` blocks. For `external_source IS
NOT NULL` bookings (Phase 2), emit them to _other_ providers but not back to their origin —
  implemented via the per-provider export URL from [Q2](#17-finalization-questions--answer-before-phase-1)
  (`…/ical-export?property=<slug>&token=<t>&as=airbnb`), which sets the "exclude this origin" filter.
- `UID`: `gfm-booking-<id>@<project-ref>` / `gfm-block-<id>@<project-ref>` — stable, so a date
  edit reads as an update on Airbnb's side, not churn.
- `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` (exclusive) from dates normalized via
  `availabilityService#parseFlexibleDate` (GFM stores `MM-DD-YYYY` **or** `YYYY-MM-DD` text).
- **Zero PII:** no guest name, email, phone, amount, note, id. `SUMMARY` is `Booked` / `Blocked`;
  `DESCRIPTION` omitted. Deliberate downgrade from what Airbnb's own feed contains.
- Fold at 75 octets; `PRODID:-//GFM//Calendar Sync//EN`, `CALSCALE:GREGORIAN`,
  `X-WR-CALNAME:<property name> (GFM)`. Deterministic ordering; `Last-Modified` = max(`updated_at`)
  of contributing rows so `ETag` / `304` actually save work.

---

## 9. Security

- **SSRF (critical).** `ics_url` is host-supplied and fetched server-side. `fetchExternalIcs`
  guard: `https` only; reject credentials in URL; resolve DNS and reject any private / loopback /
  link-local / ULA / `169.254.0.0/16` / `100.64.0.0/10` / IPv6-mapped equivalent; re-validate
  after every redirect (≤3); no redirect to non-https; 10 s timeout; 2 MB streaming cap; drop
  `Set-Cookie`. **Host allowlist** for `provider IN ('airbnb','booking_com','vrbo')`
  (`www.airbnb.com`, `*.airbnb.*` for locale hosts, `ical.booking.com`, `www.vrbo.com` /
  `*.homeaway.com`); arbitrary hosts only for `provider='other'`, behind the plan + permission gate.
- **Export token.** ≥32 B CSPRNG, base64url, stored plaintext (it _is_ the credential).
  Constant-time compare. Rotatable (`rotated_at`; old token dead immediately; UI warns "re-paste
  into Airbnb"). `is_enabled=false` → 404. Identical 404 body for bad-token / unknown-property /
  disabled — no enumeration.
- **Export payload PII-free** (see §8).
- **Import URL encrypted at rest** (`ics_url_encrypted`; Airbnb URLs embed `?s=<hex>`). Decrypt
  only inside the edge function. `calendar-sync-settings` GET returns a **masked** URL + `hasUrl`
  boolean, never cleartext. The reservation URL from `DESCRIPTION` is shown only to
  `pricing.channels:edit` holders.
- **Cron auth.** Global sweep behind optional `X-Calendar-Sync-Cron-Secret` (Vault). Scoped
  "Sync now" → `resolveScopedPropertyAccess` + `requirePropertyFeature`.
- **Rate-limit** `ical-export` per-IP and per-token (`_shared/publicRateLimit.ts`).
- **Audit.** Every mutation → a `calendar_sync_events` row with `run_id`. Feed CRUD + token
  rotation → the settings-change-notify path if one applies.

---

## 10. Edge functions

| Function                 | Auth                                                                                                                                                                 | Role                                                                                                                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar-sync-settings` | `serveAuthenticated` + `resolveScopedPropertyAccess(<perm leaf, Q4>)`                                                                                                | GET config (feeds + masked URLs + export token + recent `calendar_sync_events` + health); PATCH (add/edit/remove feed, toggle `create_bookings`, rotate/enable export token). Writes gated `requirePropertyFeature(propertyId,'calendarSync')` + `catchPlanFeatureError`. |
| `ical-export`            | `servePublic`                                                                                                                                                        | `GET ?property=<slug>&token=<t>[&as=<provider>]` → `text/calendar`. Constant-time token compare; 404 on any failure. `Cache-Control` + `ETag` + `Last-Modified`; `If-None-Match` → 304. Updates `last_served_at`. Rate-limited.                                           |
| `calendar-sync-cron`     | `serveCronPost` (optional secret) for the global sweep; **also** `POST {propertyId}` / `{feedId}` + authenticated JWT for "Sync now" (branch like `sd-refund-cron`). | Global: iterate active feeds whose property is `calendarSync`-entitled, honor the per-feed min-interval, run §7. Scoped: one feed now. Returns `{feedsProcessed, blocksCreated, blocksRemoved, bookingsCreated, bookingsCancelled, conflicts, errors}`.                   |

| `issue-guest-form-completion-token` | `serveAuthenticated` + `resolveScopedPropertyAccess(<bookings.detail perm>)` | Phase 2 (§6.5). POST `{bookingId}` → mints/rotates `guest_form_token` on an Airbnb-source booking, returns `<app-origin>/form?complete=<token>`. Rejects non-Airbnb / `CANCELLED` / past-checkout / already-advanced bookings. |
| `get-form-completion` | `servePublic` | Phase 2 (§6.5). GET `?complete=<token>` → property + **locked** dates/times + known fields for prefill. 404 bad/rotated token; 410 once `check_out_date` past or row `CANCELLED`. |
| `submit-form` (token branch) or `submit-form-completion` | `servePublic` | Phase 2 (§6.5). Completion submit: guarded `UPDATE … WHERE id AND status='PENDING_REVIEW'`; **dates taken from the stored row, payload dates ignored**; `booking_source`/`external_*` preserved; status unchanged; `guest_form_completed_at` set. Overlap scan **excludes this row + its own `ical_import` block**. |

`config.toml`: `[functions.ical-export] verify_jwt = false`, `[functions.calendar-sync-cron]
verify_jwt = false`, `[functions.get-form-completion] verify_jwt = false`. No `schedule` key
(local CLI limitation — cron in the migration).

---

## 11. Scheduling

Migration `…_calendar_sync_cron.sql` — self-invoking `sync_calendar_sync_cron_job()`
(SECURITY DEFINER, `search_path = public, cron, vault, pg_temp`, `GRANT EXECUTE … TO service_role`,
`{ok:false}` no-op without pg_cron/Vault) exactly like `20261201120200_parking_reminder_cron.sql`:

- Job `calendar-sync-every-30m`, cron `*/30 * * * *`. Handler enforces a per-feed **minimum
  interval** (`CALENDAR_SYNC_MIN_INTERVAL_MINUTES`, default 30) so tightening the cron later
  doesn't hammer providers.
- `net.http_post` → `/functions/v1/calendar-sync-cron`, `body := '{}'::jsonb`, optional
  `X-Calendar-Sync-Cron-Secret` from Vault (`calendar_sync_cron_secret`).
- **Post-`submit-form` fire-and-forget scoped sync** (edge case #17): `void fetch(...)` to
  `calendar-sync-cron` with `{propertyId}` + the cron secret, never blocking the guest response —
  shrinks the double-booking window on the ingestion side right after a direct booking.

Add rows to `docs/archive/operations/scheduled-jobs-and-testing.md` (§1 table, §5 env vars).

---

## 12. Frontend

### Location

Add a **"Channel sync"** section on the property **Pricing** page (`ui/src/features/dashboard/pricing/`),
where owner blocks already live — or a dedicated section under property Settings if Pricing gets
crowded (decide with the `route-guides` skill). Extend `pricing/` (hooks/components); no new
top-level module.

### Components

- `ChannelSyncCard` — entitlement-gated (`useFeatureGate('calendarSync')`; watermark / upgrade
  modal below the gating tier, per the plan-matrix client-gate inventory).
- **Import feeds list:** provider picker (Airbnb / Booking.com / VRBO / Other), label, URL input
  (masked once saved), `create_bookings` toggle (Phase 2, with "creates real bookings, no guest
  emails sent" explainer), status chip (`ok` / `syncing` / `error: …`), "last synced 2 min ago",
  **Sync now** (scoped `calendar-sync-cron`, mirrors `useRunGmailPoll`), remove.
- **Export feed:** read-only URL + copy, per-provider variants (`&as=airbnb`), enable toggle,
  **Rotate token** (confirm dialog), "Airbnb last fetched: …".
- **Activity:** last ~20 `calendar_sync_events`, human-readable ("Imported reservation Jan 12–15",
  "Conflict: overlaps direct booking #1234" → links to the booking detail).
- **Calendar:** `PricingCalendarGrid` renders `ical_import` blocks in a distinct, non-editable
  style vs editable `manual` blocks; "Convert to booking" on an imported range (§6.3).
- **Setup helper:** collapsible step-by-step (Airbnb → Menu → Calendar → Availability → Connect
  calendars → Import / Export) with the exact fields. `minimal-ui-copy` applies elsewhere; these
  steps are the allowed exception.

### Hooks

`useCalendarSyncSettings` (query, key `['calendar-sync', propertyId]`), `useUpdateCalendarSyncFeed`
/ `useSetExportEnabled` / `useRunCalendarSync` (mutations) under `pricing/hooks/`. Invalidate the
settings key on mutate.

### Mobile / a11y

`mobile-responsive` (375/768/1024, 44px targets) + `accessibility` (labelled inputs, `aria-live`
status, SR text on copy buttons).

---

## 13. Observability & failure handling

- **Health model** from Meta inbox: config payload derives `status` from `consecutive_failures`
  (`0` ok, `1–3` warning, `≥4` error + "Fix connection").
- **Notifications** (new `notifications.type` values via CHECK-widening migration unless folded
  into existing types):
  - `calendar_sync_failing` — feed error ≥4 consecutive.
  - `calendar_conflict` — overlap detected.
  - `booking_external_imported` (Phase 2) — new reservation row created.
- **Logs:** `serveCronPost` one-line JSON summary per run + `calendar_sync_events` rows.
- **Watch:** feeds in error state, median feed age, conflicts/week. Cross-tenant super-admin view
  later, not now.

---

## 14. Testing

First Deno tests in the repo (convention allows it for edge fns). The parse/generate/diff logic
is pure and is the risky part:

- `calendarSyncService` unit: line unfold; all-day vs datetime; `DTEND` exclusivity (1-night,
  same-day turnover, month/year boundary); UID diff → create/update/reschedule/remove/noop;
  truncation guards (HTML body, empty `VCALENDAR` ×1 then ×2, single bad `VEVENT`, zero events);
  reschedule-in-place; conflict via `rangesOverlap`; provider `SUMMARY` classification against
  **real exported fixtures** in `supabase/functions/_shared/__fixtures__/calendar/`
  (`airbnb-reservations.ics`, `airbnb-blocks.ics`, `booking-com.ics`, `vrbo.ics`).
- Export generation: golden-file for a property with 1 booking + 1 manual block + 1 imported
  block (imported absent); fold-at-75; stable ordering; `&as=airbnb` excludes an Airbnb-origin
  Phase 2 booking but keeps a Booking.com one.
- SSRF guard: rejects `http://`, `http://169.254.169.254/…`, `https://localhost`,
  `https://[::1]/`, a redirect from an allowed host to `http://10.0.0.1`.
- Manual E2E (`verify` skill + Playwright MCP): add a feed pointing at a local fixture server,
  "Sync now" → assert blocks on the Pricing calendar + `get-booked-dates`; drop an event from the
  fixture, sync → assert the block disappears; add an overlapping direct booking → assert the
  conflict notification.

---

## 15. Rollout / phasing

| Phase                                                      | Deliverable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Effort   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **1 — Two-way availability**                               | Migrations 5.1–5.4, 5.7; `calendarSyncService` (fetch + SSRF + parse + generate + diff) + Deno tests; `ical-export`; `calendar-sync-cron` (blocks only, `create_bookings` forced off) + cron migration; `calendar-sync-settings`; `ChannelSyncCard` + calendar styling; `calendar_sync_failing` + `calendar_conflict` notifications; docs                                                                                                                                                                                                                                            | L        |
| **2 — Reservation ingestion + guest-form completion link** | Migrations 5.5 + 5.6 + `notifications.type` widen; `create_bookings` path via `WorkflowOrchestrator` (row **stays `PENDING_REVIEW`**, never auto-advances); no-guest-side-effect guard; past-checkin drop guard; "Convert to booking" + manual promotion UI; `booking_external_imported`; downgrade-safety cron filter. **Plus §6.5:** `issue-guest-form-completion-token`, `get-form-completion`, `submit-form` completion branch (dates locked server-side, overlap scan self-excluded), guest-form `?complete=` mode, "Copy guest form link" on the Airbnb-source booking detail. | M–L      |
| **3 — Real connector (separate plan)**                     | `provider='hostaway'` / `'beds24'` REST + webhook adapter on the same `fetch→normalize→diff→apply` interface; real-time; guest PII; alteration/cancellation webhooks; Airbnb messages into Guest Inbox; optional rate push                                                                                                                                                                                                                                                                                                                                                           | L, later |

**Decisions locked (2026-08-29):** ingestion = availability **+** reservation rows (Phases 1–2),
no full-PII channel-manager path now (Q1); iCal only, Tier-3 seam left unbuilt (Q2); `calendarSync`
gates at **Pro (`growth`) +** (Q3); ingested Airbnb bookings **stay in `PENDING_REVIEW`**; add the
guest-form completion link (§6.5). Remaining open items: Q4–Q10 + Q11–Q13 below.

Ship Phase 1, watch conflict-notification volume a few weeks, then Phase 2 (reservation rows are
already wanted, so Phase 2 is committed, not conditional).

---

## 16. Edge cases — exhaustive

| #   | Situation                                                                                     | Handling                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Airbnb feed 500s / times out                                                                  | Keep last-good blocks; `consecutive_failures++`; retry next tick; notify after ≥4. Never wipe.                                                                                                                               |
| 2   | Feed returns HTML ("maintenance") with 200                                                    | No `BEGIN:VCALENDAR` → error path (#1), not "all cancelled".                                                                                                                                                                 |
| 3   | Valid but **empty** `VCALENDAR`                                                               | Accept as "all gone" only after `empty_pull_streak >= 2`; else `skipped`.                                                                                                                                                    |
| 4   | Zero parseable `VEVENT`s from a 200                                                           | Error path (#1), not mass-cancel.                                                                                                                                                                                            |
| 5   | Reservation dates edited on Airbnb                                                            | Same `UID`, new dates → in-place block update; Phase 2 → orchestrator date edit → `PENDING_REVIEW`.                                                                                                                          |
| 6   | Reservation cancelled on Airbnb                                                               | `UID` vanishes from a healthy feed → remove block / cancel booking (with the truncation guards).                                                                                                                             |
| 7   | Guest checks out; Airbnb drops the past event                                                 | Past-checkout / past-`READY_FOR_CHECKIN` feed-drop → `skipped`, **no cancel** (§6.3).                                                                                                                                        |
| 8   | Reservation altered to a **partial-refund / date-shift resolution** on Airbnb                 | iCal shows only the net date range → handled as a reschedule (#5). Money side is invisible; host reconciles in Finance manually. Documented limit.                                                                           |
| 9   | Airbnb **inquiry / pre-approval / "pending" reservation** (not yet confirmed)                 | Airbnb only puts _confirmed_ stays in the export feed, so these never arrive over iCal. A Tier 3 adapter would. No handling needed in Phase 1/2 beyond a doc note.                                                           |
| 10  | Same night booked on Airbnb **and** directly in GFM within the poll window                    | Import still applied; `conflict_detected` + `calendar_conflict` naming both; no auto-resolution.                                                                                                                             |
| 11  | Host manually blocked GFM dates that Airbnb later books                                       | Overlap of import vs `manual` block → conflict notification; both kept; host decides.                                                                                                                                        |
| 12  | Two feeds on one property (Airbnb + Booking.com) claim overlapping nights                     | Cross-feed overlap in the conflict pass → notification; both imported blocks kept.                                                                                                                                           |
| 13  | Export → Airbnb import → Airbnb re-exports our booking to us                                  | Broken by never re-exporting `ical_import` blocks / origin-provider `external_source` bookings, and by the per-provider export URL (`&as=`).                                                                                 |
| 14  | `DTEND` off-by-one worry                                                                      | Airbnb `DTEND` is exclusive = GFM model. Unit-tested both directions, 1-night + same-day turnover.                                                                                                                           |
| 15  | Feed uses UTC datetimes near midnight Manila                                                  | Floor to `Asia/Manila` calendar date before storing (night granularity).                                                                                                                                                     |
| 16  | Host rotates the feed URL on Airbnb                                                           | Old URL 404s → error path → host re-pastes the new URL in `calendar-sync-settings`.                                                                                                                                          |
| 17  | GFM export token rotated                                                                      | Old token 404s immediately; UI warns "re-paste into Airbnb"; Airbnb marks its import failed until updated.                                                                                                                   |
| 18  | Property deleted                                                                              | `ON DELETE CASCADE` clears feeds, export row, sync events; imported blocks go with the property.                                                                                                                             |
| 19  | Direct GFM booking cancelled                                                                  | Drops from the export query (`!= CANCELLED`) automatically; Airbnb frees the night next poll (~2–4 h).                                                                                                                       |
| 20  | `submit-form` guest booking lands on an OTA-held night before import ran                      | The double-booking window. Mitigation: post-`submit-form` fire-and-forget scoped sync (§11) + host help-text disclosure.                                                                                                     |
| 21  | Very large feed (years of history)                                                            | 2 MB cap + only diff events with `DTEND >= today − 2d`; ignore ancient past events.                                                                                                                                          |
| 22  | Malformed single `VEVENT` (no `UID`, bad date, `DTSTART==DTEND`)                              | Skipped + logged; run continues.                                                                                                                                                                                             |
| 23  | Duplicate `UID` within one feed                                                               | Last wins; `skipped` (`detail.reason='dup_uid'`) for the earlier.                                                                                                                                                            |
| 24  | Feed `LAST-MODIFIED` in the future / clock skew                                               | Ignored — we key on `UID` + dates, not timestamps.                                                                                                                                                                           |
| 25  | Host disables a feed                                                                          | `is_active=false` → cron skips; imported blocks **retained** (re-enable re-syncs). Explicit "remove feed + its blocks" destructive action offered separately.                                                                |
| 26  | Entitlement lost mid-subscription                                                             | Cron filter drops the property; config + past blocks/bookings retained read-only (§6.3).                                                                                                                                     |
| 27  | Concurrent global cron + manual "Sync now" on one feed                                        | Per-feed advisory lock; second caller no-ops that feed (`skipped`, `reason='locked'`).                                                                                                                                       |
| 28  | Airbnb "blocked" (not booked) nights in the feed                                              | `kind='block'` → always a `property_blocked_dates` row, never a `guest_submissions` row, even Phase 2.                                                                                                                       |
| 29  | Booking.com `SUMMARY` is `CLOSED - Not available` for everything (no reserved/blocked split)  | Adapter: all → `kind='reservation'` when `create_bookings` on, else all → blocks. Documented limit ([Q7](#17-finalization-questions--answer-before-phase-1)).                                                                |
| 30  | Multi-unit / "room type" Airbnb listing (N of the same unit)                                  | One iCal = one availability count; can't represent "2 of 5 left". Map 1 Airbnb listing → 1 GFM property only; multi-unit needs Tier 3. Doc note + UI warning on the Airbnb provider.                                         |
| 31  | Feed served as `text/plain` / `application/octet-stream`                                      | Sniff body for `BEGIN:VCALENDAR`; don't hard-require the MIME.                                                                                                                                                               |
| 32  | Property re-let to a different org (unit handoff)                                             | Feeds are `property_id`-scoped and cascade; a new property row = fresh config. No cross-tenant leak.                                                                                                                         |
| 33  | Guest count / adults-children not in the feed                                                 | Placeholder `number_of_adults = 1`; host edits. GFM validation must accept an external row with placeholder counts (check `guest_submissions` CHECK constraints — they allow 1 adult).                                       |
| 34  | Phase 2 booking manually advanced by the host, then cancelled on Airbnb                       | If past `READY_FOR_CHECKIN` → treat as stale (#7). If still `PENDING_REVIEW` / `PENDING_DOCUMENTS` → `transition(...,'CANCELLED')`; the orchestrator's backward-safety already prevents outbound email on cancel.            |
| 35  | Host edits an `ical_import` booking's dates in GFM, then the feed re-asserts the old dates    | Feed is source of truth for `external_*` rows: next sync overwrites back to the feed dates + logs `booking_rescheduled` with `detail.reason='feed_reasserted'` and notifies, so the host sees why their edit reverted.       |
| 36  | Same `UID` reappears after being cancelled (Airbnb re-instates)                               | `(feed_id, external_uid)` unique index is on live rows; a re-appeared `UID` with no matching live row → treated as a fresh `create`. Phase 2: new `guest_submissions` row (the cancelled one stays `CANCELLED` for history). |
| 37  | Time-zone-only change in the feed (dates identical, `DTSTART` gains/loses a `TZID`)           | Normalized to the same calendar date → `touch`, no reschedule.                                                                                                                                                               |
| 38  | Airbnb export includes a multi-day `VEVENT` spanning a DST boundary (non-PH feeds)            | Use a TZ-aware date library for `provider != 'airbnb'`; never string-math dates. PH has no DST so Airbnb feeds are unaffected.                                                                                               |
| 39  | `calendar-sync-cron` global run exceeds the edge function timeout with many feeds             | Process feeds in bounded batches ordered by `last_attempted_at ASC`; a run that hits a soft time budget stops early and the next tick picks up where it left off (oldest-first ordering guarantees progress).                |
| 40  | Vault secrets (`project_url` / `anon_key`) absent (fresh local reset)                         | `sync_calendar_sync_cron_job()` returns `{ok:false}` and no-ops, like every other cron migration here. Local dev triggers sync via the "Sync now" button or a manual `curl`.                                                 |
| 41  | Guest opens the completion link (§6.5) and tries to change the dates                          | Date step is not rendered in `?complete=` mode; even a hand-crafted POST is ignored — `submit-form` completion branch reads dates from the stored row, not the payload.                                                      |
| 42  | Guest completes the form; then Airbnb reschedules the reservation                             | Sync engine reschedules the same row (dates from feed win) and logs `booking_rescheduled`; the already-entered guest details are kept. Host notified.                                                                        |
| 43  | Airbnb cancels the reservation after the host sent the link but before the guest submits      | Row → `CANCELLED` by the sync engine; the completion token now resolves **410**; guest sees "this reservation was cancelled".                                                                                                |
| 44  | Admin advances the ingested booking past `PENDING_REVIEW` before the guest completes the link | Guarded `UPDATE … WHERE status='PENDING_REVIEW'` fails → completion form shows "already being processed — contact your host"; no workflow state overwritten.                                                                 |
| 45  | Guest submits the completion form twice (double-tap / reshare)                                | `guest_form_completed_at` + guarded update make the second submit a no-op returning the same success state; token is single-active but re-usable until check-out unless the host rotates it.                                 |
| 46  | Host forwards the completion link for a **non-Airbnb** booking                                | `issue-guest-form-completion-token` rejects anything but `booking_source='Airbnb'` / `external_source IS NOT NULL` (v1 scope); revisit if hosts want it for phone/walk-in bookings later.                                    |
| 47  | Completion form submitted for dates that now overlap a **different** new booking (race)       | Overlap scan excludes only _this_ row + its own `ical_import` block; a genuine clash with another booking still rejects, guest told to contact the host.                                                                     |

---

## 17. Decisions — all locked (2026-08-29)

Everything below is settled; no open questions remain. Implementation follows these verbatim.

| #   | Decision                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Ingestion = availability **+** reservation rows (Phases 1–2). No channel-manager / full-PII path in this build.                                                                                                                                                  |
| Q2  | iCal only. The Tier-3 adapter interface seam exists conceptually but is **not built**.                                                                                                                                                                           |
| Q3  | `calendarSync` `PlanFeatureKey` gates at **Pro (`growth`) and above**. Phase 1 and Phase 2 share the one key (no separate higher gate for reservation ingestion).                                                                                                |
| —   | Ingested Airbnb bookings are created in **`PENDING_REVIEW`** and never auto-advance (§6.3).                                                                                                                                                                      |
| —   | Ship the **guest-form completion link** (§6.5).                                                                                                                                                                                                                  |
| Q4  | **Dedicated permission leaf** `pricing.channels:edit` added to `propertyTeamPermissions.ts` (plus `pricing.channels:view` for read). Not folded into `pricing.blocks:*`.                                                                                         |
| Q5  | **Per-provider export URL** — `…/ical-export?property=<slug>&token=<t>&as=<provider>`. `as` sets the "exclude this origin" filter for loop + cross-OTA safety. A bare URL with no `as` exports everything non-`ical_import` (back-compat / single-OTA hosts).    |
| Q6  | Ingested-row `primary_guest_name` = the **Airbnb confirmation code** (`HM…`, parsed from the `DESCRIPTION` reservation URL) when available, else **`'Airbnb guest'`**. Phone last-4 is **never** written to a phone field; it may appear only in `external_raw`. |
| Q7  | **Accept** the Booking.com reserved-vs-blocked limitation (#29): with `create_bookings=true`, all Booking.com `VEVENT`s → `kind='reservation'`; with it false, all → blocks. Documented in the UI + route guide.                                                 |
| Q8  | Cron every **30 min** (`*/30 * * * *`); handler enforces a per-feed 30-min minimum interval (`CALENDAR_SYNC_MIN_INTERVAL_MINUTES`).                                                                                                                              |
| Q9  | Channel-sync UI = a **card on the property Pricing page** (`ui/src/features/dashboard/pricing/`). No new module.                                                                                                                                                 |
| Q10 | Removing a feed **keeps** its imported blocks/bookings as historical (they may be real stays). The row's `feed_id` is set null-safe via a separate cleanup; a distinct "remove feed **and** its data" destructive action is also offered.                        |
| Q11 | Completion form lets the guest edit **everything except dates** — guest count, IDs, additional guests, pets, parking, special requests.                                                                                                                          |
| Q12 | Completion link is **live until `check_out_date` passes**, then `410`. **No expiry column.** **One active token** per booking; re-issue rotates (old token dies).                                                                                                |
| Q13 | Completing the form emits a notification — new `notifications.type` **`booking_guest_form_completed`** ("Airbnb guest completed check-in details for …").                                                                                                        |
| Q14 | The completion submit is a **new dedicated `submit-form-completion` edge function** (UPDATE-only, dates locked server-side), not a branch inside `submit-form`.                                                                                                  |

---

## 18. Non-goals / future

- **Airbnb official Partner API (Tier 2)** — business/legal track. If pursued, becomes a
  Phase-3-style adapter.
- **Rate / pricing push to OTAs** — impossible over iCal.
- **Airbnb messaging in the Guest Inbox** — Tier 3; reuse the dormant `'airbnb'` `SocialPlatform`.
- **Parking (`parking_id`) calendar sync** — same engine, a `parking_calendar_feeds` sibling.
- **Automatic double-booking resolution** — deliberately human-in-the-loop.
- **Financial reconciliation of OTA payouts** — out of scope; iCal has no money data.
- `calendar_sync_events` retention cron — noted, scheduled later.

---

## 19. Docs to update on implementation

Per `documentation-maintenance` + `route-guides` (both always-on Cursor rules):

- `docs/PROJECT.md` + `docs/architecture/data-model.md` — new tables, `property_blocked_dates` /
  `guest_submissions` columns, `calendarSync` key.
- `docs/architecture/edge-functions.md` — `calendar-sync-settings`, `ical-export`,
  `calendar-sync-cron`, and (Phase 2) `issue-guest-form-completion-token` / `get-form-completion` /
  `submit-form-completion` (+ `config.toml` JWT policy).
- `docs/architecture/plans-feature-matrix.md` — `calendarSync` row, tier, client + server gate
  inventory entries.
- `.cursor/rules/booking-workflow.mdc` — external-reservation provenance, the no-guest-side-effect
  guard, "ingested rows stay `PENDING_REVIEW`, never auto-advance", the past-checkin feed-drop
  rule, `external_source` alongside `booking_source='Airbnb'`, and the guest-form completion path
  (UPDATE-only, dates locked, status untouched).
- `docs/archive/operations/scheduled-jobs-and-testing.md` — `calendar-sync-every-30m` job + env
  vars (`CALENDAR_SYNC_MIN_INTERVAL_MINUTES`, `CALENDAR_SYNC_CRON_SECRET`).
- `docs/guides/routes/org/property/*` — Pricing (or Settings) Channel sync section; **bookings
  detail** guide — the "Copy guest form link" action on Airbnb-source bookings.
- `docs/guides/routes/guest-*` / the guest form route guide — the `?complete=<token>` mode
  (locked dates, no calendar step).
- `.cursor/rules/admin-auth.mdc` — only if a new permission leaf (Q4) is added.
- `docs/archive/operations/migration-runbook.md` — migration execute order + the
  `unblock_property_blocked_dates` signature change.
- Move this file to `docs/workflow/in-progress/` via `/workflow-start` when Phase 1 begins.
