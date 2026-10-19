# Phase 7 booking flow on hosted dev — 2026-10-19

Real browser (Cursor built-in Chromium) on `dev.kamehomes.space`, QA guest then QA owner. Turnstile passed for real.

## Captcha (P0-1, dev)

| Probe                                | Result                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `submit-form` without `captchaToken` | 400 `Human verification is required.`                               |
| `submit-form` with a bogus token     | 400 `Human verification failed. Please retry.` (siteverify reached) |
| `claim-sd-voucher` without token     | 400 captcha required                                                |
| Real browser submit                  | widget passes invisibly, Submit enables                             |

`CAPTCHA_MODE=enforce` + `TURNSTILE_SECRET_KEY` live on dev Edge. P0-1 done on **dev**; prod still open.

## Guest booking (`/properties/qa-monaco-1801/form`)

1. Signed-in guest required (email code or Google). Session minted from a one-time admin magic link.
2. Dev prefill: 5 guests, sample IDs and receipt, developer controls panel (dev build only).
3. Step 1 let 5 guests continue although the reminder says max 4 adults / 0 children.
4. Submit → **400** `Failed to process form data: Please note that this unit allows a maximum of 4 adults and 0 children…`. Toast "Could not submit form" shows that text.
5. Removed 5th guest → **200**, success page `Booking Confirmed!` with summary.

Stored row: `PENDING_REVIEW`, guest email, 7 nights, receipt + 4 ID images in **private** buckets (`payment-receipts`, `valid-ids`; stored public-style URL returns **400** anonymously; path `<propertyId>/<file>`). `activity_log` `booking.created` (actor `guest`). Notification `booking_pending_review`. Bell 1 unread.

## Host workflow (`/org/readiness-qa-stays/property/qa-monaco-1801/bookings/:id`)

- Title `QA Monaco 1801 - Booking: Jane B. Smith`. Workflow rail step 1 of 6.
- Manual review checkbox → pricing form (booking rate ₱20,193, DP ₱1,500, SD ₱1,500).
- **Proceed to Pending Documents** confirm explains the Free-plan email gate. Confirm → `update-booking-details` 200, `transition-booking` 200, status `PENDING_DOCUMENTS`, GAF request PDF generated, toasts `Moved to Pending Documents` + `Not sent automatically on your plan: GAF request email to Azure, Booking acknowledgement email … Upgrade`.
- Audit: `booking.details_edited` ×2, `booking.status_changed` (`manual: true`, `org_owner`).

## Findings

| ID     | Sev                 | Finding                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-119 | **blocker (money)** | Guest form charges **₱1,500 × nights** (`GUEST_DOWN_PAYMENT_RATE_PER_NIGHT`, hard-coded for every property). Host side uses the property's flat `default_down_payment` (₱1,500). This booking: guest told to pay and uploaded a receipt for **₱10,500**; host record DP ₱1,500, balance ₱18,693. Product decision needed: per night or host's flat setting. |
| PR-120 | medium              | `guest-chat-attachments` bucket is **public**. Guests can share IDs in chat. Confirm paths are unguessable or move to signed URLs.                                                                                                                                                                                                                          |
| PR-121 | low                 | Step 1 does not block guests over capacity; the error only appears at final submit, with a technical `Failed to process form data:` prefix. In the other session's in-progress guest-limit files.                                                                                                                                                           |
| PR-122 | low                 | Proceed dialog copy: "This will: **Saves** your changes…".                                                                                                                                                                                                                                                                                                  |
| PR-123 | low                 | Ticking the manual review checkbox alone writes `booking.details_edited (7 fields)` before any host edit. Noisy audit trail.                                                                                                                                                                                                                                |

Not walked yet: Pending Documents → GAF approval (needs Azure inbound email or manual approved PDF upload), Ready for check-in, check-out, SD refund form, completion.
