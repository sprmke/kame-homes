---
title: 'Two-way reviews — manual test script'
status: active
tags: [guides, testing, reviews]
updated: 2026-10-19
---

# Two-way reviews — manual test script

Companion to [`org/property/reviews.md`](../routes/org/property/reviews.md), [`account/reviews.md`](../routes/account/reviews.md), [`org/reviews.md`](../routes/org/reviews.md), and [`sd-form.md`](../routes/sd-form.md). Plan: [`../../workflow/for-testing/two-way-reviews.md`](../../workflow/for-testing/two-way-reviews.md).

## Preconditions

- Local stack (`./dev.sh`) with migrations through `20261316128000_review_automation.sql`, or hosted dev after `bun run deploy:supabase:dev`.
- A property booking that can reach check-out (`READY_FOR_CHECKOUT` / `PENDING_SD_REFUND` / `COMPLETED`).
- Guest email you can read. Host user with `reviews:view` plus `reviews.guests:edit` / `reviews.responses:edit` for write tests.
- Pro+ (`growth` or above) for auto-review and Draft with AI.
- Optional locally: `REVIEW_LIFECYCLE_CRON_SECRET` in `supabase/.env.local` if you want the cron header required. **Hosted dev and prod:** required, set as both the Edge secret and Vault `review_lifecycle_cron_secret` (same value). Check: an unauthenticated `POST review-lifecycle-cron` must return 401.

## Automated live run (do this first)

```bash
bun run test:reviews:live   # needs ./dev.sh (functions on :54321)
```

`supabase/functions/tests/reviewsLifecycleLocal.integration_test.ts` seeds a throwaway stay, guest account and scoped org member on `kame-home` (override with `REVIEWS_LIVE_PROPERTY_SLUG`), then drives the real handlers: review page + access tokens (forged token → 401), guest To write, CAPTCHA block on the guest submit, double-blind (host cannot read the unpublished review), screening, host submit → both sides publish, To write KPI drops, edit lock, About you without internal notes, guest and host responses, host report scope, super-admin uphold + second decision 409, org listing scope. It deletes everything it created. Emails go to Resend's `delivered+…@resend.dev` sink.

The sections below cover what the automated run cannot: the real Turnstile widget, email rendering, the cron schedule, auto-review timing, and the UI on a phone.

## Window timing (local DB)

Windows open at check-out (status `READY_FOR_CHECKOUT` or 00:00 Manila on the check-out date) and close 14 days later at 23:59:59 Manila.

```sql
-- Find the window
SELECT booking_id, opens_at, closes_at, published_at, closed_reason, auto_review_paused
FROM booking_review_windows
WHERE booking_id = '<booking-id>';

-- Close the window now (cron path)
UPDATE booking_review_windows
SET closes_at = now() - interval '1 minute'
WHERE booking_id = '<booking-id>';

-- Re-open for write tests
UPDATE booking_review_windows
SET closes_at = now() + interval '7 days',
    published_at = NULL,
    closed_reason = NULL
WHERE booking_id = '<booking-id>';
```

Then POST `review-lifecycle-cron` (see Cron below). Expired windows force-publish whichever side exists.

Bookings that checked out more than 14 days before launch do not get a backfill window. Recent check-outs (≤ 14 days) do. The cron fallback scans property bookings in `READY_FOR_CHECKOUT` / `PENDING_SD_REFUND` / `COMPLETED` updated in the last 14 days, then skips any row whose computed window (`check-out + 14 days`, end of day Manila) is already closed. Parking bookings are not eligible.

## Guest write + skip (D3 / D4)

1. Complete a stay that uses the SD stepper. Step 1 (review) shows six category ratings. **Not now** reaches voucher / refund without a review.
2. `/guest-review?bookingId=` works for any property stay past check-out (direct, Airbnb, SD or no SD, including `PENDING_SD_REFUND`). It also has Not now. A parking booking id returns "Review unavailable".
   2a. SD form with a closed window and no review: step 1 shows **Continue** and reaches the refund step. With a saved draft: **Continue** moves on without re-saving, and is disabled while the draft has unsaved edits.
   2b. Open a review email link in a private window with `GUEST_BOOKING_ACCESS_ENFORCE=true`: the page loads (the link carries `?access=`). From `/account/reviews`, **Write review** loads the same way without a token in the URL.
