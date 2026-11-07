---
stage: in-progress
title: 'Cancellation policy and process: enforceable policies, booking-time snapshot, guest and host cancel flows, refunds'
status: in-progress
tags: [planning, bookings, cancellation, refunds, guest, host, property-settings, booking-workflow]
updated: 2026-11-07
---

# Cancellation policy and process

Turn the cancellation policy from **display text** into an **enforced, end-to-end process**: hosts pick a market-standard preset or build their own tiered schedule, the policy the guest saw is **locked onto the booking when they book**, guests can cancel (or request to cancel) from their trip page with an exact refund preview, hosts cancel with reasons and a refund preview, and every refund is tracked until it is sent.

Intake source: `docs/workflow/intake/_to-dos.md` ("Refine cancellation policy settings and the overall cancellation process", "Refine and improve cancellation policy options") and `_to-plan.md` ("Cancellation Process").

**Revision note (2026-11-05):** rewritten after a second code audit. The first draft was directionally right but left the refund math, the post-check-in host path, request expiry, and payout-detail storage ambiguous. Those are now specified. New decisions are marked **D6–D10**.

## Implementation status (2026-11-05)

**Shipped in this slice**

- **Paid-based refunds (D8):** the policy percentage applies to what the guest actually paid (down payment + settled balance), not the full stay value. A 50% policy on a down-payment-only booking returns 50% of the DP, never ₱0. The security deposit is collected at check-in, so it is not part of a pre-check-in cancellation; a post-check-in host cancellation still returns it. Balance-paid bookings always go through host approval (D11).
- **Simplified settings:** removed the free-cancellation window switch, per-fee rules, instant/request setting, host note, and the upcoming-bookings save prompt. All paid amounts follow the selected policy. The example shows a sample payment breakdown (down payment, pet fee, parking fee, additional fee) and peso refunds, and Non-refundable shows a warning that what the guest paid is not returned.
- Policy engine v2 (`_shared/cancellationPolicy.ts` + client mirror), presets, legacy mapping, validation, rendering, stable hash.
- Refund calculator (`_shared/cancellationRefund.ts` + client mirror), Manila deadline math, cash-paid cap, overrides, line items.
- Migrations: `property_cancellation_policy_versions`, snapshot + cancellation columns, immutability trigger + super-admin RPC, `booking_cancellation_requests`, `booking_refunds`, RLS reads.
- Snapshot capture in `submit-form` / `submit-form-completion` / `import-commit` / calendar-sync promotion; `409 policy_changed`; agreement checkbox.
- Endpoints: `guest-cancel-booking`, `guest-cancellation-request`, `respond-cancellation-request`, extended `cancel-booking`, `submit-guest-refund-details`, `record-booking-refund`, `cancellation-refund-cron`.
- Orchestrator writes `cancelled_at` / `cancelled_by` / reason and sends cancellation emails; activity log + PostHog props.
- Host UI: v2 policy Manage sheet, cancel sheet, booking cancellation/refund card, list badge.
- Guest UI: booking-form agreement card, trip-page cancellation card + sheet + refund details, listing timeline.
- Superhost cancellation rate now counts only host cancellations.
- Tests: Deno policy + refund fixtures, Vitest client/server parity, superhost guard.

**Deliberately deferred (do not treat as done)**

- One-shot snapshot backfill script: replaced by read-path self-heal (`ensureBookingSnapshot`) and the migration `booked_at` backfill.
- Copy-to-properties policy changes are not versioned on the target yet. Content-hash comparison on submit still catches a copied policy.
- Bookings-list **filter** for cancellation requests: the row badge + notification + detail card ship; the filter chip does not.
- Finance refund outflows and the guest/host analytics split: superhost is fixed; finance/analytics aggregation is a follow-up.
- Listing "example for selected dates": the full timeline ships; the date-specific example does not.
- Playwright mocked E2E for the cancel journeys: unit + parity + edge tests ship; the E2E specs are a follow-up.

---

## 1. Where we are today (audit, 2026-11-05)

### 1.1 What exists

| Area             | Current behavior                                                                                                                                                                                                                                                           | Files                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Policy model     | 6 types: `grace_period`, `full_before_checkin`, `moderate`, `partial_before_checkin`, `non_refundable`, `custom` (free text). Fixed option lists (grace 24/48/72/168h, days 1/3/5/7/14/30, partial 25/50/75%). Stored at `properties.settings.cancellationPolicy` (JSONB). | `supabase/functions/_shared/propertyCancellationPolicy.ts` + byte-identical client copy `ui/src/features/dashboard/org/lib/propertyCancellationPolicy.ts`                            |
| Host settings UI | Preview card + Manage modal (radio presets + selects). Also editable from Page Editor. Included in "copy settings to properties".                                                                                                                                          | `PropertyCancellationPolicySection.tsx`, `PageEditorPage.tsx`, `copyPropertySettingsGroups.ts`                                                                                       |
| Guest display    | Listing page, trip page (Booking details), AI receptionist and inbox AI read the **current** property policy.                                                                                                                                                              | `CancellationPolicyDisplay.tsx`, `PropertyOverview.tsx`, `GuestTripDetailsSection.tsx`, `publicPropertyService.ts`, `guestReceptionistTools.ts`, `guestReceptionistContext.ts`       |
| Host cancel      | Booking detail workflow footer → confirm → `POST cancel-booking` → `WorkflowOrchestrator.transition(..., 'CANCELLED')`, voucher release, Telegram notify, activity log `booking.cancelled`, PostHog `booking_cancelled`.                                                   | `supabase/functions/cancel-booking/index.ts`, `WorkflowPanel.tsx`, `WorkflowActionsBar.tsx`, `useTransitionBooking.ts#useCancelBooking`, `bookingStatus.ts#canCancelBookingAtStatus` |
| Guest cancel     | **None.** Trip page says "To cancel or change dates, message your host".                                                                                                                                                                                                   | `GuestTripDetailsSection.tsx`, `docs/guides/routes/trip.md`                                                                                                                          |
| OTA cancel       | Calendar sync cancels promoted Airbnb rows when the UID drops from the feed (skipped after check-in).                                                                                                                                                                      | `_shared/calendarSyncRun.ts`                                                                                                                                                         |
| Parking cancel   | Guest can cancel a marketplace parking request only before payment.                                                                                                                                                                                                        | `_shared/parkingCancellation.ts`, `cancel-parking-booking`                                                                                                                           |
| Analytics        | `cancellationRate` KPI; superhost requires ≤1% cancellation rate (OTA feed drops excluded).                                                                                                                                                                                | `analyticsService.ts`, `superhostMetrics.ts`                                                                                                                                         |

