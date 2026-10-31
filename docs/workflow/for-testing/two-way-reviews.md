---
title: 'Two-way reviews — guests rate stays, hosts rate guests'
stage: for-testing
status: for-testing
kind: plan
tags: [workflow, planned, reviews, guest-review, host, guest-account, trust]
updated: 2026-10-19
---

# Two-way reviews — guests rate stays, hosts rate guests

## Goal

Turn today's one-way, SD-refund-embedded guest review into a complete **two-way review system**, modeled on Airbnb / Vrbo and adapted to Kame Homes:

1. **Guest → stay** (existing, refined): overall rating + six category ratings, tags, text, photos, private note to the host. Reachable from every post-stay surface, not only the SD refund stepper.
2. **Host → guest** (new): overall + three categories (cleanliness, communication, house rules), "would host again", strengths / issue tags, a review the guest can read, a private note to the guest, and a team-only internal note.
3. **Fairness rules**: a 14-day review window that opens at check-out, **double-blind** publishing (neither side sees the other's review until both submit or the window closes), edit-until-published, one public response per review, and a dispute (report review) path to super-admin.
4. **Host screening value**: when a guest who has stayed on Kame Homes submits a new booking request, the host sees that guest's reputation (average, categories, would-host-again rate, recent reviews) on the booking detail.
5. **New screens**: property **Reviews** page for hosts, booking-detail **Review guest** card + **Guest reputation** card, guest **/account/reviews** page, redesigned write-review flows, and a redesigned public rating summary on the listing page. All mobile-native (bottom sheets, ≥44px targets, 375px first).

It also fixes three issues found in the current implementation (see [Current state](#current-state-and-gaps)): the SD refund cannot be reached without leaving a review, the voucher is gated on the review, and the public rating/count is computed from only the newest 20 reviews.

---

## Competitive UX brief

**Job:** after a stay, both sides leave honest feedback; future guests choose stays from it, future hosts screen guests from it.
**Roles:** guest (reviewer of the stay, subject of a host review) · host / team member (reviewer of the guest, responder) · super-admin (dispute moderator).

### Airbnb (closest analog, both directions)

- **Window + double-blind.** Both parties are prompted on check-out day and have **14 days**. Reviews publish when **both** submit or the window ends, whichever comes first. No late reviews. Reviews possible for reservations cancelled **on/after** check-in day; not for ones cancelled before. ([help/article/995](https://www.airbnb.com/help/article/995), [help/article/13](https://www.airbnb.com/help/article/13))
- **Guest → listing.** Overall 1–5 (not an average of categories) + six categories: **Cleanliness, Accuracy, Check-in, Communication, Location, Value**. Public review + **private note to host**. Average shows in search **after 3 ratings**. Category ratings and notes are private to host + Airbnb; public sees the overall and category averages. ([resources: why reviews matter](https://www.airbnb.com.au/resources/hosting-homes/a/why-reviews-matter-41))
- **Host → guest.** Optional, but if submitted the host must write a **public review** (shown on the guest profile). 1–5 on **Cleanliness, House rules, Communication**, averaged into the stay rating. "**What they did well**" highlights (tick) and, on low categories, "**things to keep in mind**" (warning icon). Hosts see a guest's detailed ratings **only when that guest requests/books with them**. ([help/article/3287](https://www.airbnb.co.uk/help/article/3287))
- **Edit / remove.** Edit only before the other party submits or the window ends. Author can remove a published review within 30 days. Reviewee can file a **removal request** (reason + details + evidence), decided in ~48h, max 2 requests per review. ([help/article/367](https://www.airbnb.com/help/article/367), [help/article/3582](https://www.airbnb.com/help/article/3582))
- **Policy.** No fake reviews; **no incentives, pressure or extortion** (explicitly: reviews "may not be provided or withheld in exchange for something of value, like a discount, refund…"); no retaliation; content policy. Disagreement with a star rating is not grounds for removal. ([help/article/2673](https://www.airbnb.com/help/article/2673))
- **Response.** Reviewee can post **one public response**, shown below the review. ([help/article/1423](https://www.airbnb.com/help/article/1423))
- **Display.** Sort by most relevant / recent / highest / lowest, tag chips ("highlights"), category averages, rating distribution; "Guest favorite" for top listings.

### Vrbo

- Two-way. Hosts rate **overall, cleanliness, communication, house rules** (1–5). Once one party submits, the other has **14 days**, private until both submit or time ends. Overall deadline 6 months. **No edits after submit**; removal via support. **Guest ratings are not public**: only hosts see them; guests see their own average. Host reminder email **3 days** after check-out; check-out-day feed card. ([help.vrbo.com](https://help.vrbo.com/articles/How-do-I-submit-a-review-about-my-travelers), [Hostaway comparison](https://support.hostaway.com/hc/en-us/articles/55698373676827-Guest-and-Host-Reviews-Compared-Airbnb-Vrbo-Booking-com-and-Expedia))
- Partners may **never** offer incentives; Vrbo itself may, regardless of sentiment, labelled as incentivized.

### Booking.com

- **One-way** (guests only). Overall 1–10 is the only required field; category scores (cleanliness, comfort, value, facilities, location, staff, Wi‑Fi) are optional and don't feed the overall. 90-day window. Score weighted by recency (2025). Property can **reply**; replies moderated (up to 72h). ([partner help: scores](https://partner.booking.com/en-us/help/property-guest-experience/reviews/everything-you-need-know-about-guest-review-scores), [replying](https://partner.booking.com/en-us/help/guest-reviews/general/responding-guest-reviews))

### PMS leaders (Hostaway, Hospitable, Guesty)

- **Auto-reviews of guests**: rule/template-based 5-star reviews scheduled 1–13 days after check-out, randomized template pools (min 3) with `{{guest_first_name}}`-style tokens, editable before send, pause per stay. Hospitable adds "bad guest" timing control and AI-drafted personalized reviews. ([Hostaway auto-reviews](https://support.hostaway.com/hc/en-us/articles/360060848813-Host-Reviews-Auto-reviews), [Hospitable AI reviews](https://help.hospitable.com/en/articles/9394127-how-can-i-use-ai-to-publish-reviews-for-my-airbnb-guests))
- **AI-drafted responses** to guest reviews, shown as editable drafts in the guest's inbox thread. ([Hospitable replies](https://help.hospitable.com/en/articles/9257136-replying-to-guest-reviews-for-airbnb-and-booking-com-with-ai))
- **Reviews hub**: one dashboard for ratings, response rate, trends, alerts on new reviews. ([Guesty](https://www.guesty.com/features/reviews-management/))

### Legal context

- US FTC Consumer Reviews Rule (effective 2024-10-21, 16 CFR 465): bans incentives conditioned (expressly or implicitly) on sentiment and **review suppression**; incentives not tied to sentiment are allowed but should be disclosed. Showing "all reviews" while hiding negative ones is a violation. ([eCFR 465](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465), [FTC Q&A](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers))
- Philippines: Consumer Act (RA 7394), Internet Transactions Act (RA 11967) and Data Privacy Act (RA 10173) apply. Host-written reviews about a guest are personal data; sharing them across organizations needs a stated purpose (booking screening), disclosure in Terms/Privacy, and an access path for the guest (they can read reviews about them). Legal sign-off is a Phase 0 task.

### Adopt / adapt / skip for Kame Homes

| Pattern                                                                    | Decision                                                                           | Why                                                                                                                          |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 14-day window from check-out, double-blind                                 | **Adopt**                                                                          | Industry standard; prevents retaliation; one rule for both sides                                                             |
| Guest: overall + 6 Airbnb categories                                       | **Adopt**                                                                          | Lets us re-introduce the category bars removed in the 2026-08-29 refinement (they were removed only because no data existed) |
| Host: overall + cleanliness, communication, house rules + would host again | **Adopt** (Vrbo-style explicit overall + Airbnb categories)                        | Overall is a single honest tap; categories drive screening ticks/warnings                                                    |
| Host review text required when reviewing                                   | **Adapt**: text required only when overall ≤ 3                                     | Lower friction for good guests; context mandatory when it matters                                                            |
| Guest reviews of guests public on a profile                                | **Skip** (Vrbo model): visible only to the guest and to hosts the guest books with | Kame guest profiles are private; minimizes PII exposure                                                                      |
| Edit until published                                                       | **Adopt**                                                                          | Simple, fair                                                                                                                 |
| Author removal within 30 days                                              | **Skip v1**                                                                        | Support/super-admin path covers it; less surface                                                                             |
| One public response per review (both directions)                           | **Adopt**                                                                          | Standard; editable by the responder                                                                                          |
| Removal requests → super-admin                                             | **Adopt**, reuse `/admin/approvals` Type = Reviews                                 | Queue already moderates external reviews                                                                                     |
| Booking.com 1–10 scale                                                     | **Skip**                                                                           | Keep 1–5 everywhere (matches Superhost 4.8 threshold, external reviews)                                                      |
| Auto-review rules + AI drafts                                              | **Adopt later**, Phase 7, plan-gated                                               | Big time saver for multi-property hosts; not needed for launch                                                               |
| "Guest favorite" badge                                                     | **Skip v1**                                                                        | Superhost program already covers recognition                                                                                 |

---

## Current state and gaps

### What exists

| Piece                                                                                                                                 | Where                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table `guest_reviews` (one per booking, immutable, `star_rating`, `review_text`, `media_urls`, `feedback_tags`, `guest_display_name`) | `supabase/migrations/20260714150000_guest_reviews.sql`, `20260714160100_guest_reviews_feedback_tags.sql`                                                                                                                                                                                       |
| Eligibility (`sd_refund` path vs `airbnb_post_stay` path)                                                                             | `supabase/functions/_shared/guestReviewEligibility.ts`                                                                                                                                                                                                                                         |
| Submit (public, anti-spam, access token)                                                                                              | `supabase/functions/submit-guest-review/index.ts`, `_shared/guestReviewService.ts`                                                                                                                                                                                                             |
| Bootstrap                                                                                                                             | `get-sd-form`, `get-guest-review`                                                                                                                                                                                                                                                              |
| Tags catalog (server + UI mirror)                                                                                                     | `_shared/guestReviewFeedbackTags.ts`, `ui/src/features/guest/sd-form/lib/guestReviewFeedbackTags.ts`                                                                                                                                                                                           |
| Guest write UI                                                                                                                        | `ui/src/features/guest/sd-form/components/{SdFormReviewSection,GuestReviewStarRating,GuestReviewFeedbackPills,GuestReviewMediaUpload}.tsx`, pages `SdFormPage.tsx`, `GuestReviewPage.tsx`                                                                                                      |
| Public display (merged with approved external reviews)                                                                                | `_shared/publicPropertyService.ts`, `ui/.../property-detail/PropertyReviews.tsx`, showcase carousel                                                                                                                                                                                            |
| Trip page "Leave a review" (Airbnb zero-SD path only)                                                                                 | `_shared/guestTrip.ts`, `ui/src/features/guest/trip/lib/guestTripLinks.ts`                                                                                                                                                                                                                     |
| Consumers of `guest_reviews`                                                                                                          | Superhost (`_shared/superhostMetrics.ts`), analytics (`_shared/analyticsService.ts`), marketing review studio (`list-property-guest-reviews`, `_shared/marketingGuestReviews.ts`), search index (`20261316126800_public_listing_search_index.sql` line ~552)                                   |
| Related plans                                                                                                                         | [`guest-review-facebook-cta.md`](./guest-review-facebook-cta.md) (planned), [`guest-trust-safety-reporting.md`](./guest-trust-safety-reporting.md) (planned; host-reports-guest explicitly deferred), [`../done/guest-review-module-refinement.md`](../done/guest-review-module-refinement.md) |

### Gaps and bugs

1. **No host → guest review** at all; no guest reputation anywhere in the host dashboard.
2. **SD refund gated on review.** `SdFormPage` step 1 (review) has no skip; step 3 (refund details) is only reached after a review or an existing voucher. Withholding a deposit refund behind a review is the "pressure / something of value" pattern Airbnb bans and a consumer-protection risk. **Must decouple.**
3. **Voucher gated on review** (`claim-sd-voucher` returns `review_required`). Not sentiment-conditioned, so allowed under FTC 465.4, but the incentive must be disclosed or decoupled (see Decision D3).
4. **Public count/average truncated**: `listPublicGuestReviews(propertyId, 20)` feeds both `reviewCount` and `averageGuestReviewRating` in `publicPropertyService.ts`, so a property with 50 reviews shows "20 reviews" and an average of the newest 20 (+ externals). Fix with a SQL aggregate.
5. **No host response**, no host Reviews page, no notification when a review arrives.
6. **No review window**: the Airbnb path accepts reviews forever after check-out; the SD path only while the stepper is reachable.
7. **Only bookings reaching the SD stepper or the Airbnb zero-SD path can review.** A direct booking with SD that the host completes manually (`READY_FOR_CHECKIN → PENDING_SD_REFUND` force edge) never gets a review prompt.
8. Guest reviews publish immediately (no double-blind), so adding host reviews without a window would invite retaliation.

---

## Locked decisions (D3, D5, D9 and Airbnb-sourced host reviews confirmed 2026-10-19; rest are defaults to sanity-check in Phase 0)

| #   | Decision                        | Default                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Window                          | Opens when the booking reaches `READY_FOR_CHECKOUT` **or** at 00:00 Manila on the check-out date, whichever is first. Closes **14 days after the check-out date, 23:59:59 Manila**. Constant `REVIEW_WINDOW_DAYS = 14` in one shared module (edge + UI mirror).                                                                                                                                                                                    |
| D2  | Double-blind                    | Both reviews stay hidden from the counterpart until both submitted or the window closes. Publishing is a single atomic DB step per booking.                                                                                                                                                                                                                                                                                                        |
| D3  | Voucher incentive               | **Decouple from the review**: the surprise voucher becomes a thank-you for completing the stay, claimable after the review step is submitted **or skipped**. If product wants to keep it review-gated, the alternative is to label those reviews "Reward received" publicly. Default: decouple.                                                                                                                                                    |
| D4  | SD refund                       | Review step gets a visible **Skip** (`Not now`). Refund form never depends on a review. Skipped guests keep the review available in Trips / `/account/reviews` until the window closes.                                                                                                                                                                                                                                                            |
| D5  | Host review visibility          | Visible to: the reviewed guest (after publish), any org whose property the guest **requests or books** (shown on booking detail, from `PENDING_REVIEW` onward), and the authoring org forever. **Internal note** never leaves the authoring org. Not public on the web.                                                                                                                                                                            |
| D6  | Guest identity for host reviews | `guest_user_id` when the booking is linked to an account, else `guest_identity_key = sha256(lower(trim(guest_email)) + REVIEW_IDENTITY_PEPPER)`. Reputation lookups match on either. Phone is not used (format drift).                                                                                                                                                                                                                             |
| D7  | Eligible bookings               | Property bookings only (parking out of scope). Status `READY_FOR_CHECKOUT`, `PENDING_SD_REFUND`, `COMPLETED`, or `READY_FOR_CHECKIN` with check-out ≤ today Manila. Excluded: `CANCELLED`, `IMPORTED`, `PENDING_*` pre-stay, bookings older than the window. Guest side additionally requires a `guest_email` (unclaimed calendar-sync bookings cannot be reviewed by the guest; the host still can, internal-only until a guest identity exists). |
| D8  | Edits                           | Author can edit until publish. After publish: no edits; only one response by the reviewee. Responses editable/deletable by the responder (logged).                                                                                                                                                                                                                                                                                                 |
| D9  | Required fields                 | Guest: overall + 6 categories (one tap each). Text optional; if provided ≥ 20 chars. Host: overall + 3 categories + would-host-again. Text required when overall ≤ 3 (≥ 30 chars).                                                                                                                                                                                                                                                                 |
| D10 | Rating display                  | Property average uses **overall** ratings of published, non-removed Kame reviews + approved external reviews (current merge rule kept). Show "New" instead of a number until **3** ratings. Category averages only from Kame reviews, shown when ≥ 3 Kame reviews have categories.                                                                                                                                                                 |
| D11 | Existing rows                   | Backfill all current `guest_reviews` as `published` (`published_at = created_at`, source `legacy`). No categories.                                                                                                                                                                                                                                                                                                                                 |
| D12 | Removal                         | Super-admin only, via report queue. Reasons follow Airbnb's policy list. Max 2 reports per review per side. Removed reviews vanish from every aggregate and surface; author is emailed.                                                                                                                                                                                                                                                            |
| D13 | Plans                           | Core two-way reviews: **free on all tiers** (platform trust; reputation is only useful if universal). Phase 7 automation (auto-review rules, AI drafts): new plan key `reviewAutomation`, Pro+.                                                                                                                                                                                                                                                    |
| D14 | Team RBAC                       | New property leaves `reviews:view`, `reviews.guests:edit`, `reviews.responses:edit` (+ org mirror for the org rollup). Guest reputation card on booking detail rides on `bookings:view`.                                                                                                                                                                                                                                                           |
| D15 | Language/PII in reviews         | Public text and responses reject phone numbers, emails and URLs (server-side regex in `_shared/reviewContentPolicy.ts`), max lengths: review 2,000 chars, private note 1,000, internal note 1,000, response 1,000.                                                                                                                                                                                                                                 |

---

## Scope

### In

- Data model: extend `guest_reviews`; new `host_guest_reviews`, `booking_review_windows`, `review_reports`; summary RPCs; RLS; notification types.
- Server: shared eligibility/window/publish logic, 12 edge functions (below), one cron, orchestrator side effect on check-out, consumers updated to "published only".
- Guest UI: redesigned write-review flow (shared by SD stepper, `/guest-review`, trip page, email links, account), `/account/reviews`, trip page review states, public listing rating summary + response display + sort.
- Host UI: property **Reviews** page, booking-detail **Review guest** card + **Guest reputation** card, write-guest-review sheet, respond sheet, report sheet, bell notifications, org rollup (Phase 6).
- Super-admin: review reports in `/admin/approvals`.
- Emails: review request, reminder, "your host reviewed you", "review published / response received".
- Fixes: SD refund decoupling, voucher decoupling, truncated count/average.
- Tests, docs, route guides, assistant parity entries.

### Out

- Reviews for parking bookings.
- Pulling reviews from Airbnb/Booking.com APIs (OTA review sync) — roadmap item, separate plan.
- Public guest profiles.
- "Guest favorite" badge; recency-weighted scores.
- Helpful votes / review search (removed in the 2026-08-29 refinement; stays removed).
- Multi-guest (co-traveller) reviews: one review per booking from the booking guest.
- Trust & Safety case management (separate plan); this plan only covers review-content disputes.

---

## Approach

### Data model

**1. `guest_reviews` (guest → stay) — extend, keep name** (many consumers already read it).

New columns:

| Column                                                                                                                                                        | Type                                | Notes                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization_id`                                                                                                                                             | UUID FK                             | Backfill from `properties.organization_id`; speeds org rollup                                                                               |
| `guest_user_id`                                                                                                                                               | UUID FK `auth.users` NULL           | Set when submitted signed-in or later linked                                                                                                |
| `category_ratings`                                                                                                                                            | JSONB NOT NULL DEFAULT `'{}'`       | `{cleanliness, accuracy, check_in, communication, location, value}` each 1–5. CHECK via `jsonb_typeof = 'object'`; values validated in edge |
| `private_note`                                                                                                                                                | TEXT NULL                           | Host-only. ≤ 1,000                                                                                                                          |
| `source`                                                                                                                                                      | TEXT NOT NULL DEFAULT `'legacy'`    | `legacy                                                                                                                                     | sd_form   | guest_review                            | trip | account | email_link` |
| `status`                                                                                                                                                      | TEXT NOT NULL DEFAULT `'submitted'` | `submitted                                                                                                                                  | published | removed`. Backfill legacy → `published` |
| `submitted_at`                                                                                                                                                | TIMESTAMPTZ                         | Backfill = `created_at`                                                                                                                     |
| `edited_at`                                                                                                                                                   | TIMESTAMPTZ NULL                    |                                                                                                                                             |
| `published_at`                                                                                                                                                | TIMESTAMPTZ NULL                    | Backfill = `created_at`                                                                                                                     |
| `response_text`, `response_at`, `response_by`                                                                                                                 | host's single public response       | `response_by` FK `auth.users`                                                                                                               |
| `removed_at`, `removed_by`, `removed_reason`                                                                                                                  | moderation                          |                                                                                                                                             |
| Indexes: `(property_id, published_at DESC) WHERE status = 'published'`, `(organization_id, published_at DESC) WHERE status = 'published'`, `(guest_user_id)`. |
| Update the table comment ("immutable" → "editable until published").                                                                                          |

**2. `host_guest_reviews` (host → guest) — new.**

| Column                                                                          | Notes                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------- |
| `id` UUID PK                                                                    |                                             |
| `booking_id` UUID UNIQUE FK `guest_submissions` ON DELETE CASCADE               | one per booking                             |
| `property_id`, `organization_id`                                                | scope                                       |
| `guest_user_id` UUID NULL, `guest_identity_key` TEXT NOT NULL                   | D6                                          |
| `overall_rating` SMALLINT 1–5                                                   |                                             |
| `cleanliness_rating`, `communication_rating`, `house_rules_rating` SMALLINT 1–5 | typed columns (fixed set; cheap aggregates) |
| `would_host_again` BOOLEAN NOT NULL                                             |                                             |
| `strength_tags` TEXT[], `issue_tags` TEXT[]                                     | catalogs mirrored edge/UI                   |
| `review_text` TEXT NULL                                                         | shown to the guest + screening hosts        |
| `private_note` TEXT NULL                                                        | to the guest only                           |
| `internal_note` TEXT NULL                                                       | authoring org only                          |
| `author_user_id` FK `auth.users`                                                | team member who wrote it                    |
| `status`, `submitted_at`, `edited_at`, `published_at`                           | same semantics as above                     |
| `response_text`, `response_at`                                                  | guest's single response                     |
| `removed_at`, `removed_by`, `removed_reason`                                    |                                             |

Indexes: `(guest_identity_key, published_at DESC) WHERE status = 'published'`, `(guest_user_id, published_at DESC) WHERE status = 'published'`, `(property_id, submitted_at DESC)`.

**3. `booking_review_windows` — new, one row per eligible booking** (the state machine anchor).

| Column                                            | Notes                                                    |
| ------------------------------------------------- | -------------------------------------------------------- |
| `booking_id` UUID PK FK                           |                                                          |
| `property_id`, `organization_id`                  |                                                          |
| `opens_at`, `closes_at` TIMESTAMPTZ               | D1                                                       |
| `published_at` TIMESTAMPTZ NULL                   | set once, when both reviews publish or the window closes |
| `guest_request_sent_at`, `guest_reminder_sent_at` | email idempotency                                        |
| `host_reminder_notified_at`                       | bell idempotency                                         |
| `closed_reason` TEXT NULL                         | `published                                               | expired | cancelled` |

Index `(closes_at) WHERE published_at IS NULL`.

**4. `review_reports` — new.**

`id`, `review_kind` (`guest_review | host_guest_review`), `review_id`, `reporter_user_id`, `reporter_side` (`host | guest`), `reason` (`not_a_real_stay | incentive_or_extortion | retaliation | discriminatory | harassment_or_threat | private_information | irrelevant | other`), `details` (≥ 30 chars), `status` (`pending | upheld | rejected`), `decided_by`, `decided_at`, `decision_note`, `created_at`. Unique-ish guard: max 2 rows per `(review_kind, review_id, reporter_side)` enforced in edge.

**5. Aggregates (SQL functions, `SECURITY DEFINER`, revoke from PUBLIC/anon/authenticated, grant service_role):**

- `property_review_summary(p_property_id)` → `count`, `avg_overall`, `distribution` (1–5 counts), `category_avgs`, `category_sample`, `response_rate`. Published + non-removed only. Replaces the truncated in-memory average (gap 4).
- `guest_reputation(p_guest_user_id, p_identity_key)` → `review_count`, `avg_overall`, category averages, `would_host_again_rate`, `top_strength_tags`, `top_issue_tags`, `last_stay_at`. Published + non-removed only.

**6. Search index** (`public_listing_search_index`): change the `guest_reviews` SUM/COUNT (≈ line 552) to `status = 'published'`, and make the refresh trigger fire on `status` / `published_at` / `removed_at` changes (new migration that `CREATE OR REPLACE`s the function; never edit the shipped file).

**7. Notifications:** widen `notifications_type_check` with `review_received` (guest review published for your property), `review_due` (host has ≤ 3 days to review), `review_response_received` (guest responded to your review of them). Update `_shared/notificationService.ts` `NotificationType` + UI notification rendering + preferences category (run the `notifications` skill).

**8. RLS:** all four tables RLS on, **service-role only** (edge functions are the access layer, matching `guest_reviews` today). No anon/authenticated policies.

### Shared server modules

| Module                              | Responsibility                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_shared/reviewWindow.ts`           | `REVIEW_WINDOW_DAYS`, `computeReviewWindow(booking)`, `isWindowOpen(window, now)`, `ensureReviewWindow(bookingId)` (idempotent upsert)                                                                                                                                                                                                   |
| `_shared/reviewEligibility.ts`      | Replaces/absorbs `guestReviewEligibility.ts` (keep the old exports as thin wrappers until callers migrate): `guestCanReview(row, window)`, `hostCanReview(row, window)`, `canClaimStayVoucher(row)` (D3)                                                                                                                                 |
| `_shared/reviewPublishing.ts`       | `publishIfComplete(bookingId)` and `publishExpired(now)` calling RPC `publish_booking_reviews(p_booking_id, p_force boolean)` which locks the `booking_review_windows` row `FOR UPDATE`, sets `published_at` on both reviews + the window in one transaction. Prevents the race where two near-simultaneous submits each miss the other. |
| `_shared/reviewCategories.ts`       | Guest categories, host categories, strength/issue tag catalogs, validators (mirror in UI `features/reviews/lib/reviewCatalog.ts` + parity unit test)                                                                                                                                                                                     |
| `_shared/reviewContentPolicy.ts`    | Length limits, contact-info/URL rejection, whitespace normalization (D15)                                                                                                                                                                                                                                                                |
| `_shared/guestIdentityKey.ts`       | `guestIdentityKey(email)` with `REVIEW_IDENTITY_PEPPER` env (document in `validation-and-env.md`)                                                                                                                                                                                                                                        |
| `_shared/hostGuestReviewService.ts` | insert/update/list/reputation queries                                                                                                                                                                                                                                                                                                    |
| `_shared/guestReviewService.ts`     | extend: categories, private note, status, edit, response; `listPublicGuestReviews` filters `status='published'` and pages by cursor                                                                                                                                                                                                      |

### Lifecycle

```
check-out reached (orchestrator READY_FOR_CHECKIN→READY_FOR_CHECKOUT, or cron on check-out date)
  → ensureReviewWindow(booking)               window: opens_at, closes_at
  → guest review request (email, once)        skipped when SD form email already carries the review step
  → host: booking card "Review guest" + Reviews "To write"

guest submits ─┐                        ┌─ host submits
               ├─ publishIfComplete ────┤
               │   both present → publish both now, notify both
               │   one present  → stay hidden, notify other side ("X reviewed you")
day 11 (≤3 days left): guest reminder email + host `review_due` bell (once each)
closes_at passes: cron publishes whatever exists, closes window (reason expired)
after publish: reviewee may respond once; either side may report (≤2)
super-admin upholds report → status removed, aggregates exclude, author emailed
```

Edge cases handled explicitly:

| Case                                                          | Behavior                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking stepped back `READY_FOR_CHECKOUT → READY_FOR_CHECKIN` | Window row kept; unchanged dates; reviews unaffected                                                                                                                                                                                  |
| Booking cancelled after window opened (rare admin action)     | Unpublished reviews stay hidden; window `closed_reason = cancelled`; published ones remain                                                                                                                                            |
| Guest edits booking dates after check-out                     | Not possible (reschedule blocked from `READY_FOR_CHECKOUT`)                                                                                                                                                                           |
| Host deletes property / booking                               | CASCADE removes reviews; aggregates recompute on read                                                                                                                                                                                 |
| Guest has no account                                          | Can review via access-token link (anon, anti-spam). To **read** reviews about them they sign in with the booking email; `linkGuestBookingsByEmail` (login) also backfills `guest_user_id` on `guest_reviews` and `host_guest_reviews` |
| Same guest, two emails                                        | Two identities until both link to one account; reputation unions `guest_user_id` and every identity key of that user's linked bookings                                                                                                |
| Calendar-sync booking with no email                           | Host can review; stored with `guest_identity_key = NULL`-safe placeholder `booking:<id>` so it never matches anyone else; becomes matchable once the guest completes the form and the key is recomputed (in `submit-form-completion`) |
| Duplicate submit (double tap / retry)                         | Unique `booking_id` + upsert-while-unpublished = idempotent; second call returns current state                                                                                                                                        |
| Window closes while guest is mid-form                         | Submit returns 409 `review_window_closed`; UI shows a short closed state                                                                                                                                                              |
| Clock / TZ                                                    | All window math in Asia/Manila via existing `calendarAvailabilityManila.ts` helpers; stored as TIMESTAMPTZ                                                                                                                            |
| Legacy reviews with no categories                             | Excluded from category averages; included in overall                                                                                                                                                                                  |
| Removed review                                                | Excluded everywhere including Superhost, analytics, marketing, search index                                                                                                                                                           |

### Workflow / orchestrator integration

- `workflowOrchestrator.transition()` side effect on `READY_FOR_CHECKIN → READY_FOR_CHECKOUT`: `ensureReviewWindow(bookingId)` (non-blocking, log on failure). Add to `booking-workflow.mdc` side-effect matrix. No email from the orchestrator for reviews (the cron owns review emails so timing is in one place).
- `sd-refund-cron` unchanged; new `review-lifecycle-cron` handles windows for bookings whose status never advanced (check-out passed while `READY_FOR_CHECKIN`, the Airbnb zero-SD case).
- `guestTrip.ts`: `reviewAvailable` / `reviewSubmitted` computed from the new eligibility for **all** eligible bookings (not only `airbnb_post_stay`); add `review: { state: 'open' | 'submitted' | 'published' | 'closed' | 'unavailable', closesAt, hostReviewed: boolean }`.

### Edge functions

| Function                                                         | Wrapper                                                                          | Purpose                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get-guest-review` (extend)                                      | `servePublic`                                                                    | Bootstrap for the write flow: property, stay, window `closesAt`, existing draft (editable until publish), categories catalog version, `facebook_reviews_url` (FB CTA plan)                                             |
| `submit-guest-review` (extend)                                   | `servePublic` + `antiSpamGate`                                                   | Accept `categoryRatings`, `privateNote`, `source`; upsert while unpublished (edit); window + eligibility; content policy; `publishIfComplete`; activity log + PostHog                                                  |
| `list-my-reviews`                                                | `serveAuthenticated` (guest)                                                     | `/account/reviews`: to-write, by-you, about-you (published only, no internal note), own reputation                                                                                                                     |
| `respond-to-host-review`                                         | `serveAuthenticated` (guest)                                                     | Guest's one response to a published host review of them                                                                                                                                                                |
| `list-property-reviews`                                          | `serveAuthenticated` + `resolveScopedPropertyAccess('reviews:view')`             | Host Reviews page: summary RPC, received (with private notes), written, to-write; filters + cursor pagination                                                                                                          |
| `submit-host-guest-review`                                       | `serveAuthenticated` + `reviews.guests:edit` + `rateLimitGate`                   | Create/edit while unpublished; window + eligibility; identity key; `publishIfComplete`                                                                                                                                 |
| `respond-to-guest-review`                                        | `serveAuthenticated` + `reviews.responses:edit`                                  | Create/edit/delete host response on a published guest review                                                                                                                                                           |
| `get-guest-reputation`                                           | `serveAuthenticated` + `bookings:view`                                           | For a booking id in the caller's property: `guest_reputation(...)` + up to 5 recent published host reviews (text only, other orgs' internal notes never returned, other orgs' property names generalized to city/area) |
| `report-review`                                                  | `serveAuthenticated` (host with `reviews.responses:edit`, or the reviewed guest) | Creates `review_reports`; ≤ 2 per side; super-admin email + approvals badge                                                                                                                                            |
| `list-super-admin-approvals` (extend) + `moderate-review-report` | `serveSuperAdmin`                                                                | Type = Reviews gains "Reported reviews"; uphold (remove) / reject; author + reporter emailed; `superAdminAudit`                                                                                                        |
| `list-property-guest-reviews` (extend)                           | existing                                                                         | Marketing studio: published + non-removed only                                                                                                                                                                         |
| `review-lifecycle-cron`                                          | `serveCronPost`                                                                  | Hourly: open windows for check-outs reached, send request + reminder emails, `review_due` bells, `publishExpired`, one `system.cron_run` activity row per run; `pg_cron` migration + `scheduled-jobs-and-testing.md`   |

Add every function to `supabase/config.toml` (`verify_jwt = false`; `static_files` for email-sending ones: `submit-guest-review`, `submit-host-guest-review`, `review-lifecycle-cron`, `moderate-review-report`), `docs/architecture/edge-functions.md`, and `_shared/dashboardAssistantParity.ts`.

### Consumers to switch to "published only"

`publicPropertyService.ts` (use `property_review_summary` + paged list), `superhostMetrics.ts`, `analyticsService.ts` (guest review KPIs), `marketingGuestReviews.ts` / `list-property-guest-reviews`, search index function, showcase mapping (`mapShowcaseData.ts` reads from public payload, verify), `guestTrip.ts`.

---

## UX design — screens and flows

Visual language: existing tokens (`surface-card`, `native-cta`, `native-page-canvas`, theme CSS variables, light + dark), Lucide icons, `GuestReviewStarRating` (extended), `SegmentedControl`, `ResponsiveModal` / `GuestDialogShell` / `AdminDialogShell`, `MobileChoiceSheet`, `ResponsiveOverflowMenu`, `ContextualActionBar`. Copy per `human-copy` + `minimal-ui-copy`: labels and short lines only, no em dashes in UI strings. Every data region gets a layout-matched skeleton.

### Shared building blocks (new, `ui/src/features/reviews/`)

A new feature module shared by guest and dashboard surfaces (pure presentational + lib; no cross-feature page imports).

| Component                                                 | Use                                                                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RatingStars`                                             | Extends `GuestReviewStarRating`: sizes `lg` (overall tap target 48px stars), `row` (category rows, 44px hit), `display` (read-only, half-star rendering) |
| `CategoryRatingList`                                      | Vertical list of category label + `row` stars; keyboard arrows; `aria-label` per star ("Cleanliness, 4 of 5")                                            |
| `RatingSummary`                                           | Big average + count (or "New"), distribution bars, category grid                                                                                         |
| `ReviewCard`                                              | Author, stay month + nights, stars, tags, text (line-clamp + "Show more"), photos, response block, overflow (Report)                                     |
| `ReviewResponseBlock`                                     | Indented response with responder label ("Response from host")                                                                                            |
| `ReviewWindowBadge`                                       | "6 days left" / "Closed" chip                                                                                                                            |
| `ReputationSummary`                                       | Guest reputation for hosts: avg, count, would-host-again %, tick/warning category rows                                                                   |
| `TagPicker`                                               | Wraps existing `GuestReviewFeedbackPills` for both catalogs                                                                                              |
| lib `reviewCatalog.ts`, `reviewWindow.ts`, `reviewApi.ts` | mirrors + API clients                                                                                                                                    |

### G1 — Guest: write a review (redesigned flow)

One component `GuestReviewFlow` used by SD stepper step 1, `/properties/:slug/guest-review`, trip page, email links and `/account/reviews`. Steps are full-width sections on phone with a `ContextualActionBar` (Back / Next) where it is the dominant action; on `lg+` a centered 640px column.

```
Phone (375)                          Desktop (≥1024)
┌───────────────────────────┐        ┌──────────────────────────────────────────┐
│ ‹  Solea Mactan     1/3 ▬▬░│        │ [photo] Solea Mactan · Oct 12–15 · 3 nts │
│ [photo 56px] Oct 12–15     │        │ ───────────────────────────────────────  │
│                            │        │ How was your stay?                        │
│ How was your stay?         │        │   ★ ★ ★ ★ ★   (48px)                      │
│   ★  ★  ★  ★  ★            │        │ Cleanliness        ☆☆☆☆☆                  │
│                            │        │ Accuracy           ☆☆☆☆☆                  │
│ Cleanliness   ☆☆☆☆☆        │        │ Check-in           ☆☆☆☆☆                  │
│ Accuracy      ☆☆☆☆☆        │        │ Communication      ☆☆☆☆☆                  │
│ Check-in      ☆☆☆☆☆        │        │ Location           ☆☆☆☆☆                  │
│ Communication ☆☆☆☆☆        │        │ Value              ☆☆☆☆☆                  │
│ Location      ☆☆☆☆☆        │        │                                [ Next ]  │
│ Value         ☆☆☆☆☆        │        └──────────────────────────────────────────┘
├───────────────────────────┤
│ [ Not now ]     [ Next  ] │  ContextualActionBar
└───────────────────────────┘
```

- **Step 1 Ratings**: overall (required) + 6 categories (required, one tap each). Category rows reveal with a short stagger after the overall tap. Next disabled until complete; unanswered rows get a subtle ring on Next attempt.
- **Step 2 Details**: tags (positive set when overall ≥ 4, constructive otherwise, existing catalog), public review textarea (optional, counter, ≥ 20 chars if used), photos (existing `GuestReviewMediaUpload`, max 3), collapsible "Private note to host" textarea.
- **Step 3 Confirm**: compact summary (stars + first line), Submit.
- **Done**: "Thanks for your review" + one line: "It goes live when your host reviews you, or on Oct 29." Then the next phase (FB CTA if configured, voucher, refund) per page.
- **Edit**: returning before publish opens the same flow prefilled with an "Editing" label; after publish shows the read-only card.
- **Not now** (D4): SD stepper → goes to voucher/refund; standalone page → back to trip. Never shown as a guilt prompt.
- Unsaved-changes: `useUnsavedChangesGuard` on the standalone page (draft has a manual Submit); inside the SD stepper the existing flow controls navigation (guard the step 1 → leave case).
- Closed window: icon + "Reviews for this stay are closed."

### G2 — Guest: `/account/reviews` (new page)

Guest account nav gets **Reviews** (`Star`), placed after Trips. Top-strip nav on phone (no second bottom bar, per `mobile-responsive.mdc` §2b).

```
Phone                                   Desktop (account two-column shell)
┌──────────────────────────┐            ┌────────────┬─────────────────────────────┐
│ Reviews                   │            │ Profile    │ Reviews                      │
│ [To write | By you | About you] │      │ Trips      │ [To write | By you | About you]│
│ ┌──────────────────────┐ │            │ Reviews •  │ ┌───────────┐ ┌───────────┐ │
│ │[img] Solea Mactan     │ │            │ Stays      │ │ card      │ │ card      │ │
│ │Oct 12–15 · 6 days left│ │            │ ...        │ └───────────┘ └───────────┘ │
│ │        [ Write review ]│ │            └────────────┴─────────────────────────────┘
│ └──────────────────────┘ │
└──────────────────────────┘
```

- **To write**: eligible stays with `ReviewWindowBadge`; CTA opens G1.
- **By you**: your reviews; "Pending" chip until published; Edit while pending; host response under published ones.
- **About you**: header `ReputationSummary` (your average from hosts, count); host reviews of you once published; "Hidden until you review" teaser card when the host reviewed but you have not and the window is open (Airbnb nudge, without revealing content); one-time **Respond** (bottom sheet) and **Report** in the overflow menu.
- Empty states: icon + one line per tab ("No stays to review", "No reviews yet").
- Skeleton: tab strip mounted, 2 card skeletons.
- Requires sign-in (account routes already gated). Page title `Kame Homes - Reviews` via `usePageTitle` (platform name rule).

### G3 — Guest: trip page

`GuestTripPage` post-stay: the existing "Leave a review" next action now covers every eligible booking. States: open → "Leave a review" + days left; submitted → "Review submitted" (Edit until published); published → read-only snippet + "Your host's review" when present; closed → nothing.

### G4 — Public listing: rating summary and list (redesign of `PropertyReviews`)

```
Phone                                     Desktop
┌───────────────────────────┐             ┌───────────────────────────────────────────────┐
│ ★ 4.86 · 42 reviews        │             │ ★ 4.86 · 42 reviews                              │
│ 5 ▇▇▇▇▇▇▇▇▇▇ 4 ▇▇ 3 ▏...   │             │ 5 ▇▇▇▇▇▇▇▇▇  │ Cleanliness 4.9  Accuracy 4.8    │
│ ─────────────────────────  │             │ 4 ▇▇         │ Check-in 5.0     Communication 4.9│
│ [🧹 4.9][🎯 4.8][🔑 5.0]→  │ swipe row  │ 3 ▏ 2 ▏ 1 ▏  │ Location 4.7     Value 4.6        │
│ [Sparkling clean ·12][...]→│ top tags   │ [Sparkling clean · 12] [Easy check-in · 9] ...   │
│ Sort: Newest ▾  (sheet)    │             │ Sort: Newest ▾ (dropdown)                        │
│ ┌ ReviewCard ────────────┐ │             │ ┌ ReviewCard ─────────┐ ┌ ReviewCard ─────────┐ │
│ │ Maria · Oct 2026 · 3 nts│ │             │ │ ...                 │ │ ...                 │ │
│ │ ★★★★★ text… Show more   │ │             │ └─────────────────────┘ └─────────────────────┘ │
│ │ ↳ Response from host    │ │             │            [ Show all 42 reviews ]              │
│ └─────────────────────────┘ │             └───────────────────────────────────────────────┘
│ [ Show all 42 reviews ]     │
└───────────────────────────┘
```

- Summary from `property_review_summary`; "New" when < 3 ratings (D10). Category grid only when ≥ 3 Kame reviews carry categories (D10).
- Sort: Newest (default), Highest, Lowest. `MobileChoiceSheet` on phone, `DropdownMenu` on `lg+`. Cursor-paged "Show all" opens the existing detail modal/sheet with infinite list.
- Host responses render under the review. Source badges (Guest review / Airbnb / Facebook) kept.
- Listing cards and search results keep showing avg + count from the fixed search index.

### H1 — Host: property **Reviews** page (new)

Route `/org/:orgSlug/property/:propertySlug/reviews`. Sidebar entry **Reviews** (`Star`) after Inbox; phone: More sheet. Page uses `AdminMobilePage` + `MobileBrandHero` (title "Reviews", flush). Title `${Property Name} - Reviews`.

```
Phone                                        Desktop (lg+)
┌──────────────────────────────┐             ┌──────────────────────────────────────────────────────┐
│ ▓ Reviews (brand hero)    ··· │             │ Reviews                                                │
│ ┌ surface-card ─────────────┐ │             │ ┌ ★ 4.86 ─────┐ ┌ Reviews ─┐ ┌ Response rate ┐ ┌ To write ┐│
│ │ ★ 4.86   42 reviews        │ │             │ │ distribution│ │ 42       │ │ 88%           │ │ 3        ││
│ │ 5 ▇▇▇▇▇▇ 4 ▇ 3 ▏ 2 ▏ 1 ▏   │ │             │ └─────────────┘ └──────────┘ └───────────────┘ └──────────┘│
│ │ Response rate 88% · 3 due  │ │             │ Category averages (6 mini bars)                         │
│ └───────────────────────────┘ │             │ [Received | Written | To write (3)]   Rating ▾  Needs reply│
│ [Received|Written|To write 3] │             │ ┌ ReviewCard (with private note + Respond) ────────────┐ │
│ 🔍?  [⚙ refine]               │             │ │ Maria · Oct 12–15 · ★★★★☆ · Private note ▸            │ │
│ ┌ ReviewCard ───────────────┐ │             │ │ "Great place, slow wifi…"         [Respond] [···]     │ │
│ │ Maria · Oct 12–15  ★★★★☆   │ │             │ └───────────────────────────────────────────────────────┘ │
│ │ text…           [Respond]  │ │             └──────────────────────────────────────────────────────┘
│ │ 🔒 Private note            │ │
│ └───────────────────────────┘ │
└──────────────────────────────┘
```

- **Received**: guest reviews of this property (published only; pending ones show as a count "2 reviews waiting for your review" linking to To write, never content, per D2). Each card: stars, categories (expand), tags, text, photos, **private note** (lock icon, host-only), response block, actions **Respond** / overflow (**Report**, **Use in marketing** → existing marketing review studio deep link).
- **Written**: host reviews of guests; Pending/Published chips; Edit while pending; guest response under it.
- **To write**: eligible stays without a host review, sorted by `closes_at`, `ReviewWindowBadge`, CTA **Review guest** (opens H3).
- Refine (`AdminListRefineSheet` on phone, inline on desktop): rating (All/5/4/3/2/1), Needs reply, date range preset. No search box (consistent with prior decision).
- KPIs: average, count, response rate (responded / received in last 12 months), due count.
- Skeleton: summary card + 3 review cards; hero and tabs stay mounted.
- Permissions: page requires `reviews:view`; Respond/Report need `reviews.responses:edit`; Review guest needs `reviews.guests:edit` (buttons hidden, server enforces).

### H2 — Host: booking detail cards

1. **Guest reputation** (rail card, from `PENDING_REVIEW` onward, `bookings:view`): `ReputationSummary` (★ 4.7 · 5 stays, Would host again 100%, ✓ Cleanliness ✓ Communication ⚠ House rules) + "View reviews" opens a sheet with up to 5 recent published host reviews (text, month, area). Empty: "No reviews yet" (first-time guest). Hidden entirely when the booking has no email (no identity).
2. **Review guest** (rail card, when window open and no host review; `reviews.guests:edit`): `ReviewWindowBadge` + **Review guest** button (H3). After submit: "Submitted · goes live with the guest's review or on Oct 29" + Edit. After publish: both reviews side by side (yours, theirs) with Respond on theirs.
3. `BookingDetailTabs` unchanged (cards live in the rail / overview, avoiding a new tab for a single action). Phone: cards stack in the Stay tab order after the workflow card.

### H3 — Host: write guest review (sheet)

`AdminDialogShell` (desktop centered, phone bottom sheet, `sheetLayout="split"`), guarded with `useGuardedClose` + `UnsavedChangesDialog`.

```
┌ Review Juan Dela Cruz ─────────── × ┐
│ Oct 12–15 · Solea Mactan             │
│ Overall          ★ ★ ★ ★ ★           │
│ Cleanliness      ☆☆☆☆☆               │
│ Communication    ☆☆☆☆☆               │
│ House rules      ☆☆☆☆☆               │
│ Would you host them again?           │
│   [ Yes ] [ No ]   (segmented)       │
│ What went well   [Tidy][Respectful]… │  (shown when any category ≥4)
│ What went wrong  [Late checkout]…    │  (shown when any category ≤3)
│ Review           [textarea] 0/2000   │  required when overall ≤3
│ ▸ Private note to guest              │
│ ▸ Team note (only your team)         │
├──────────────────────────────────────┤
│ [ Cancel ]              [ Submit ]   │
└──────────────────────────────────────┘
```

Strength tags: `tidy`, `followed_house_rules`, `great_communication`, `respectful`, `on_time_checkout`, `took_care_of_trash`, `left_it_as_found`, `welcome_back`. Issue tags: `left_a_mess`, `broke_house_rules`, `late_checkout`, `unregistered_guests`, `noise_complaint`, `damage`, `smoking`, `unresponsive`, `pet_policy`. Final labels in Phase 0 copy review.

### H4 — Respond / Report sheets

- **Respond** (`AdminDialogShell`): original review excerpt (read-only) + textarea (≤ 1,000, counter) + Save. Edit/Delete afterwards from the card overflow. Same component powers the guest's response.
- **Report** (`ResponsiveModal`): reason list (`MobileChoiceSheet`-style rows on phone) → details (≥ 30 chars) → Submit → confirmation "We'll email you our decision." Shows "Already reported" when the 2-report cap is reached.

### H5 — Org rollup (Phase 6)

`/org/:orgSlug/reviews`: org average, per-property table (avg, count, response rate, due), merged Received feed with property filter. Org nav item "Reviews" (org mirror leaf `reviews:view`). Desktop table → phone list rows.

### S1 — Super-admin

`/admin/approvals` Type = Reviews: new "Reported" sub-filter. Dialog shows the review (both sides when double-blind pair), report reason/details, booking facts (dates, status), prior reports; actions **Remove review** / **Keep review** with a required note. Existing external-review moderation untouched.

### Notifications and emails

| Trigger                     | Guest                                                                                                                   | Host                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Window opens (check-out)    | Email "How was your stay at {property}?" (skip when SD form email already sent; that email gets an updated review line) | Bell only on `review_due` later; card appears on booking            |
| Counterpart submitted first | Email "{Host} reviewed you. Leave yours to read it."                                                                    | Bell `review_received` is sent at publish, not here (avoid leaking) |
| 3 days left                 | Reminder email (once)                                                                                                   | Bell `review_due` (once)                                            |
| Published                   | Email "Your review is live" (+ host review of you, if any)                                                              | Bell `review_received` with stars                                   |
| Response posted             | Email "{Property} responded to your review"                                                                             | Bell `review_response_received`                                     |
| Report decided              | Email to author (removed) / reporter (outcome)                                                                          | Email to reporter                                                   |

All guest emails respect `email_suppressions`, blank `guest_email` suppression, and a new property automation toggle `emailReviewRequests` (default on; **not** in `PLAN_GATED_AUTOMATION_TOGGLE_KEYS`, D13). New templates in `_shared/email-templates/`: `review-request.html`, `review-reminder.html`, `review-counterpart-submitted.html`, `review-published.html`, `review-response.html`, `review-report-decision.html` (+ `_preview` entries).

---

## Plans, permissions, audit, assistant, analytics

### Plans

- Phases 1–6: **N/A** — core trust feature, free on every tier (D13). Record rationale in the route guide and `plans-feature-matrix.md` ("Reviews: all tiers").
- Phase 7: new `PlanFeatureKey` **`reviewAutomation`** (Pro+): migration on `pricing_plans.features`, `planFeatures.ts` (edge + UI), `useFeatureGate` / `requirePropertyFeature`, `planPresentation`, public pricing, `planTierGolden.ts`, `planTierExpectations.ts`, `GATE_COVERAGE` in `planGateCoverage.test.ts`, `PLAN_FEATURE_PERMISSION_COVERAGE` (maps to `reviews.guests:edit`), `bun run check:plan-catalog`.

### Team RBAC

| Leaf                     | Grants                                          | Seeded templates                                                                   |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `reviews:view`           | Reviews page, private notes on received reviews | Admin + every template that has `bookings:view`                                    |
| `reviews.guests:edit`    | Write/edit host reviews of guests               | Admin + templates with `bookings.detail.workflow:edit`                             |
| `reviews.responses:edit` | Respond, edit/delete response, report reviews   | Admin + templates with `marketing.content:edit` or `bookings.detail.workflow:edit` |

Update in sync: `ui/.../team/lib/propertyTeamConstants.ts`, `_shared/propertyTeamPermissions.ts` (`TEAM_PERMISSION_IDS`), `propertyPermissionCatalog.ts` (new "Reviews" group), org mirrors (`orgTeamConstants.ts`, `_shared/orgTeamPermissions.ts`, `orgPermissionCatalog.ts`) for the rollup, seeded-template migration, catalog drift tests, `resolveScopedPropertyAccess` on every write, route-guide permission table. New leaves (not splits) → seed migration grants them to existing custom roles per the table above so current team members don't lose sight of the new page unexpectedly.

### Activity log (`_shared/activityLog.ts` + UI `activityCatalog.ts`, new category `reviews`)

| Action                                                                        | Actor                                | Severity |
| ----------------------------------------------------------------------------- | ------------------------------------ | -------- |
| `guest.review_submitted` (exists; add `edited` variant `guest.review_edited`) | guest                                | info     |
| `review.host_submitted`, `review.host_edited`                                 | team member                          | info     |
| `review.response_posted`, `review.response_edited`, `review.response_deleted` | team member / guest                  | info     |
| `review.reported`                                                             | host / guest                         | notice   |
| `review.removed`                                                              | super-admin (also `superAdminAudit`) | warning  |
| `system.cron_run` (summary: windows opened, published, reminders)             | cron                                 | info     |

Diffs redact review text to a length + hash (no PII in the log).

### AI assistant parity (`_shared/dashboardAssistantParity.ts`)

- `list-property-reviews`, `get-guest-reputation`: **read** (add read tool `list_property_reviews` or KB coverage).
- `submit-host-guest-review`, `respond-to-guest-review`, `report-review`: **handoff** to the Reviews page / booking detail (`open_page`, add routes to `_shared/dashboardAssistantRoutes.ts`). Reviews are personal judgments; no chat-side write in v1. Document in `docs/architecture/ai-dashboard-assistant.md`.
- Guest-side functions: `servePublic` / guest auth, non-host kind entries.

### PostHog (`posthogCatalog.ts`, server-side conversion events only)

`guest_review_submitted` (exists, add `category_count`, `source`), `guest_review_skipped` (client), `host_guest_review_submitted`, `review_pair_published` (`trigger: both | expired`), `review_response_posted`, `review_reported`, `review_removed`. No text or names in properties.

---

## Implementation tasks

Each phase ends with `bun run type-check && bun run lint && bun run test` plus the phase's own tests, and a docs pass. Run `/workflow-start` before Phase 1.

### Phase 0 — Decisions and copy (no code)

- [x] Confirm D3 (decouple voucher), D5 (share review text, property as area), D9 (categories required), Airbnb-sourced host reviews allowed — 2026-10-19.
- [x] Remaining defaults D1, D2, D4, D6–D8, D10–D15 implemented as written (14-day Manila window, double-blind publish RPC, skip-to-refund, identity pepper, eligibility, edit-until-publish, display after 3 ratings, legacy backfill, super-admin removal, reviews ungated, RBAC leaves, content policy).
- [x] Terms + Privacy review wording shipped (`/terms`, `/privacy`): screening purpose, guest access/response, internal-note isolation, 24-month purge of removed reviews. Counsel sign-off before marketing launch remains on `docs/guides/routes/legal.md` pending.
- [x] Category labels, host strength/issue tags, email subjects, and UI strings shipped through Phases 2–7 (`human-copy`: no em dashes).
- [x] Pick `REVIEW_IDENTITY_PEPPER` handling — Supabase secret, dev fallback constant in `guestIdentityKey.ts`; rotation = recompute-keys job still to write (tracked in Phase 3).

### Phase 1 — Foundation: schema, shared logic, fixes that don't change UX

- [x] Migration `20261316127300_two_way_reviews_schema.sql`: extend `guest_reviews` (+ backfill `organization_id`, `status='published'`, `submitted_at`/`published_at = created_at`, `source='legacy'`), create `host_guest_reviews`, `booking_review_windows`, `review_reports`, indexes, RLS on + service-role grants, comments.
- [x] Migration `20261316127400_review_summary_functions.sql`: `property_review_summary`, `guest_reputation`, `publish_booking_reviews` (row lock, atomic), REVOKE/GRANT per edge rule. Verified locally via `docker exec ... psql`.
- [x] Migration `20261316127500_search_index_published_reviews.sql`: published-only aggregate + widened trigger columns on `pls_refresh_property`.
- [x] Migration `20261316127600_review_notification_types_and_rbac.sql`: widened `notifications_type_check` + RBAC leaf backfill (combined with the RBAC leaf migration below — one migration, not two).
- [x] `_shared/reviewWindow.ts`, `reviewEligibility.ts` (wraps `guestReviewEligibility.ts`'s `checkoutOnOrBeforeTodayManila`), `reviewPublishing.ts`, `reviewCategories.ts`, `reviewContentPolicy.ts`, `guestIdentityKey.ts`, `hostGuestReviewService.ts`; extended `guestReviewService.ts` with `upsertGuestReview`/`respondToGuestReview`/`getGuestReviewRow`.
- [x] Switched consumers to published-only: `publicPropertyService.ts` (now combines the `property_review_summary` RPC with approved external reviews instead of averaging a 20-row page — fixes the truncated count/avg), `superhostMetrics.ts`, `analyticsService.ts`. `marketingGuestReviews.ts` / `list-property-guest-reviews` consume `listPublicGuestReviews` and inherit the fix automatically (verified, no direct change needed).
- [x] `notificationService.ts` + UI `notificationsApi.ts` types (`review_received`, `review_due`, `review_response_received`) + `notificationsDisplay.ts` icons; `activityLog.ts` actions (`review.host_submitted`, `review.response_posted`, `review.reported`, `review.removed`); `propertyTeamPermissions.ts` + UI `propertyTeamConstants.ts` + `propertyPermissionCatalog.ts` + edge `propertyTeamTemplates.ts` for the 3 new leaves (`reviews:view`, `reviews.guests:edit`, `reviews.responses:edit`); `propertyAutomationToggles.ts` + UI mirror for `emailReviewRequest`/`emailReviewReminder`. `posthogCatalog.ts` deferred — no new edge functions emit events yet (Phase 3+).
- [x] Deno tests: `reviewWindow_test.ts`, `reviewEligibility_test.ts`, `reviewContentPolicy_test.ts`, `reviewCategories_test.ts`, `guestIdentityKey_test.ts` (35 tests, all passing). `reviewPublishing_test.ts` deferred — needs Supabase RPC mocking, covered instead by handler tests once `submit-host-guest-review` exists in Phase 3. `superhostMetrics_test.ts` / `analyticsService` tests unaffected (full `test:edge` suite green at 690 passed).
- [x] Vitest: `reviewCatalog.test.ts` edge/UI parity.
- [x] Verified locally via `docker exec ... psql` against the running local stack (migrations applied with `bun run db:migrate`); full regression green: `test:edge` 690/690, `test:edge:handlers` 124/124, `bun run test` (Vitest) 4212/4212, `bun run type-check` clean.

### Phase 2 — Guest write flow + SD/voucher decoupling

- [x] `ui/src/features/reviews/` module: `RatingStars`, `CategoryRatingList`, `TagPicker`, `ReviewWindowBadge`, `lib/reviewCatalog.ts`, `lib/reviewWindow.ts`, `lib/reviewApi.ts`.
- [x] Guest write stays in `SdFormReviewSection` (shared by SD + `/guest-review`); extract of `GuestReviewFlow` deferred, same UX.
- [x] `submit-guest-review`: categories, private note, source, edit-while-unpublished, window, content policy, `publishIfComplete`, `guest_user_id` from session if present, activity + PostHog.
- [x] `get-guest-review` / `get-sd-form`: window, draft, categories; keep `guest_review_submitted` semantics.
- [x] `SdFormPage.tsx`: **Not now** on step 1 → voucher/refund (D4); returning-guest effect respects skip (session flag + server state). `GuestReviewPage.tsx`: Not now → trip page.
- [x] `claim-sd-voucher` + `canClaimStayVoucher`: no `review_required` (D3 default); keep idempotency; incentive copy removed.
- [x] Unsaved-changes guard on standalone page.
- [x] Accessibility pass (star radio-group semantics, labels, focus order) + mobile pass (375/768, ContextualActionBar, no horizontal scroll).
- [x] E2E: `ui/e2e/features/reviews/guestWriteReview.spec.ts` (`@ci`): categories required, skip reaches refund, edit before publish, closed window.
- [x] Route guides: `sd-form.md` (step 1 skippable, categories, voucher decoupled, Host-facing Q&A update).

### Phase 3 — Host writes guest reviews + double-blind publishing + cron

- [x] RBAC leaves + catalogs + seed migration + drift tests (UI + edge + org mirror).
- [x] `submit-host-guest-review` (permission, window, identity key, publish).
- [x] `get-guest-reputation`.
- [x] Orchestrator side effect `ensureReviewWindow` on `READY_FOR_CHECKIN → READY_FOR_CHECKOUT`; `booking-workflow.mdc` matrix row.
- [x] `review-lifecycle-cron` + `pg_cron`/`pg_net` migration (hourly) + cron secret gate + idempotent markers; `scheduled-jobs-and-testing.md`.
- [x] Booking detail: **Guest reputation** card, **Review guest** card, H3 sheet (`useGuardedClose`). Respond-to-guest-review sheet is Phase 4.
- [x] `linkGuestBookingsByEmail` (guest login) also links `guest_reviews.guest_user_id` and `host_guest_reviews.guest_user_id`; `submit-form-completion` recomputes identity key.
- [x] Notifications UI for new types (icons; booking-detail deep link via existing `booking_id` path).
- [x] Email templates (request, reminder) + `static_files` in `config.toml` + property toggles `emailReviewRequest` / `emailReviewReminder`.
- [x] Handler tests (`supabase/functions/tests/hostGuestReview.test.ts`, `reviewLifecycleCron.test.ts`): permission source contract, reminder markers, expired publish, cancelled booking.
- [x] Update `teamPermissionGates.test.ts` with `submit-host-guest-review` / `reviews.guests:edit`.
- [x] Route guide: `org/property/bookings-detail.md` (two cards, permissions, Host-facing Q&A).

### Phase 4 — Host Reviews page + responses + reports

- [x] `list-property-reviews`, `respond-to-guest-review`, `report-review`.
- [x] `features/reviews` shared: `RatingSummary`, `ReviewCard`, `ReviewResponseBlock`, `ReputationSummary`.
- [x] Property route `reviews` + `adminSidebarNav.ts` entry + mobile More sheet + `RouteSkeletons` / skeleton + `usePageTitle` + `resolvePropertyDashboardHref` if needed.
- [x] H1 page (tabs, KPIs, cursor pagination with TanStack Query `useInfiniteQuery`, narrow invalidation keys `['property-reviews', propertyId, ...]`). Refine sheet is unused (no extra filters beyond tabs).
- [x] "Use in marketing" deep link into existing marketing review sidebar (`?tab=design&reviewId=`).
- [x] Super-admin: extend `list-super-admin-approvals` + `moderate-review-report` + dialog (S1) + `superAdminAudit` + `admin-auth.mdc` endpoint list.
- [x] Report decision email.
- [x] Handler tests: response edit/delete auth, report cap, moderation removes from summary.
- [x] E2E `ui/e2e/features/reviews/hostReviewsPage.spec.ts` (`@ci`): received list, respond, write guest review from To write, permission-hidden actions.
- [x] New route guide `docs/guides/routes/org/property/reviews.md` (from `_template.md`) + `routes/README.md` row; `admin/approvals.md` update.

### Phase 5 — Guest account Reviews + trip page + public listing redesign

- [x] `list-my-reviews`, `respond-to-host-review`; guest-side `report-review` path.
- [x] `/account/reviews` (G2): route, `guestAccountPaths.ts`, `guestAccountNav.ts`, `GuestAccountMobileNav`, skeleton, page title.
- [x] `guestTrip.ts` review object + trip card (open / submitted / published). Next-action still uses `reviewAvailable` (open only). Host snippet only after publish.
- [x] Public listing (G4): `PropertyReviews.tsx` summary, distribution, category avgs (≥3), sort sheet, host responses. Payload adds `reviewSummary`; `rating`/`reviewCount` kept.
- [x] Showcase carousel maps body/rating only (no host response).
- [x] Published + response emails (`sendReviewPublishedEmail`, `sendReviewResponseEmail`).
- [x] E2E `@smoke` listing summary + sort; `ui/e2e/features/account/accountReviews.spec.ts` (`@ci`).
- [x] Route guides: `account/reviews.md` (new) + `account/index.md`, `trip.md`, `properties.md`.

### Phase 6 — Org rollup + host public page

- [x] `list-org-reviews` (`verifyOrgAccess` + org `reviews:view`) + `/org/:orgSlug/reviews` page (H5) + org nav.
- [x] Host public page `/hosts/:orgSlug`: org average + recent reviews block (published only).
- [x] Route guides: `org/reviews.md` (new), host public page guide.

### Phase 7 — Automation (plan-gated `reviewAutomation`)

- [x] Auto-review rules per property: delay 1–13 days after check-out, ≥ 3 randomized templates with tokens (`{{guest_first_name}}`, `{{property_name}}`), default 5/5/5/5 + would host again, **auto-skip** when the booking has issue tags, an open maintenance item, or SD deductions; host can pause per booking. Stored in `review_automation_rules`; executed by `review-lifecycle-cron` (actor `cron`, activity row).
- [x] AI drafts: "Draft with AI" in H3 (uses booking + inbox thread) and in Respond (tone-aware) via existing AI credits metering; never auto-posts responses.
- [x] Full plans checklist (see Plans section) + `test:e2e:plans`.
- [x] Route guide + `plans-feature-matrix.md` + `planPresentation` + for-hosts pricing.

### Phase 8 — Hardening and launch

- [x] `security-auditor` review: IDOR on every id param, double-blind leak audit (no endpoint returns unpublished counterpart content, including counts with text, bell bodies, emails, PostHog), internal-note isolation across orgs, access-token scope on public writes, rate limits. Source-contract tests in `reviewDoubleBlind.test.ts`. Guest booking lookup uses parameterized `.eq('guest_email')` (no PostgREST `or` injection). `serveAuthenticated` applies per-user rate limits; public `get-guest-review` / `submit-guest-review` keep `publicGetRateLimitGate` / `antiSpamGate`.
- [x] Performance: local EXPLAIN ANALYZE on 10k seeded published rows (transaction rolled back). `property_id + status='published'` uses `idx_guest_reviews_property_published` (Bitmap Index Scan, 0.94ms). `guest_identity_key` uses `idx_host_guest_reviews_identity_published` (Index Scan, 0.014ms). Org rollup seq-scans when one org holds the whole table (expected); `idx_guest_reviews_org_published` exists for mixed-org data. Public listing still pages 20 review bodies; `reviewSummary` is a compact aggregate (distribution + category avgs), well under ±10% of a media-heavy property payload.
- [x] Manual QA guide `docs/guides/testing/reviews-manual.md` (window timing via local DB date edits, emails, cron run-now).
- [x] `bun run ci:quality --skip-install` green (quality gate passed). `test:edge` 762 passed. `test:edge:handlers` 216 passed / 17 ignored. `test:e2e:smoke` 129 passed. `CI=1 bun run test:e2e:ci` 285 passed (includes `ui/e2e/features/reviews/*` and `account/reviews`).
- [x] Rollout: `bun run deploy:supabase:dev` to `fworvijbrwpyngycotbz` applied migrations `20261316127300`–`20261316128000` (and concurrent 27700/27800/28100) and deployed review functions (`review-lifecycle-cron`, `list-my-reviews`, `submit-host-guest-review`, `review-automation-settings`, `draft-review-with-ai`, …). Local backfill sample (5 property bookings updated in the last 14 days, 0 windows yet): check-outs on 2026-10-20 / 10-18 / 10-10 stay eligible; 2026-07-08 and 2026-09-17 skip because `computeReviewWindow` close is already past. Cron fallback also skips `parking_id` rows. Local `review-lifecycle-cron` POST returned 503 because Docker `edge_runtime` was stopped; hosted cron + `docs/guides/testing/reviews-manual.md` cover the live run.

### Production review pass (2026-10-19)

End-to-end audit after Phase 8. Fixed in the same change (migrations `20261316128200`, `20261316128300`):

- [x] **Broken review links.** `get-guest-review` only served Airbnb zero-SD stays, so `/account/reviews`, the trip page and review emails 404'd for most bookings. It now serves any property stay past check-out (parking excluded).
- [x] **`PENDING_SD_REFUND` was not reviewable** by guest or host. `bookingReachedCheckout` now covers every post-checkout status.
- [x] **Access tokens.** Review emails mint `?access=`; `list-my-reviews` returns an owner-verified token per item, stored in sessionStorage (never in the URL). Required once `GUEST_BOOKING_ACCESS_ENFORCE` is on.
- [x] **Publish race.** Guest and host edits are conditional on `status = 'submitted'`, so an edit landing during publish cannot flip a published review back. Removed reviews cannot be resubmitted. Insert-conflict retry is bounded to one attempt.
- [x] **Org listing scope.** `list-org-reviews` ignored listing assignments, exposing other properties' reviews and private notes to scoped org members. Now limited to visible properties; per-property stats in one grouped query instead of one RPC per property.
- [x] **To write accuracy.** Due counts excluded neither reviewed nor expired windows. Host and guest To write lists paged on `closes_at` alone and dropped same-second check-outs; both use a `closes_at|booking_id` keyset cursor. Guest About you no longer loses the next page when a row is filtered.
- [x] **Cron.** Open windows keyset-paged (no starvation past 500). Activity rows only for orgs with activity, with that org's counts (previously every org with an open window got an hourly row carrying platform totals). Auto-review skip persisted; previously the same skip was re-counted every hour.
- [x] **Crash fix.** `reviewAutomation.ts` both re-exported and declared `hasIssueTags`, a duplicate export that breaks module load for `review-lifecycle-cron` / `review-automation-settings`. Removed; review handlers added to `check:edge-types`.
- [x] **Moderation.** Report claimed (`pending` guard) before the review is removed; sibling reports close on uphold; decision email goes to the real author (team member for host reviews) and the reporter, de-duplicated. Hosts can only report guest reviews.
- [x] **Emails.** Host response emails the guest only on the first response. Request email skipped when the guest already reviewed.
- [x] **AI draft privacy.** Inbox context matched the first thread whose name started with the guest's first name (could pull another guest's messages). Now the guest's own web thread by account only.
- [x] **UI.** SD step 1 dead end when the window closed (no button to the refund) and forced re-save of drafts: **Continue** added. Host review sheet no longer wipes typing when the draft refetches; saving refreshes To write and KPIs. Reviews pages: layout skeletons, error + retry, `–` instead of `0.0`. `/account/reviews`: Load more, error state, no duplicate Respond. Pause auto-review only while it can still act. Guest report sheet uses the guest shell and blocks double submit. Trip review card hidden when the SD form (which starts with the review) is the CTA.

### Live verification (2026-10-19, evening)

- [x] **Live lifecycle test** `bun run test:reviews:live` (`tests/reviewsLifecycleLocal.integration_test.ts`): self-seeding run on the real local stack covering review page + access tokens, To write, CAPTCHA block, double-blind, screening, publish on both sides, To write KPI, edit lock, About you without internal notes, guest + host responses, report scope, super-admin uphold + 409 on re-decide, org listing scope. Passes twice in a row; leaves no rows behind. Retries only gateway blips from a hot-reloading `functions serve`.
- [x] **375px pass** on host Reviews (received, respond sheet, write sheet), org Reviews and `/account/reviews`. Fixed: read-only stars on review cards rendered the disabled radio picker (dimmed, 44px gaps, announced as a radio group), now a single `role="img"` label; the write sheet opened with one star lit (dialog auto-focus previewed a 1-star rating), so focus preview is now keyboard-only; To write card truncated the stay name, now stacked on phones.
- [x] Full `ci:quality --skip-install` green (edge unit 856, handlers 227, smoke 129, build + budgets). Hosted dev redeployed: migrations `20261316128200` / `20261316128300` applied, all functions redeployed; every review function now boots (the earlier `BOOT_ERROR` on `review-lifecycle-cron` / `review-automation-settings` is gone; the cron returned a clean run).
- [ ] **Operator:** set `REVIEW_LIFECYCLE_CRON_SECRET` (Edge) and Vault `review_lifecycle_cron_secret` to the same value on hosted dev and on prod before launch. Dev currently accepts an unauthenticated cron POST; prod fails closed without it, so the hourly sweep would never run. Tracked on ledger PR-022.
- [ ] Manual only: real Turnstile widget, email rendering in a mail client, auto-review on a Pro org over real days, legal sign-off on Terms / Privacy Reviews sections.

---

## Testing matrix

| Layer        | Files                                                                                                                                                                  | Covers                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Deno unit    | `reviewWindow_test.ts`, `reviewEligibility_test.ts`, `reviewPublishing_test.ts`, `reviewContentPolicy_test.ts`, `reviewCategories_test.ts`, `guestIdentityKey_test.ts` | window math, eligibility matrix, publish atomicity, content rules |
| Deno handler | `tests/hostGuestReview.test.ts`, `tests/guestReviewSubmit.test.ts`, `tests/reviewLifecycleCron.test.ts`, `tests/reviewReports.test.ts`, `teamPermissionGates.test.ts`  | auth, RBAC, idempotency, reminders once, moderation               |
| Vitest       | `reviewCatalog.test.ts` (parity), `reviewWindow.test.ts`, `guestTripPhase.test.ts`, permission catalog drift tests, `planGateCoverage.test.ts` (Phase 7)               | mirrors + UI logic                                                |
| Playwright   | `ui/e2e/features/reviews/*` (`@ci`), listing summary (`@smoke`), vouchers specs updated                                                                                | journeys                                                          |
| Manual       | `docs/guides/testing/reviews-manual.md`                                                                                                                                | emails, cron timing, cross-org reputation                         |

---

## Docs to update

| File                                                    | Change                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PROJECT.md`                                       | "Reviews" section: lifecycle, endpoints, env var `REVIEW_IDENTITY_PEPPER`, cron                                                                                                                                                                                                                                                                                  |
| `docs/architecture/overview.md`                         | Two-way reviews in the full-app picture                                                                                                                                                                                                                                                                                                                          |
| `docs/architecture/data-model.md`                       | 3 new tables, `guest_reviews` columns, RPCs, notification types                                                                                                                                                                                                                                                                                                  |
| `docs/architecture/edge-functions.md`                   | New + changed functions                                                                                                                                                                                                                                                                                                                                          |
| `docs/architecture/validation-and-env.md`               | `REVIEW_IDENTITY_PEPPER`                                                                                                                                                                                                                                                                                                                                         |
| `docs/architecture/plans-feature-matrix.md`             | Reviews all tiers; `reviewAutomation` Pro+ (Phase 7)                                                                                                                                                                                                                                                                                                             |
| `docs/architecture/ai-dashboard-assistant.md`           | read + handoff entries                                                                                                                                                                                                                                                                                                                                           |
| `docs/archive/operations/scheduled-jobs-and-testing.md` | `review-lifecycle-cron`                                                                                                                                                                                                                                                                                                                                          |
| `docs/archive/operations/migration-runbook.md`          | Backfill notes, ordering                                                                                                                                                                                                                                                                                                                                         |
| `.cursor/rules/booking-workflow.mdc`                    | `ensureReviewWindow` side effect on check-out                                                                                                                                                                                                                                                                                                                    |
| `.cursor/rules/admin-auth.mdc`                          | `moderate-review-report`                                                                                                                                                                                                                                                                                                                                         |
| `.cursor/rules/security.mdc`                            | Guest review reads/writes token note (new functions)                                                                                                                                                                                                                                                                                                             |
| Route guides                                            | **new** `org/property/reviews.md`, `account/reviews.md`, `org/reviews.md`; **update** `sd-form.md`, `properties.md`, `trip.md`, `account/index.md`, `org/property/bookings-detail.md`, `org/property/settings.md` (email toggle), `org/property/team.md` (leaves), `admin/approvals.md`, `org/property/marketing.md` (published-only source), `routes/README.md` |
| `docs/workflow/planned/guest-review-facebook-cta.md`    | Point its Phase 2/3 wiring at `GuestReviewFlow` "Done" step                                                                                                                                                                                                                                                                                                      |
| `docs/workflow/planned/guest-trust-safety-reporting.md` | Note review disputes live here, not in T&S                                                                                                                                                                                                                                                                                                                       |
| Terms / Privacy pages                                   | Review policy (no incentives/pressure, removal grounds), host-review sharing for screening                                                                                                                                                                                                                                                                       |

---

## Risks

| Risk                                                                   | Mitigation                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Double-blind leak through side channels (bell text, email, counts)     | Single `reviewPublishing` gate; leak audit in Phase 8; tests assert unpublished content never in payloads |
| Retaliation / extortion via host reviews                               | Double-blind + report path + removal reason `retaliation`                                                 |
| Cross-org reputation privacy complaint                                 | Phase 0 legal sign-off, Terms disclosure, guest can read and respond, internal notes never shared         |
| Identity collisions (shared family email)                              | Key on account when linked; reputation shows stay count so hosts read it as a signal, not a verdict       |
| Rating deflation after decoupling voucher (fewer, more honest reviews) | Expected and desirable; communicate to hosts in release notes                                             |
| Migration on a busy `guest_reviews`                                    | Small table; additive columns with defaults; backfill in the same migration                               |

## Open questions

None. Resolved 2026-10-19 (user-confirmed):

1. D3: voucher **decoupled** from the review (claimable after submit or skip). No incentive-disclosure column or label needed.
2. D5: screening hosts see aggregate + tags **and** recent review text, with the authoring property generalized to its area.
3. D9: all 6 guest categories **required**.
4. Hosts **can** review guests of Airbnb-sourced bookings.

Still pending outside product: Phase 0 legal/privacy sign-off and final copy review.