3. `/account/reviews` tab **To write** still lists the stay until the window closes.
4. Claim the stay voucher after skip. No `review_required` error.
5. Submit overall + 6 categories. Text optional. Edit until published. After both sides publish (or the window closes), edit returns 409.

## Double-blind

1. Guest submits. Host Reviews **Received** stays empty. Guest **About you** does not show host text.
2. Host submits from booking detail **Review guest**. Guest still cannot read the host review.
3. After the second submit, both sides publish together. Host sees the guest review; guest sees the host review. Listing average updates only after publish.
4. Bells (`review_received`, `review_due`) and emails never include the unpublished counterpart text.

## Host Reviews page

1. `/org/:orgSlug/property/:propertySlug/reviews` — tabs Received / To write / Written, KPIs, cursor pagination.
2. Respond (one public response). Read-only roles cannot respond. The guest gets one email on the first response; editing it sends nothing.
   2a. To write: check out three bookings on the same day so their windows close at the same second, with more than 20 waiting. **Load more** returns every booking once. Writing a review removes it from To write and lowers the KPI.
3. Report a published review (reason + ≥ 30 characters). Super-admin **Approvals** Type = Reviews can remove it. Removed rows drop from averages.

## Guest account + listing

1. `/account/reviews`: To write / By you / About you.
2. Public listing shows overall after **3** ratings ("New" before that). Category bars when ≥ 3 Kame reviews have categories. Host responses render under published reviews. Sort sheet on phone.

## Org rollup + host public page

1. `/org/:orgSlug/reviews` needs `org.reviews:view`.
   1a. Sign in as an org member limited to one assigned listing: KPIs, the property table and the feed show only that listing. Passing another property's `property_id` returns an empty feed.
2. `/hosts/:orgSlug` shows org average + recent published guest reviews only.

## Auto-review (Pro+)

1. Reviews page **Auto-review** card is preview-open on Free. Enable / Save / Draft / Pause open the upgrade modal.
2. On Pro+: enable, keep ≥ 3 templates (`{{guest_first_name}}`, `{{property_name}}`), delay 1–13 days. Save.
3. Pause from the booking **Review guest** card. Cron skips that booking until resumed.
4. Skip flags: constructive guest tags or overall ≤ 3, SD refund below expected deposit, open maintenance overlapping the stay. A skip is stored on the window (`auto_review_skipped_reason`); the next cron run must not count it again.
5. Cron actor is `cron`. Internal note on auto-reviews is `Auto-review`. One `system.cron_run` row per org that had activity in the run, with that org's counts only (no per-booking activity, no rows for idle orgs).

## Draft with AI

1. Host review sheet and response sheet: **Draft with AI** fills the textarea. It never posts.
2. Response draft 409s until the guest review is published.
3. Uses AI credits (`review_draft`). Unpublished counterpart text is not sent to the model.

## Cron run-now

Local functions serve:

```bash
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/review-lifecycle-cron" \
  -H "Content-Type: application/json" \
  -H "X-Review-Lifecycle-Cron-Secret: ${REVIEW_LIFECYCLE_CRON_SECRET:-}" \
  -d '{}'
```

Expect JSON with `scanned`, `published`, `cancelled`, `requestsSent`, `remindersSent`, `hostDueNotified`, `windowsEnsured`, `autoReviewsSubmitted`, `autoReviewsSkipped`, `organizations`. Request/reminder emails send once per window (markers on `booking_review_windows`) and are skipped when the guest already reviewed.

## Emails

| Event                | Guest mail                                                        |
| -------------------- | ----------------------------------------------------------------- |
| Window open          | How was your stay… (if `emailReviewRequest`)                      |
| 3 days left          | Reminder (if `emailReviewReminder`)                               |
| Pair published       | Your review is live                                               |
| Host public response | {Property} responded to your review (first response only)         |
| Report decision      | Removed or kept; to the review author and the reporter, once each |

Host alerts are Notification Center only in v1 (`review_due`, `review_received`, `review_response_received`).

## Cross-org reputation

1. Guest with a published host review requests a stay at **another** org.
2. Booking detail **Guest reputation** shows average, categories, would-host-again rate, tags, and recent text with the authoring stay generalized to an area.
3. Internal notes from org A never appear at org B.

## Static checks

```bash
bun run type-check && bun run lint
bun run test
bun run test:edge && bun run test:edge:handlers
bun run test:e2e:smoke
bun run test:e2e:ci
```
