---
stage: done
title: 'Parking E2E Phase 7 — Property-Booking → Parking E2E Migration'
status: done
tags: [planning, planned-modules, parking, booking-workflow]
updated: 2026-08-26
---

# Phase 7 — Property-Booking Parking Migration

Part of [Parking E2E Phase 2+ overview](../planned/parking-e2e-later-phases.md). Depends on Phases 3, 4, 5 (payment, payout, endorsement automation) — all shipped.

## Problem

Property-booking guests used to get parking through a legacy manual path: a static env-var list of parking-owner emails got a broadcast on a `need_parking` guest-form submission, and an admin manually captured owner/rate/receipt inside `ParkingRequestForm.tsx` during the `PENDING_PARKING_REQUEST` workflow sub-step. This predated the standalone `parkings` marketplace and duplicated work the new engine (Phases 1–6) already does properly. Phase 7 retires the automatic trigger in favor of guest self-serve through the marketplace.

## Decision (locked, overview D14 — Option 2 + host-assist)

Guest form keeps `need_parking` as a pure interest signal (no vehicle/date/pricing collection). Guest self-serves through the standalone marketplace flow and pays there directly. Property host does zero manual work — sees the match auto-complete on their booking detail page, plus a "share parking link" convenience action for guests who ask them directly instead of self-serving. Confirmed this session: parking is fully removed from the property-booking downpayment total (no bundled charge).

## Implemented

- **Migration** (`20261201120000_parking_property_link.sql`) — `guest_submissions.linked_property_booking_id` (self-referencing FK, set only on `parking_id` rows pointing at a `property_id` row) + `guest_submissions.parking_reminder_sent_at`. Second migration (`20261201120100_parking_matched_notification_type.sql`) adds the `booking_parking_matched` notification type. Third (`20261201120200_parking_reminder_cron.sql`) schedules the reminder sweep.
- **Linkability rule** (`_shared/parkingPropertyLink.ts#isParkingLinkableStatus`) — a property booking is linkable once it's past `PENDING_REVIEW` (i.e. `PENDING_DOCUMENTS` or later, excluding `CANCELLED`/`IMPORTED`). This is _not_ the stay-guide RFCI+ gate — it's deliberately earlier, matching the two same-status completion paths `transition-booking` actually supports (`PENDING_DOCUMENTS` same-status, or the documented RFCI+ "late parking" rule). See the file's own comment for the residual (accepted) gap: a booking literally sitting at a legacy `PENDING_GAF`/`PENDING_PARKING_REQUEST`/`PENDING_PET_REQUEST` status has no same-status edge in either direction — auto-complete is caught/logged, not applied, same as before this booking could self-serve at all.
- **Guest self-serve entry** — `list-linkable-property-bookings` edge function (guest-authenticated) resolves the signed-in guest's linkable stays by `guest_user_id`/`guest_email` (same identity match as `listGuestTrips`). `ParkingRegistrationForm.tsx` shows a "which stay is this for?" picker when the guest is signed in and has linkable bookings (single match auto-selects), prefilling unit number + vehicle fields (not dates — a pinned listing's dates come from that listing's own availability calendar, not the property stay, to avoid a mismatch). `submit-parking-booking-request/index.ts` accepts an optional `linkedPropertyBookingId`, verifies ownership + linkability via `parkingPropertyLink.ts#verifyLinkablePropertyBooking`, and stamps it on insert.
- **Host-assist share link** — `useBookingParkingShareLink.ts` (simpler than `useBookingStayGuideLink.ts`: no per-booking token, just the marketplace's public `/parkings` root, since eligibility resolves from the guest's own identity, not a URL parameter). Wired into `bookingDetailActions.ts` next to the stay-guide actions.
- **Property booking detail panel** — `get-linked-parking-booking` edge function (property-scoped read via `resolveScopedPropertyAccess`/`verifyBookingBelongsToProperty`, mirroring `get-booking-ai-review`) resolves the linked marketplace booking's status + endorsement + host contact (`resolveParkingHostContact`). `ParkingPanel.tsx` renders this live view when linked, else the legacy owner/rate/`DocPreview` fields unchanged (historical bookings).
- **Auto-complete** — `parkingPaymentOrchestrator.ts#fulfillParkingPayment`, after a successful payment, if `linked_property_booking_id` is set: reads the property booking's current status and calls `WorkflowOrchestrator.transition()` with same-status `toStatus` + `document_completion_target: 'PENDING_PARKING_REQUEST'` — the exact call `ParkingRequestForm.tsx`'s manual "Mark as Complete" already makes. Isolated try/catch. Fires a `booking_parking_matched` in-app notification on success.
- **Guest form simplification** — `guestFormSteps.ts` step 3 is now a pure `needParking` toggle (no dependent required fields); `guestFormSchema.ts`'s conditional vehicle/date validation removed; `guestFormPayment.ts`'s `computeGuestFormPaymentBreakdown` no longer computes a parking line item (`GUEST_PARKING_RATE_PER_NIGHT`/`parkingSubtotal`/`parkingNights` removed); `GuestFormPaymentStepContent.tsx` no longer shows a Parking row. `GuestFormParkingDates.tsx` deleted (no longer referenced anywhere).
- **Booking-confirmation touchpoints** — `GuestFormSuccess.tsx` shows a "Need parking?" card + `/parkings` link when `needParking` is true. `booking-acknowledgement.html`'s flow section (`buildBookingAcknowledgementFlowSectionHtml`) appends a parking callout using the previously-unused `.callout-parking` fragment CSS, when `booking.need_parking` is true.
- **Pre-arrival reminder cron** — `send-parking-reminders` edge function + `_shared/parkingReminderCron.ts`, scheduled daily (`parking-reminder-daily` cron job, `20261201120200_parking_reminder_cron.sql`, mirrors `20261018120001_parking_broadcast_expire_cron.sql`). Sends one reminder (dedupe via `parking_reminder_sent_at`) to any linkable, unlinked, `need_parking = true` property booking whose check-in is within 3 days.
- **Legacy broadcast retirement** — removed the automatic `sendParkingBroadcast(updatedBooking)` call from `workflowOrchestrator.ts`'s `PENDING_REVIEW` proceed path. A new `need_parking` signal no longer fires the env-list email at all.

