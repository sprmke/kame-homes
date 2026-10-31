---
stage: done
title: 'Parking E2E Phase 3 — Payment & Pricing (PayMongo, Guest Rate, Anti-Spam, Cancellation)'
status: done
tags: [planning, planned-modules, parking, payments]
updated: 2026-08-30
---

# Phase 3 — Payment & Pricing

Part of [Parking E2E Phase 2+ overview](./parking-e2e-later-phases.md). Depends on Phase 2 (a match must exist before payment).

## Problem

The `parkings` vertical has zero payment concept today (Phase 1 decision #11). This phase adds the guest-facing PayMongo payment that turns a "matched" request into a "paid, confirmed" reservation — the trigger for Phase 5's endorsement automation and Phase 4's payout.

## Decisions

| #   | Decision                                                                                                                                                                                                                   | Detail                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Guest pays via the platform's PayMongo account (Payment Links, extended), not the host's own payment method                                                                                                                | Overview D12, **confirmed by user 2026-08-26** — a guest paying directly into a host account is incompatible with commission/payout and with never-show-guest-amount-to-host.                                                                                      |
| 2   | New `parking_payment_transactions` table + new webhook branch, reusing `paymongoClient.ts`'s `createPaymongoPaymentLink()`                                                                                                 | Existing `subscriptionOrchestrator.ts` is hard-wired to `org_payment_transactions` — don't overload it; add a sibling handler, following the same `metadata.kind` dispatch pattern already used (`kind: 'org_subscription'` today, add `kind: 'parking_booking'`). |
| 3   | Guest rate is platform-configured (Phase 4's admin page), weekday/weekend variant, read at payment-link-creation time and snapshotted onto the transaction row                                                             | Rate must not silently change between offer and payment if admin edits config mid-flight.                                                                                                                                                                          |
| 4   | Payment window (TTL): 15 min if check-in is today, 1 hr otherwise, mirroring Phase 1/2's broadcast TTL                                                                                                                     | On timeout, release the match back to the search pool (next batch/candidate) rather than leaving it stuck.                                                                                                                                                         |
| 5   | Guest can cancel any time before payment succeeds (during search or during an open payment window)                                                                                                                         | Overview D7. Cancellation after payment success is not offered as self-service (non-refundable).                                                                                                                                                                   |
| 6   | Idempotent webhook handling via the same `processed_paymongo_events` dedupe pattern already used for subscriptions                                                                                                         | Prevents double-processing on PayMongo retry delivery.                                                                                                                                                                                                             |
| 7   | Pricing display: parking pricing page shows the host their own gross rate, the service fee deduction, and their net payout — never the guest-paid amount (that's a platform-level number, not tied to the host's own rate) | Explicit intake ask; ties into Phase 4's commission config.                                                                                                                                                                                                        |

## Tasks

**Payment collection**

- [x] Migration: `parking_payment_transactions` (booking id FK, guest-charged amount snapshot, host_gross snapshot, commission_pct snapshot, status, PayMongo reference, timestamps). — `20261128120100_parking_payment.sql`.
- [x] New edge function `create-parking-payment-checkout` — guest-authenticated, creates the PayMongo Payment Link with `metadata: { kind: 'parking_booking', transaction_id, booking_id }`, inserts/reuses a `pending` transaction row.
- [x] New webhook branch for `kind: 'parking_booking'` — on `payment.paid`/`link.payment.paid`, mark transaction paid, transition the parking booking status. — **Scope note:** used the existing `PENDING_PAYMENT → PENDING_REVIEW` transition (no new terminal-ish "PAID" state — `PENDING_REVIEW` already meant "confirmed" in the parking status machine since Phase 1, so a distinct PAID state would have been redundant). Phase 5's endorsement job doesn't exist yet, so no trigger wired — will hook in when Phase 5 lands.
- [x] Payment TTL cron/expiry — `runExpireParkingPayments()`, same `expire-parking-broadcasts` cron tick as broadcast expiry (no separate schedule); timeout releases the claim and resumes search via `advanceOrTerminateParkingBatch` rather than leaving it stuck.
- [x] Guest-facing checkout UI on `ParkingRequestStatusPage` — "Pay Now" CTA + payment-window countdown/progress bar (reused Phase 2's components), distinct `PENDING_PAYMENT` status state.

**Guest rate & pricing display**

- [x] Guest rate resolution helper used at payment-link creation. — **Scope note:** Phase 4's `platform_parking_settings` admin config doesn't exist yet; reused Phase 2's existing `STUB_GUEST_PARKING_RATE_WEEKDAY`/`_WEEKEND` stub constants (`parkingPricing.ts`) instead of building new config — same interim-stub pattern Phase 2 already established for exactly this dependency.
- [x] Host-facing gross/fee/net breakdown on `ParkingPricingRatesFormCard.tsx` — "Service fee" / "You get" line under each rate field, using `STUB_COMMISSION_PCT`. Display only, per D7 — never shows the guest-paid amount.
- [x] Enforce the guest-rate price cap on host rate input — both server-side (`parkingPricing.ts#assertWithinGuestRateCap`, rejects the base rate and per-date overrides alike, verified via the real `parking-pricing` PATCH locally) and client-side (inline warning + disabled Save in `ParkingPricingRatesFormCard.tsx`) — a clear rejection, not a silent clamp.

**Anti-spam / abuse prevention**

- [x] Rate limit per authenticated guest on `submit-parking-booking-request` (max 3 concurrent pending, 24hr cooldown after 3 cancellations) — `parkingAntiSpam.ts#assertParkingSubmitAllowed`, verified locally (4th concurrent submit correctly rejected). Scoped to genuine guest self-submissions only (`guestEmail === caller's own email`) — a host submitting via "New booking" on a guest's behalf is never rate-limited against their own account.
- [ ] IP/device-level throttle on the public submit endpoint. — **Still deferred** — submit is no longer public/anon anyway (guest-auth required), which already narrows this surface; revisit once Phase 8's unauthenticated direct-link entry point exists, per the ticket's own sequencing note.

**Cancellation**

- [x] Guest-facing cancel action, enabled only while status is pre-payment (searching or payment-window-open). — `cancel-parking-booking` + `AlertDialog` confirm on the status page.
- [x] Cancelling during an open payment window releases the claimed slot via the same low-level primitive a timeout uses (`releaseParkingClaim`). — **Design clarification (the ticket's wording was ambiguous):** the _primitive_ is shared, but the _outcome_ isn't — a timeout resumes the search (guest didn't ask to stop), a guest cancel terminates to `CANCELLED` (guest explicitly asked to stop). Read literally, "releases the match the same way a timeout does" would mean an explicit cancel silently keeps searching, which contradicts cancel being a terminal guest action — resolved this by splitting the shared un-claim mechanic from the caller-chosen "what happens next." Flagged for review in `.cursor/rules/parking-workflow.mdc`'s "Payment (Phase 3)" section.
- [ ] Admin-only manual refund/override path for platform-caused errors. — **Deferred** — no payment has actually succeeded in production yet (PayMongo isn't configured), so there's nothing to refund against; revisit once real payments are flowing.

## File map (as-built)

| Path                                                                                                                      | Change                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `supabase/migrations/20261128120100_parking_payment.sql`                                                                  | New table + `guest_auth_user_id`/`parking_payment_expires_at` + widened status CHECK       |
| `supabase/functions/create-parking-payment-checkout/index.ts`                                                             | New — guest-authenticated payment link creation                                            |
| `supabase/functions/cancel-parking-booking/index.ts`                                                                      | New — guest-authenticated cancel                                                           |
| `supabase/functions/_shared/parkingPaymentOrchestrator.ts`                                                                | New — checkout creation, webhook fulfillment, `releaseParkingClaim` primitive              |
| `supabase/functions/_shared/parkingCancellation.ts`                                                                       | New — guest cancel (both pre-claim and awaiting-payment cases)                             |
| `supabase/functions/_shared/paymongoWebhookMetadata.ts`                                                                   | New — shared webhook payload digging, extracted from `subscriptionOrchestrator.ts`         |
| `supabase/functions/_shared/subscriptionOrchestrator.ts`                                                                  | `handlePaymongoWebhookEvent` now dispatches on `metadata.kind` first                       |
| `supabase/functions/_shared/parkingStatusMachine.ts` + UI mirror `parkingWorkflow.ts`                                     | New `PENDING_PAYMENT` state + transitions                                                  |
| `supabase/functions/_shared/parkingBroadcastActions.ts`                                                                   | Claim sets `PENDING_PAYMENT` + payment TTL, sends awaiting-payment email                   |
| `supabase/functions/_shared/parkingBroadcastExpireCron.ts`                                                                | New `runExpireParkingPayments()`, same cron entry point                                    |
| `supabase/functions/_shared/parkingBroadcastEmail.ts`                                                                     | New `sendParkingAwaitingPaymentEmail`                                                      |
| `supabase/functions/_shared/parkingPricing.ts`                                                                            | `STUB_COMMISSION_PCT` added alongside the existing guest-rate stub                         |
| `supabase/functions/submit-parking-booking-request/index.ts`                                                              | Guest-authenticated (`serveAuthenticated`, was `servePublic`); stamps `guest_auth_user_id` |
| `supabase/functions/get-parking-booking-status/index.ts`                                                                  | Status-dependent `expiresAt` (broadcast vs payment TTL)                                    |
| `supabase/functions/transition-parking-booking/index.ts`                                                                  | Also rejects `PENDING_PAYMENT` as `fromStatus`                                             |
| `ui/src/features/guest/marketing/parkings/pages/ParkingRequestStatusPage.tsx` + `components/ParkingRequestStatusView.tsx` | Pay-now CTA, cancel action, 4-step progress, `PENDING_PAYMENT` state                       |
| `ui/src/features/dashboard/parking/pages/ParkingBookingDetailPage.tsx`                                                    | Host-side cancel button no longer offered during `PENDING_PAYMENT` (blocked server-side)   |
| `.cursor/rules/parking-workflow.mdc`                                                                                      | Extended with the full "Payment (Phase 3)" section + "Anti-spam" section                   |
| `supabase/functions/_shared/parkingAntiSpam.ts`                                                                           | New — guest submit rate limiting                                                           |
| `ui/src/features/dashboard/parking/components/ParkingPricingRatesFormCard.tsx`                                            | Gross/fee/net preview + inline price-cap warning, Save disabled over cap                   |
| `ui/src/features/dashboard/parking/lib/parkingPricingDefaults.ts`                                                         | Client-side mirror of the guest-rate cap + commission stubs                                |
| `supabase/functions/_shared/parkingPricing.ts`                                                                            | Server-side `assertWithinGuestRateCap`, applied to base rates and date overrides           |

## Edge cases

See overview's "Payment (Phase 3)" section — webhook/cancel races, mid-checkout abandonment, duplicate webhook delivery, rounding, stale-match payment, admin-override refund path. Also found and fixed during implementation: the admin dashboard's "New booking" modal reuses `submit-parking-booking-request` with the _host's_ session, not the guest's — see the known gap noted in `docs/guides/routes/org/parking/bookings.md` and `.cursor/rules/parking-workflow.mdc`.

## Exit criteria

- [x] Payment link creation, webhook fulfillment (simulated payload — no real PayMongo keys locally), and the guarded-UPDATE idempotency were all verified against the local DB — see verification notes below.
- [x] Guest cancel during an open payment window correctly lands on `CANCELLED` (not resumed search) — **deviates from this criterion's literal wording** ("releases the match... the same way a timeout does") per the documented design clarification above; verified via the real edge function locally.
- [x] Payment TTL timeout releases the claim and resumes search (next batch, or terminates once exhausted) — verified via the real cron endpoint locally, including the correct interaction with Phase 2's batching.
- [x] Host rate input above the guest-rate cap rejected with a clear message — verified both directions (over-cap rejected, within-cap accepted) via the real `parking-pricing` PATCH locally.
- [x] Rate-limit thresholds documented and enforced — verified locally: 3 concurrent pending requests allowed, 4th rejected with a clear message.
- [x] `bun run lint && bun run type-check && bun run build` clean.
- **Not verified** (documented limitation, consistent with the plan): the real PayMongo Payment Link API call and webhook signature verification, since no `PAYMONGO_SECRET_KEY`/`PAYMONGO_WEBHOOK_SECRET` exist in `supabase/.env.local` locally — needs a real pass once those are configured.