### 1.2 Gaps and bugs found

1. **Policy is never enforced.** Nothing computes a refund, a deadline, or "is this cancellation free?". The policy is marketing copy only.
2. **No booking-time snapshot.** The trip page, AI receptionist and inbox AI show the property's **live** policy. If a host switches from "Free cancellation" to "Non-refundable", every existing guest's trip page silently changes.
3. **No acceptance at booking.** The guest booking form (`GuestForm.tsx`) never shows the cancellation policy and has no agreement step, so there is no record of what the guest agreed to.
4. **Silent default.** `normalizeCancellationPolicySettings` returns "Free cancellation for 48 hours" when a property never set a policy, so hosts advertise a policy they never chose.
5. **`custom` is unenforceable.** Free text only; can't drive any refund logic.
6. **No guest cancel path.** The only "Cancel this booking" button on the guest form is a dev-only control (`showDevControls`) that calls the authenticated `cancel-booking` endpoint with the anon key, so it can't work anyway.
7. **Server cancel guard is looser than the UI.** `cancel-booking` only rejects already-cancelled rows. The UI (`CANCELLABLE_STATUSES`) blocks cancel after check-in, but the server still accepts `READY_FOR_CHECKOUT` / `PENDING_SD_REFUND` / `COMPLETED` / `IMPORTED` via a direct call.
8. **No reason, no initiator.** We don't record who cancelled (guest vs host vs OTA vs system) or why. Superhost cancellation rate therefore penalizes hosts for guest-initiated cancels.
9. **No refund tracking.** Money the guest already paid (down payment, balance, security deposit) has no refund amount, status, method, receipt, or reminder after a cancel.
10. **No cancellation emails.** Side-effects table row `any → CANCELLED` sends no email to guest or host (`.cursor/rules/booking-workflow.mdc` §3). Only Telegram fires.
11. **No policy change history.** Policy edits go through the generic settings save; there's no versioning and no "N upcoming bookings keep their old policy" warning.
12. **Copy to properties** can overwrite another property's policy without any notice about existing bookings.
13. **Linked parking is ignored.** Cancelling a stay with a linked marketplace parking booking does nothing to the parking side.
14. **No admin create path.** Bookings are created by `submit-form`, `submit-form-completion`, `import-commit`, or calendar-sync promotion. There is no `create-booking` endpoint, so the first draft's `admin_create` capture source does not exist.
15. **Booking detail reads `guest_submissions` directly** (`useBooking`), not `get-booking`. New tables need scoped RLS `SELECT` policies or the host UI must go through an edge function. This plan adds RLS reads, matching `user_can_access_guest_submission_property`.

### 1.3 Payment context that shapes the design

Guest payments are **manual** (GCash/bank receipts verified by AI + host; `payment_methods` JSONB). PayMongo is used only for subscriptions and parking. So we **compute** refunds and **track** them, but the host sends the money themselves and records it. We can never "charge a penalty" beyond what the guest already paid.

Recorded money fields on `guest_submissions`:

- `booking_rate` — total stay rate.
- `down_payment` — cash already paid before check-in (credited against the rate).
- `guest_balance_paid_amount` — balance settled at check-out (includes SD + fees when settled).
- `security_deposit`, `pet_fee`, `guest_additional_fee`.
- `applied_voucher_discount_php` — discount never paid as cash.

`computeTotalGuestBalanceFromBooking` = `booking_rate − down_payment + security_deposit + pet_fee + guest_additional_fee`. Airbnb rows exclude rate/DP/SD. **Cash actually paid = `down_payment + guest_balance_paid_amount`.** This is the number a refund can never exceed.

---

## 2. Competitive brief (how the big apps do it)

| App                                        | Standard options                                                                                                                                                                                                   | Key mechanics we copy                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Airbnb**                                 | Flexible (full refund ≥24h before check-in), Moderate (≥5 days), Limited (≥14 days), Firm (≥30 days full, 50% to 7 days), plus a Non-refundable discount option. Strict was retired Oct 2025 and migrated to Firm. | **The policy at the time of booking applies**, host changes only affect new bookings. Universal **24-hour free cancellation** after booking, only when booked ≥7 days before check-in. Deadlines are measured against **check-in time in the listing's time zone**. Guest sees an exact date ("Free cancellation before 2:00 PM on Nov 12") and a refund breakdown before confirming. Host cancellations always refund the guest in full. |
| **Vrbo**                                   | Relaxed (100% ≥14d, 50% 7 to 14d), Moderate (100% ≥30d, 50% 14 to 30d), Firm (100% ≥60d, 50% 30 to 60d), Strict (100% ≥60d), No refund.                                                                            | Policies are **tiered schedules** (days-before → percent).                                                                                                                                                                                                                                                                                                                                                                                |
| **Booking.com**                            | Free cancellation until X days, partially refundable, non-refundable rate.                                                                                                                                         | Policy is attached to the **rate plan**, shown at checkout, and stored on the reservation.                                                                                                                                                                                                                                                                                                                                                |
| **Guesty / Hostaway / Lodgify / OwnerRez** | Custom tier builders (multiple rows of "N days before arrival → X% refund"), choose whether fees/deposits are refundable.                                                                                          | Policy stored per reservation; cancellation screen shows the computed refund and lets staff override with a note.                                                                                                                                                                                                                                                                                                                         |