## Deviation from the original plan

**`submit-pay-parking/index.ts`'s broadcast call was intentionally NOT removed**, despite the original phase-doc/plan text saying to remove it. That endpoint backs the host-facing "Add/Open pay parking" action (`bookingDetailActions.ts`) — a manual, host-initiated action available on _any_ property booking (not specifically legacy ones) for collecting vehicle info and notifying a parking owner by hand. Removing its broadcast would silently break that still-valid admin capability for every booking, not just retire an automatic new-signal trigger — which contradicts the same plan's own requirement that `PayParkingPage.tsx`/`submit-pay-parking` "keep working... for any booking that already has legacy data." Only the _automatic_ trigger in `workflowOrchestrator.ts` (fired by a new `need_parking` signal with no admin involvement) was retired.

## Untouched by design (compatibility window)

- `parking-broadcast-email/index.ts` (manual admin resend), `PayParkingPage.tsx`, `submit-pay-parking/index.ts`, `ParkingRequestForm.tsx`/`ParkingTab.tsx` — fully functional, unmodified, for historical/in-flight legacy bookings.
- Legacy columns (`parking_owner`, `parking_rate_guest`, `parking_rate_paid`, `parking_payment_receipt_url`, `parking_receipt_ai_verdict`, `parking_endorsement_url`) — never dropped or backfilled.

## Verification status

Static checks (`lint`, `type-check`, `build`, `check:filenames`) clean.

Functional verification against the real local stack (Supabase local + edge functions, not just static checks):

