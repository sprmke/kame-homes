# Cancellation policy and refunds — manual QA

Covers the enforceable policy, booking-time snapshot, guest/host cancel flows, refund tracking,
and the edge cases in
[`cancellation-policy-and-process.md`](../../workflow/in-progress/cancellation-policy-and-process.md) §5.

Run on a local or staging property with at least one paid and one unpaid booking. Use a policy
with a short deadline so you can cross it in one sitting.

## 1. Policy setup

1. Property Settings → Cancellation policy → Manage.
2. Pick each preset. The example updates with exact sample dates and peso refunds for a guest who paid ₱2,000.
3. Pick Custom. Add 3 rows out of order. They sort by days before. Set a refund that increases
   closer to check-in → the save is blocked with a clear message.
4. Pick Non-refundable → the warning says the down payment is not returned. Save.
5. Save. No "new bookings only" prompt appears.
6. Activity log shows `property.cancellation_policy_updated`; `property_cancellation_policy_versions`
   has a new row.
7. Close the sheet with unsaved edits → Save / Discard / Keep editing.
8. Confirm the sheet has no free-cancellation window, fee rules, instant/request setting, or note.

## 2. Booking-time snapshot

1. Open the guest form on a property with a policy. The last step shows the policy card with exact
   deadline dates and the agreement checkbox.
2. Try submitting without ticking → blocked.
3. In another tab, change the property policy. Submit the first tab → `409 policy_changed`, values
   kept, policy reloaded, checkbox cleared. Re-tick and submit.
4. Check `guest_submissions.cancellation_policy_snapshot` and
   `cancellation_policy_accepted_at` on the new row.
5. Edit the booking from the trip page → snapshot unchanged.
6. Change the property policy again → the trip page still shows the original policy.

## 3. Guest instant cancel

1. Policy = Flexible, guest paid only the down payment, cancel before the first deadline.
2. Trip page → Cancel booking → refund preview equals the down payment, retained 0.
3. Confirm → status `CANCELLED`, `cancelled_by = guest`, reason stored, `booking_refunds` row
   created with `awaiting_guest_details`.
4. Guest gets the cancellation email; host gets the host email; in-app bell fires.
5. Refund details form saves method/account; status becomes `pending`.
6. Booking detail → Mark refund sent needs a receipt link; after saving, status `sent`, guest email
   sent, activity `booking.refund_sent`.

## 4. Guest request → host approve

1. Policy = unset or migrated free text; or the guest has already paid the balance.
2. Trip page → Request to cancel → request created, badge on the booking list, host notification.
3. Guest gets "request received"; host gets the request email.
4. Guest withdraws → request `withdrawn`, badge gone.
5. Request again → host booking detail → Approve → cancel sheet prefilled with the guest reason →
   confirm → `CANCELLED`, refund row, request `approved`.
6. Repeat and Decline with a message → request `declined`, guest email, booking unchanged.

## 5. Host cancel and overrides

1. Host cancels a paid pre-check-in booking → refund preview is 100% of cash paid.
2. Override lower → warning + required note; activity metadata records the refund.
3. Override higher than paid → clamped with a warning.
4. Cancel a `READY_FOR_CHECKOUT` booking → allowed, default 0%, override + note required.
5. No-show: host cancel with reason `no-show` → `cancelled_by = guest`, excluded from the host
   cancellation rate.

## 6. Server guards

1. `POST guest-cancel-booking` directly after check-in → rejected.
2. `POST guest-cancel-booking` on a `COMPLETED` booking → rejected.
3. `POST cancel-booking` twice → second call is idempotent or returns a clear 409.
4. Guest and host cancel at the same time → one wins, the other gets a fresh-state error.
5. OTA/calendar-synced booking → no guest cancel button; direct call rejected.
6. Attempt to change `cancellation_policy_snapshot` with SQL → trigger blocks it.

## 7. Money and time

1. Cancel exactly at the deadline (14:00 Asia/Manila) → the tier applies.
2. Book 3 days before check-in → the last deadline has passed, so the fallback applies.
3. Voucher applied → refund base excludes the discount.
4. Every paid amount follows the policy. The security deposit is collected at check-in, so it is not part of the pre-check-in example.
5. Unset policy → guest sees "Ask the host", request mode, host decides.
6. Down payment only under Firm 50% → refund is 50% of the down payment, not ₱0.
7. Custom 0% schedule → the non-refundable warning shows on the booking form and trip page.
8. Nothing paid → refund ₱0, no "you lose" copy.

## 8. Mobile

375 / 768 / 1024 px: the guest cancel sheet is a bottom sheet, the host cancel sheet is a bottom
sheet, touch targets ≥ 44px, no horizontal scroll, the policy timeline wraps cleanly.