Sources: [Airbnb help: cancellation policies](https://www.airbnb.com/help/article/475), [Airbnb help 3735](https://airbnb.com/help/article/3735), [Hostfully tier explainer](https://www.hostfully.com/blog/airbnb-cancellation-policy/), [Vrbo help: policy options](https://help.vrbo.com/articles/What-are-the-cancellation-policy-options), [Hostaway Vrbo guide](https://www.hostaway.com/vrbo-cancellation-policies/), [Lodgify Vrbo guide](https://lodgify.com/guides/vrbo/cancellation-policy/). Exact day cutoffs vary between sources; we use our own named presets and do not claim parity with any platform's numbers.

**Takeaways**

1. Model every policy as a **tiered refund schedule** so presets and custom policies run through one engine.
2. **Snapshot the policy on the booking** and never mutate it.
3. Show **exact dates and peso amounts**, not abstract rules, at every guest touchpoint.
4. Distinguish **guest-initiated** from **host-initiated** cancels (refund rules, metrics, copy).
5. Let hosts **refund more** than the policy with a note; never silently refund less.

---

## 3. Decisions (Phase 0, resolved)

| #   | Decision                       | Resolution                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Preset numbers / default       | Use the preset cards in §4.1. **Moderate** is the recommended choice in the setup wizard and the pre-selected card, but it is **not silently applied** to a property that never saved a policy.                                                                                                                                                                                                                      |
| D4  | Refund payout detail storage   | New `booking_refunds` columns (method, bank, account name/number, phone). **Do not** reuse `sd_refund_*` — that would clobber the check-out SD flow. Account numbers are masked in UI and never logged.                                                                                                                                                                                                              |
| D5  | No-show in v1                  | **Yes, as a reason code**, not a separate module. Host cancels with `reasonCode: 'no_show'`, `initiator: 'guest'`, excluded from the host cancellation rate.                                                                                                                                                                                                                                                         |
| D6  | Post-check-in host cancel      | **Allowed at any non-terminal status** (including `READY_FOR_CHECKOUT` / `PENDING_SD_REFUND`) so hosts keep today's emergency escape hatch. Refund preview defaults to ₱0 after check-in and requires an explicit override + note. Guest cancel stays pre-check-in only.                                                                                                                                             |
| D7  | Snapshot contents              | Snapshot stores the normalized policy **plus rendered title/description/short label and a stable hash**. Emails and AI never re-render from a policy that may have changed.                                                                                                                                                                                                                                          |
| D8  | Refund math                    | Percentage of the **amount actually paid** (down payment + settled balance), **not** the full booking value. This app collects a down payment at booking and the balance at check-in, so a "50% of the total stay" rule would wipe out a guest who paid only the DP. Security deposit is collected at check-in; if it was paid and the host cancels after check-in, it is refunded in full. Worked examples in §5.4. |
| D9  | Request expiry                 | An open request **expires at check-in time**. After that the guest can no longer self-cancel; the host decides.                                                                                                                                                                                                                                                                                                      |
| D10 | Unset policy on new properties | No silent default. Listing shows "Ask the host about cancellation"; the booking form shows the same and snapshots `unset`; setup checklist flags it. Booking is still allowed.                                                                                                                                                                                                                                       |
| D11 | Balance paid → request mode    | Once `guest_balance_paid_amount > 0`, a guest cancellation **always** goes through host approval. Instant self-cancel is only for down-payment-only bookings, where the money at risk is small.                                                                                                                                                                                                                      |

---

## 4. Target design

### 4.1 Policy model v2 (one engine)

```ts
type CancellationPolicy = {
  version: 2;
  presetId: 'flexible' | 'moderate' | 'standard' | 'limited' | 'firm' | 'non_refundable' | 'custom';
  /** Sorted most-generous first. "Cancel at least `daysBefore` days before check-in → `refundPercent`% of what you paid." */
  tiers: { daysBefore: number; refundPercent: number }[]; // max 5, days 0..365, percent 0..100
  /** Percent refunded when no tier matches. Always 0 for presets and the builder. */
  fallbackRefundPercent: number;
  /** Legacy free-text title, preserved for display. */
  legacyTitle?: string;
  /** Legacy free-text description, preserved for display. */
  legacyDescription?: string;
  /** Migrated free text: host must finish setup before this drives money. */
  needsReview?: boolean;
};
```

No grace window, no per-fee rules, no instant/request setting, no host note. The percentage always applies to what the guest paid; the balance-paid rule decides instant vs request.

**Presets:**

| Preset         | Tiers                            | After the last deadline |
| -------------- | -------------------------------- | ----------------------- |
| Flexible       | 100% at ≥1 day before            | 0%                      |
| Moderate       | 100% at ≥3 days before           | 0%                      |
| Standard       | 100% at ≥5 days before           | 0%                      |
| Limited        | 100% at ≥7 days before           | 0%                      |
| Firm           | 100% at ≥14 days, 50% at ≥7 days | 0%                      |
| Non-refundable | none                             | 0%                      |
| Custom         | host builder, up to 5 rows       | 0%                      |

**Legacy mapping** (read path, no data loss, no destructive migration):

- `grace_period(h)` → **Flexible** (the closest simple preset; the old "free window after booking" is not representable as a deadline).
- `full_before_checkin(d)` → Custom `[{ d, 100 }]`.
- `moderate(h, d)` → Custom `[{ d, 100 }]` (the grace part is dropped).
- `partial_before_checkin(d, p)` → Custom `[{ d, p }]`.
- `non_refundable` → Non-refundable.
- `custom` free text → Custom, tiers `[]`, `needsReview: true`, `legacyTitle` / `legacyDescription` = old copy.
- Missing / invalid → `null` (**unset**), never a silent default.

**No silent default.** A property without a saved policy resolves to `null`. Listing and booking form say "Ask the host about cancellation". The setup guide step stays incomplete. The booking is still allowed and the snapshot stores `{ unset: true }`.

### 4.2 Booking-time snapshot (the core guarantee)

New columns on `guest_submissions`:

| Column                             | Type            | Notes                                                                                                                                                            |
| ---------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cancellation_policy_snapshot`     | `JSONB`         | `{ policy, capturedAt, capturedFrom, propertyPolicyVersionId, rendered, hash, externalSource, unset }`                                                           |
| `cancellation_policy_accepted_at`  | `TIMESTAMPTZ`   | Set when the guest ticked the agreement on the booking form                                                                                                      |
| `booked_at`                        | `TIMESTAMPTZ`   | Booking timestamp kept for history. Backfilled from `created_at`; the calculator no longer uses it (no grace window).                                            |
| `cancellation_requested_at`        | `TIMESTAMPTZ`   | Denormalized for the bookings-list filter; set/cleared by the request service                                                                                    |
| `cancelled_at`                     | `TIMESTAMPTZ`   | When the cancellation committed                                                                                                                                  |
| `cancelled_by`                     | `TEXT`          | `guest` \| `host` \| `ota` \| `system`                                                                                                                           |
| `cancellation_reason_code`         | `TEXT`          | `change_of_plans` \| `found_another_place` \| `travel_issue` \| `emergency` \| `no_show` \| `no_payment` \| `duplicate_or_test` \| `host_unavailable` \| `other` |
| `cancellation_reason_note`         | `TEXT`          | Free text, optional except host-initiated                                                                                                                        |
| `cancellation_refund_override_php` | `NUMERIC(12,2)` | Host override of the computed refund                                                                                                                             |
| `cancellation_override_note`       | `TEXT`          | Required when the override differs from the computed amount                                                                                                      |

Rules:

- **Captured server-side** in `submit-form` from the property settings at submit time. Never trust a client-sent policy. The client sends the `propertyPolicyVersionId` it displayed; if it differs from the current one, reject with `409 policy_changed` and the form reloads the policy and asks the guest to re-accept. The form keeps every entered value.
- **Immutable.** A DB trigger rejects any UPDATE that changes a non-null `cancellation_policy_snapshot` (escape hatch: a super-admin RPC with a required reason, audit-logged).
- **Survives** guest edits (revert to `PENDING_REVIEW`), admin edits, admin reschedule (deadlines recompute from the new check-in date, policy stays the same), and the form-completion flow.
- **OTA rows** (`external_source` set): snapshot `{ policy: null, externalSource: 'Airbnb' }`. No in-app guest cancel, no refund calc; copy says "Cancellation is handled on Airbnb".
- **Imported rows**: `{ unset: true, capturedFrom: 'import' }`.
- **Backfill** existing non-terminal rows with the property's current policy, `capturedFrom: 'backfill'`, so they behave predictably. Hosts see "Policy on file" (not "Policy you agreed to") on backfilled rows.
- **Every reader switches to the snapshot**: trip page, booking detail, emails, AI receptionist/inbox AI when a booking is in context. The listing page keeps showing the live policy (that is for new bookings).

### 4.3 Policy versions and change governance

- New table `property_cancellation_policy_versions (id, property_id, policy JSONB, created_by, created_at)`; append-only; current version id stored at `properties.settings.cancellationPolicyVersionId`.
- Saving a changed policy inserts a version and logs `property.cancellation_policy_updated` (from/to summary) to `activity_log`.
- No save confirmation. Snapshots protect existing bookings silently; the host is not interrupted with an upcoming-bookings prompt.
- A property that had no policy and saves one for the first time also creates version 1.

### 4.4 Refund calculator (pure, shared)

`computeCancellationOutcome({ snapshot, booking, cancelledAt, initiator, checkInTime, overrideRefundPhp })` in `_shared/cancellationRefund.ts` + client mirror, parity-tested.

**Time.** Check-in instant = `check_in_date` + property `checkInTime` (default `14:00`) in **Asia/Manila** (UTC+8, no DST). Deadline for a tier = check-in instant − `daysBefore` days. Server clock only.

**Rule selection.**

1. If `cancelledAt >= checkInInstant` → `mode: 'after_checkin'`, percent `0` unless host override.
2. Else pick the first tier (most generous first) whose deadline has not passed → that percent.
3. Else `fallbackRefundPercent`.
4. `initiator = 'host'` → **100% of cash paid**, regardless of policy.
5. `policy = null`, `needsReview`, or custom with no tiers → `mode: 'host_decides'`; guest flow forced to request mode.

**Money (D8).**

- `cashPaid = down_payment + guest_balance_paid_amount` — everything the guest has actually handed over.
- `securityDepositPaid = guest_balance_paid_amount > 0 ? min(security_deposit, cashPaid) : 0` — the DP is credited against the stay, so the SD is only “paid” once the balance is settled.
- `paidForStay = cashPaid − securityDepositPaid`. Every paid amount (stay, pet fee, additional fee) follows the same policy.
- `refundDue = paidForStay × percent + securityDepositPaid`, clamped to `[0, cashPaid]`.
- Host cancellation bypasses the percentage and refunds `cashPaid` in full.
- A host override replaces the computed refund, clamped to `[0, cashPaid]`.
- Round the final refund to whole peso, half up. The breakdown shows paid for stay, total paid, non-refundable and refund, and always sums. The security deposit appears only when it was already paid at check-in.

**Why paid-based.** The guest pays a down payment at booking; the balance is collected at check-in. A 50% policy on a ₱2,000 down payment for a ₱10,000 stay must return ₱1,000, not ₱0. A fully paid booking still behaves like the market standard: 50% of the stay; the security deposit is returned separately if it was already paid at check-in.

**Worked examples** (₱10,000 stay, ₱500 pet fee, ₱1,500 SD):

| Scenario                | Paid               | Policy      | Refund |
| ----------------------- | ------------------ | ----------- | ------ |
| DP only, Moderate 100%  | ₱2,000 DP          | 100%        | ₱2,000 |
| DP only, Firm 50%       | ₱2,000 DP          | 50%         | ₱1,000 |
| Larger DP, Firm 50%     | ₱8,000 DP          | 50%         | ₱4,000 |
| Fully paid, Firm 50%    | ₱12,000 (incl. SD) | 50% + SD    | ₱6,750 |
| DP only, Non-refundable | ₱2,000 DP          | 0%          | ₱0     |
| DP only, host cancels   | ₱2,000 DP          | host → 100% | ₱2,000 |

The fully paid row is a host cancellation after check-in, when the security deposit has been settled. A guest cancellation before check-in only has the down payment (and any paid fees) to refund.

**Output** also carries `appliedRule`, `cancellableUntil`, `nextDeadline`, `refundablePaidPhp`, and the full `deadlines` timeline for UI copy ("50% of what you paid until 2:00 PM, Nov 12").

### 4.5 Guest cancellation flow

**Where.** Trip page (`/properties/:slug/trip`) gets a **Cancellation** card, shown for `PENDING_REVIEW`, `PENDING_DOCUMENTS` (+ legacy nested) and `READY_FOR_CHECKIN` before check-in time. It shows:

- The policy the guest booked with (snapshot), not the live one.
- A three-band timeline: free now → partial → no refund, with exact Manila dates/times.
- "Cancel booking" (instant) or "Request to cancel" (request mode), plus "Withdraw request" when a request is open.
- When cancelled: refund amount and status ("Refund in progress", "Sent on Nov 9").

**Sheet.** Bottom sheet on phone, modal on desktop: policy summary, refund breakdown, reason picker (Change of plans, Found another place, Travel issue, Emergency, Other + text), and a typed/checkbox confirmation.

**Modes.**

- **Instant**: booking → `CANCELLED` immediately; refund record created with the computed amount; guest is asked for payout details (method, bank/GCash, account name/number) in the same sheet after confirming. Only while the guest has paid the down payment and nothing else.
- **Request**: creates a cancellation request; booking keeps its status with a "Cancellation requested" badge; host approves or declines; reminder at 24h; **no auto-approve** (the host owns the money). The guest can withdraw. The request expires at check-in. **Used when the balance has been settled** (`guest_balance_paid_amount > 0`) or the policy is unset/legacy free text. There is no host setting for this.
- **PENDING_REVIEW with no rates confirmed and nothing paid**: "Withdraw request", no refund section.

**Endpoint** `guest-cancel-booking` (`servePublic`): same auth as `get-guest-trip` (booking access token or signed-in owner), rate-limited, idempotent (conditional update on expected status), recomputes the refund server-side, ignores any client amount. A separate `guest-cancellation-request` handles create/withdraw. Remove the dev-only cancel button from `GuestForm.tsx`.

### 4.6 Host cancellation flow

Upgrade the cancel confirm in `WorkflowPanel` into a **Cancel booking sheet**:

1. **Who asked**: Guest asked to cancel / I'm cancelling / No payment received / Duplicate or test booking.
2. **Reason** (select + optional note; required note for host-initiated).
3. **Refund preview** from the snapshot. Host-initiated shows 100% before check-in; after check-in it shows 0% and requires an override.
4. **Override amount** with a required note. A lower-than-policy refund shows a warning and is logged as `refund_below_policy`. An override above cash paid is clamped and the UI explains why.
5. **Notify guest by email** (default on when the guest email exists).

**Cancellation requests**: request card on booking detail + Bookings list filter "Cancellation requested" + notification. Approve opens the same sheet prefilled with initiator `guest`; Decline requires a message to the guest.

**Server**: `cancel-booking` accepts `{ initiator, reasonCode, reasonNote, refundOverridePhp?, overrideNote?, notifyGuest }`, enforces the host cancellable set, stamps the new columns, creates the refund record.

### 4.7 Status rules (D6)

| Initiator | Cancellable statuses                                                                                                                                        | Refund default                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Guest     | `PENDING_REVIEW`, `PENDING_DOCUMENTS`, `PENDING_GAF`, `PENDING_PARKING_REQUEST`, `PENDING_PET_REQUEST`, `READY_FOR_CHECKIN` and **before check-in instant** | Policy (tier/fallback)                                     |
| Host      | Every status except `CANCELLED`, `COMPLETED`, `IMPORTED`                                                                                                    | 100% of cash paid before check-in; 0% after, override only |
| OTA       | Calendar-sync feed drop (existing)                                                                                                                          | No money movement                                          |
| System    | Import revert only                                                                                                                                          | No money movement                                          |

`IMPORTED` keeps the existing import-revert path only. Early departure stays a host goodwill refund (`kind: 'goodwill'`) without changing status.

### 4.8 Refund tracking

New table `booking_refunds`:

```text
id, booking_id, property_id, organization_id,
kind: 'cancellation' | 'goodwill',
amount_due_php, amount_paid_php, breakdown JSONB,
status: 'not_due' | 'awaiting_guest_details' | 'pending' | 'sent' | 'cancelled',
method: 'same_phone' | 'other_bank' | 'cash' | null,
bank, account_name, account_number, phone,
proof_url, sent_at, created_by, notes,
created_at, updated_at
```

- Unique partial index: one `kind = 'cancellation'` row per booking.
- Booking detail (cancelled): Refund card with status, amount, guest details, "Mark refund sent" + proof upload (reuse `upload-booking-asset` pattern).
- Trip page (cancelled): "Refund ₱X: in progress / sent on Nov 9".
- Cron reminder to the host for refunds `pending` > 3 days, and to the guest for `awaiting_guest_details` > 2 days (property automation toggle, plan-gated like the SD refund cron).
- Finance: refunds show as outflows; analytics revenue for cancelled bookings counts only retained money.

### 4.9 Notifications

| Event                       | Guest                                                    | Host                                       |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Guest cancelled (instant)   | Cancellation confirmed email (refund amount, next steps) | Email + in-app + Telegram (existing)       |
| Guest requested             | Request received email                                   | Email + in-app + Telegram, reminder at 24h |
| Request approved / declined | Email                                                    | none                                       |
| Host cancelled              | Email with reason and refund amount                      | none                                       |
| Refund marked sent          | Email with proof link                                    | none                                       |

Four new property templates: `email-booking-cancelled-guest`, `email-booking-cancelled-host`, `email-cancellation-request-guest` (received / approved / declined via sections), `email-refund-sent-guest`. Orchestrator owns the sends. Suppressed when `guest_email` is blank (same as other guest-facing effects).

New notification types: `booking_cancellation_requested`, `booking_cancelled_by_guest`, `booking_cancellation_request_resolved`, `booking_refund_due`.

### 4.10 Display surfaces

- **Listing page**: full schedule card with an example for the selected dates ("Book for Nov 20 → free cancellation until Nov 15").
- **Booking form**: compact policy card with exact dates for the chosen stay + required checkbox "I agree to the cancellation policy" (stores `cancellation_policy_accepted_at`). Also add the policy to the acknowledgement email.
- **Trip page, booking detail, emails, AI receptionist, inbox AI**: read the snapshot.
- **Booking detail (host)**: "Cancellation policy" row with the snapshot, "Free cancellation until …" status chip, and "Policy changed since booking" hint when the property's current version differs.

### 4.11 Host settings UX

- Manage sheet: preset cards (name, one-line schedule, "Popular" on Moderate) → example with a sample check-in, a payment breakdown (down payment, pet fee, parking fee, additional fee) and the refund at each deadline ("Cancel by Nov 6 → ₱2,000 back") → Save.
- **Custom builder**: add/remove tier rows (days 0..365, percent 0..100 in steps of 5), auto-sorted, validation (strictly decreasing days, non-increasing percent, no duplicates, max 5 rows). After the last row, no refund.
- Non-refundable relies on the example card alone; no extra warning banner (it duplicated the refund amount).
- No grace window, no per-fee rules, no instant/request setting, no host note.
- `useGuardedClose` on the modal (unsaved-changes guard), bottom sheet on phone, 44px targets.
- Same component in Page Editor. Setup guide step requires an explicit choice.

### 4.12 Permissions, plans, feature availability

- Permissions: keep `bookings.detail.workflow:edit` for cancel, refund overrides and mark-sent. No new leaf was added; a separate `bookings.detail.refunds:edit` would have required catalog + seeded-template churn for a capability the workflow leaf already gates. Policy edits reuse `settings.cancellationPolicy:edit`. Update `propertyPermissionCatalog.ts` + server expansion + team docs.
- Plans: core booking feature, available on all tiers (no gate). Refund reminder cron follows the existing automation plan gate. Record the decision in `plans-feature-matrix.md`.
- Feature availability: no new global module key; it is part of Bookings.

### 4.13 Metrics

- `cancelled_by` drives superhost: only `host` counts toward the host cancellation rate. OTA drops and no-shows stay excluded.
- Analytics: split cancellation rate into guest vs host; add "refunds owed / sent" to finance.
- PostHog `booking_cancelled` gains `initiator`, `reason_code`, `refund_percent`; new `booking_cancellation_requested`, `booking_refund_recorded`, `booking_refund_sent`.

---

## 5. Edge cases checklist

### 5.1 Policy and snapshot

| #   | Scenario                                                 | Expected behavior                                                                           |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E1  | Host changes policy after a booking                      | Booking keeps its snapshot; only new bookings use the new version                           |
| E2  | Host changes policy while a guest is on the booking form | `409 policy_changed`, form keeps all values, reloads the policy, asks to re-accept          |
| E3  | Host deletes/unset the policy mid-form                   | Same `409`; form shows "Ask the host" and clears the agreement requirement                  |
| E4  | Copy-to-properties overwrites a policy                   | Existing bookings keep their snapshot; no confirm is shown                                  |
| E5  | Booking made before this feature                         | Backfilled snapshot labeled "Policy on file"                                                |
| E6  | Legacy free-text policy                                  | `needsReview`, host-decides, guest request mode, setup checklist flags it                   |
| E7  | Snapshot tampering                                       | Trigger blocks updates; super-admin RPC only, audit-logged                                  |
| E8  | Two tabs submit the form at once                         | First wins; second gets `409` and re-reads the policy                                       |
| E9  | Guest edits an existing booking                          | Snapshot and `booked_at` unchanged; no re-acceptance                                        |
| E10 | Admin reschedule after booking                           | Snapshot kept; deadlines recompute from the new check-in date                               |
| E11 | Form completion flow (OTA)                               | Snapshot captured from the property policy at completion, `capturedFrom: 'form_completion'` |

### 5.2 Money and time

| #   | Scenario                                       | Expected behavior                                                             |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| E12 | Cancel exactly at a deadline                   | Deadline inclusive for the guest (cancel at or before 14:00 gets the tier)    |
| E13 | Time zone                                      | All deadlines in Asia/Manila at the property check-in time; server clock only |
| E14 | Last-minute booking (inside the last deadline) | Tiers apply; there is no grace window                                         |

| E16 | Nothing paid yet | Refund ₱0, nothing owed, copy avoids "you lose ₱X" |
| E17 | Only down payment paid, policy 50% | `refund = max(0, DP − 50% of stay)`; worked examples in tests |
| E18 | Guest paid less than the retained amount | Refund ₱0, no debt created |
| E19 | Security deposit paid | Collected at check-in; not part of a pre-check-in cancel. If paid and the host cancels after check-in, 100% back. |
| E20 | Pet / additional fees | Every paid amount follows the same policy |
| E21 | Voucher applied | Voucher released (existing); discount never paid out as cash; refund base uses `rate − discount` |
| E22 | Airbnb booking | DP/SD are 0; any paid fees follow the policy; no in-app guest cancel |
| E23 | Same-day stay (day use) | Check-in instant is the same day; tiers still work |
| E24 | Rounding | Whole peso, half up; breakdown sums to total |
| E25 | Host override above cash paid | Clamped to cash paid; UI explains |
| E26 | Host override below policy | Allowed with note + warning, logged `refund_below_policy` |
| E27 | Host cancels after check-in | Allowed (D6), default 0%, override + note required for any refund |
| E28 | Early departure | Goodwill refund record, status unchanged |
| E29 | No-show | Host cancel with `no_show`, initiator `guest`, excluded from host rate |
| E30 | Refund details change after "sent" | Locked; host can add a note, not rewrite the sent amount |
| E31 | Refund proof upload fails | Refund stays `pending`; retry offered; error surfaced |
| E32 | Currency | PHP only; all amounts rounded at the boundary |

### 5.3 Lifecycle and concurrency

| #   | Scenario                                              | Expected behavior                                                                                           |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| E33 | Double submit / two tabs / host and guest at once     | Conditional update on status, idempotent response, one refund record                                        |
| E34 | Direct API call to cancel after check-in (guest)      | Server rejects (shared guest cancellable set)                                                               |
| E35 | Direct API call to cancel a `COMPLETED` booking       | Server rejects                                                                                              |
| E36 | Request mode, host never responds                     | Reminder at 24h, request stays open until check-in, then expires; no auto-approve                           |
| E37 | Guest withdraws request                               | Request closed, badge removed, host notified                                                                |
| E38 | Host cancels while a request is open                  | Request resolved `approved`, one cancellation, one refund                                                   |
| E39 | Guest cancels while host is mid-transition            | Whichever commits first wins; the other gets `409` with fresh state                                         |
| E40 | Linked marketplace parking (unpaid)                   | Warn; parking follows its own rules; host prompted; no auto-cancel                                          |
| E41 | Linked marketplace parking (paid)                     | Warn; host handles the parking refund separately; stay cancel still allowed                                 |
| E42 | Booking cancelled, dates rebooked                     | Dates freed (existing), iCal export updated (existing), Google Calendar event removed (verify orchestrator) |
| E43 | Cancelled booking still has stay-guide / review links | Links stop working or show a cancelled state; no new emails                                                 |
| E44 | Guest email blank (OTA completion pending)            | Guest emails suppressed, recorded in side effects                                                           |
| E45 | Guest without an account                              | Booking access token from the trip link works the same as a signed-in owner                                 |
| E46 | Rate limiting / abuse                                 | Per-booking and per-IP limits on guest cancel and request endpoints                                         |
| E47 | Property archived or transferred                      | Cancellation still works from the existing booking; refund row keeps the original property id               |
| E48 | Booking already cancelled                             | Idempotent success for the same initiator; `409` for a conflicting action                                   |
| E49 | Refund row missing after a crash                      | Trip page and booking detail self-heal by recomputing and creating the row on read (host only for create)   |

---

## 6. Tasks

### Phase 1: policy engine v2

- [x] 1.1 Rewrite `_shared/cancellationPolicy.ts` (v2 types, presets, legacy mapping, normalize, validate, render, stable hash) and mirror in `ui/src/features/dashboard/org/lib/cancellationPolicy.ts`.
- [x] 1.2 Shared fixture table + Deno and Vitest parity tests (legacy mapping, validation, rendering).
- [x] 1.3 Remove the silent default; add `needsReview` handling.
- [x] 1.4 Update `propertySettingsValidation.ts`, `propertySettingsSeed.ts`, `propertyResidenceDefaults.ts`, clone groups, `propertySettingsCompletion.ts`, setup guide step.

### Phase 2: versions and snapshot

- [x] 2.1 Migration: `property_cancellation_policy_versions` + RLS + index.
- [x] 2.2 Migration: snapshot / accepted / `booked_at` / cancellation columns + backfill.
- [x] 2.3 Migration: immutability trigger + super-admin correction RPC.
- [x] 2.4 Existing bookings self-heal their snapshot on first read (`capturedFrom: 'backfill'`); migration backfills `booked_at`. No one-shot script needed.
- [x] 2.5 Settings save creates a version, logs `property.cancellation_policy_updated`, returns the new version id.
- [x] 2.6 No upcoming-bookings prompt: snapshots protect existing bookings silently.
- [x] 2.7 Capture snapshot in `submit-form`, `submit-form-completion`, `import-commit`, calendar-sync promotion (external marker). Version-mismatch `409`.

### Phase 3: refund calculator

- [x] 3.1 `_shared/cancellationRefund.ts` + UI mirror; fixtures for every money/deadline row in §5.
- [x] 3.2 Manila date math via existing helpers; property check-in time.

### Phase 4: server cancel paths

- [x] 4.1 Shared `GUEST_CANCELLABLE_STATUSES` / `HOST_CANCELLABLE_STATUSES` in `statusMachine.ts` (mirror `bookingStatus.ts`); enforce in `cancel-booking` and the orchestrator.
- [x] 4.2 Orchestrator writes `cancelled_at` / `cancelled_by` / reason for every path incl. calendar sync (`ota`).
- [x] 4.3 Migration: `booking_refunds` + `booking_cancellation_requests` + RLS.
- [x] 4.4 Extend `cancel-booking` (initiator, reason, override, notifyGuest); create refund record; idempotency.
- [x] 4.5 New `guest-cancel-booking`, `guest-cancellation-request`, `respond-cancellation-request`, `submit-guest-refund-details`, `record-booking-refund`. `servePublic` / `serveAdmin`, scope helpers, rate limits, `config.toml` JWT entries.
- [x] 4.6 Orchestrator side effects for the new emails; `static_files` for templates.
- [x] 4.7 Linked parking: warn + notify host; no automatic parking cancel.
- [x] 4.8 Refund reminder cron via `pg_cron` + `pg_net` (`serveCronPost`), plan-gated automation toggle.
- [x] 4.9 Activity log events: `booking.cancelled` (add initiator/reason/refund), `booking.cancellation_requested`, `booking.cancellation_request_approved|declined|withdrawn`, `booking.refund_recorded`, `booking.refund_sent`, `property.cancellation_policy_updated`.

### Phase 5: host UI

- [x] 5.1 New policy Manage sheet (presets, example with sample paid amount, custom tier builder) with `useGuardedClose`; reuse in Page Editor.
- [x] 5.2 No "new bookings only" confirm. Snapshots protect existing bookings silently. Copy-to-properties still relies on the content-hash check on submit.
- [x] 5.3 Booking detail: policy row from snapshot, free-cancellation chip, "policy changed since booking" hint.
- [x] 5.4 Cancel booking sheet (who/why/preview/override/notify) replacing the plain confirm.
- [x] 5.5 Cancellation request card + list badge + notification entries. Filter chip deferred.
- [x] 5.6 Refund card on cancelled bookings (status, guest details, mark sent, proof upload).
- [x] 5.7 Superhost uses `cancelled_by = 'host'` only. Finance refund outflows and the guest/host analytics split are deferred.
- [x] 5.8 Permissions catalog: refund actions reuse `bookings.detail.workflow:edit` (no new leaf).

### Phase 6: guest UI

- [x] 6.1 Listing page schedule card with the full timeline. Date-specific example deferred.
- [x] 6.2 Booking form policy card with stay-specific dates + required agreement checkbox; handle `409 policy_changed`.
- [x] 6.3 Trip page: Cancellation card (timeline from snapshot), Cancel / Request / Withdraw flows in a bottom sheet, cancelled state with refund status, refund details form.
- [x] 6.4 Remove the dev-only cancel button from `GuestForm.tsx`.
- [x] 6.5 AI receptionist, inbox AI context and quick replies: use the booking's snapshot and computed "free until" date; never promise a refund amount the calculator didn't produce.

### Phase 7: docs, support, QA

- [x] 7.1 `.cursor/rules/booking-workflow.mdc` (side-effects row for CANCELLED, new columns, cancellable sets) + `booking-workflow` skill.
- [x] 7.2 `docs/architecture/overview.md`, `docs/PROJECT.md` (new endpoints, tables, cron).
- [x] 7.3 Route guides: `org/property/settings.md`, `org/property/public-pages.md`, bookings detail guide, `trip.md`, `properties.md`, form guide.
- [x] 7.4 Support content: Host-facing knowledge Q&A + `docs/guides/support/faqs.md`; run `check:support-content` and `check:ai-knowledge-coverage`.
- [x] 7.5 `plans-feature-matrix.md` (no gate) and team permission docs.
- [x] 7.6 Manual QA script in `docs/guides/testing/` covering §5.

### Testing

- Deno: policy engine, refund calculator (fixture table), snapshot capture in `submit-form`, cancel endpoint guards and idempotency, request lifecycle, trigger immutability (integration).
- Vitest: client mirrors, tier builder validation, timeline copy.
- Playwright mocked E2E (deferred): guest instant cancel, guest request → host approve, host cancel with override, policy change confirm, booking form `409` re-accept. Deno + Vitest parity cover the logic today.
- Mobile check at 375/768/1024 for every new sheet.

### Rollout order

Phase 1 → 2 (snapshot first, so every booking from that day on is protected even before guest cancel ships) → 3 → 4 → 5 → 6 → 7. Phases 1–3 can ship without a flag because they do not change guest-visible behavior beyond the agreement checkbox. Guest cancel can ship behind a property setting defaulting to request mode for the first release if a softer launch is wanted.

---

## 7. Out of scope (for now)

- Automatic payouts (needs guest payments via PayMongo first; see intake "Host/Guest booking payment e2e").
- Seasonal or date-range policy overrides.
- Non-refundable discounted rate option alongside a flexible rate (needs rate plans in pricing).
- Host cancellation penalties/fees beyond metrics.
- Extenuating-circumstances program with document review (host can already refund more via override).
- Automatic cancellation/refund of linked marketplace parking.