- **Guest self-serve linking** — real guest session (`perezarianna0410@gmail.com`) called `list-linkable-property-bookings` against a real seed property booking and got the correct eligible stay back (with vehicle-field prefill data); `submit-parking-booking-request` with `linkedPropertyBookingId` set correctly stamped `guest_submissions.linked_property_booking_id` on the new marketplace row, and the booking was then correctly excluded from a second `list-linkable-property-bookings` call (already-linked exclusion works).
- **Property booking detail read** — `get-linked-parking-booking` correctly returned `{linked: true, status: 'PENDING_PAYMENT', hostContact: null}` for the linked pair (host contact correctly withheld pre-endorsement).
- **Auto-complete mechanism** — called `transition-booking` directly with the same same-status + `document_completion_target: 'PENDING_PARKING_REQUEST'` payload `autoCompletePendingParkingRequest` constructs, against a real `COMPLETED`-status property booking; confirmed `parking_completed_at` was set via the real orchestrator path (not a raw write) — this is the exact mechanism `parkingPaymentOrchestrator.ts` calls after a real payment.
- **Pre-arrival reminder cron** — `send-parking-reminders` correctly found 16 real seed candidates (need_parking, linkable, unlinked, check-in within 3 days) and attempted a real send for each; all 16 failed only because seed data uses `@example.com` addresses Resend's sandbox key rejects (`Invalid \`to\` field`) — confirms the query, per-property template rendering, and Resend call construction are all correct.
- **Guest form (browser)** — full walkthrough of `/properties/:slug/form` as a signed-in guest: Parking step shows the simplified interest toggle with the new copy, selecting "Yes" shows the no-vehicle-needed note and no vehicle/date fields, and the Payment step's breakdown correctly has **no parking line item** (total = downpayment only).
- **Property booking detail — Parking panel + share link (browser)** — with a real linked+endorsed marketplace booking (`status: READY_FOR_CHECKIN`, `endorsement_sent_at` set), the Parking tab correctly showed "Match status: Confirmed", the resolved host name/email (`resolveParkingHostContact` found the org owner), and the endorsement copy — the legacy vehicle/rate fields did **not** render. The **⋯ More actions** menu correctly showed "Open parking link" / "Copy parking link" next to the stay-guide actions.
- **Booking-success page CTA (browser)** — submitted a real guest form with `needParking = true`; the success page correctly showed the "Need parking?" card linking to `/parkings`, which navigated correctly. Test booking deleted afterward.
- **Booking-acknowledgement email callout (browser, admin Templates preview)** — added a sample `parkingUrl` to the preview-mode call (`propertyTemplateEmailSections.ts`, preview-only, does not affect real sends) so template editors can see the callout's layout; confirmed via the real Templates → Booking Acknowledgement → Preview iframe (same renderer as production sends) that the "Need parking?" callout renders in the correct position, after the 3-step flow and before the signature, with a working link.
- **Mobile (375px) pass (browser)** — guest form Parking step (both states) and the "which stay is this for?" picker on `/parkings/:slug/form` render cleanly with no overflow and correct copy.
- Test data created during verification (temporary email swaps, three marketplace/property bookings, one notification) was cleaned up / reverted after each check.

### Bug found and fixed during mobile verification

The "which stay is this for?" picker (`ParkingRegistrationForm.tsx`) **never actually auto-selected or prefilled anything** — a real, reproducible bug, not a test artifact (confirmed with a fresh, non-expired guest session). Root cause: Radix `Select` mirrors its controlled value onto a hidden native `<select>` for form participation; when the value is set programmatically (auto-select) before the corresponding `<option>` has been registered in the DOM (Radix only mounts `SelectContent`'s children when the dropdown has been opened at least once), the browser silently resets the hidden select to `""`, and Radix bubbles that back through `onValueChange` — immediately overwriting the just-set booking id with an empty string. Fixed by ignoring falsy values in the `onValueChange` handler (`SelectItem` values are always `"none"` or a real booking id, never `""`, so this is never a legitimate user selection). Re-verified end-to-end after the fix: the picker now correctly shows the matched stay, and Unit Number + all three vehicle fields (plate/brand/color) prefill correctly on step 2/3.

## Exit criteria

- [x] A property booking guest can self-serve through the marketplace and get `linked_property_booking_id` set, verified against their own identity.
- [x] A linked marketplace payment auto-clears the property booking's parking gate via the real `transition-booking` path (not a raw write), with a host notification.
- [x] Property booking detail page shows live match/host-contact once linked; historical bookings unaffected.
- [x] `docs/PROJECT.md`, `.cursor/rules/booking-workflow.mdc`, `.cursor/rules/parking-workflow.mdc`, and affected route guides updated in the same change.
- [x] End-to-end browser verification, including mobile — see Verification status above (a real picker bug was found and fixed in the course of this).
