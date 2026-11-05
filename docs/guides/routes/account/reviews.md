---
title: 'Guest Account Reviews — operator guide'
status: active
tags: [guides, routes, account, reviews]
updated: 2026-10-19
---

# Guest Account Reviews — operator guide

Route: `/account/reviews`

> **Status:** Documented

## Progress overview

| Section   | E2E save | Validation | Docs       | Notes                                    |
| --------- | -------- | ---------- | ---------- | ---------------------------------------- |
| To write  | Yes      | Yes        | Documented | Open windows without a guest review      |
| By you    | —        | Yes        | Documented | Own reviews; edit while unpublished      |
| About you | —        | Yes        | Documented | Published host reviews; teaser if hidden |

---

## Overview

Signed-in guests manage stay reviews here. Tabs: stays still to review, reviews they wrote, and reviews hosts wrote about them after publish. Core reviews are ungated on every plan.

**Plans:** N/A (all tiers). **activity-log:** guest `review.response_posted` / `review.reported` on respond/report.

---

## Host-facing knowledge

Guests leave stay reviews from their account, trip page, or the email link. They cannot see what you wrote about them until both of you finish or 14 days after checkout pass.

**Common host questions**

- Q: Can a guest change their review later?
  A: Only until it publishes. After that they can add one public response to your review of them.
- Q: Why does a guest say your review is hidden?
  A: They still need to write theirs, or the 14-day window is still open and you submitted first.
- Q: Where does a guest write the stay review?
  A: From their account Reviews tab, the trip page, or the email link. It opens the same review form.

---

## Tabs

### To write

Open 14-day windows (not expired) with no guest review yet, soonest close first. Write review opens `/properties/:slug/guest-review`, which works for every property stay past check-out, not only Airbnb stays. Paging uses a `closes_at|booking_id` cursor.

Each list item carries a booking access token (the signed-in guest owns the booking). The page stores it in sessionStorage so the review page loads even when `GUEST_BOOKING_ACCESS_ENFORCE` is on; the token never goes in the URL.

### By you

The guest's own reviews. Pending until publish. Edit while pending. Host responses show under published rows.

### About you

Published host reviews of this guest (no internal notes). If the host submitted first and the guest has not, a teaser says "Hidden until you review" with no ratings or text. **Respond** (or **Edit response**) is the card button; **Report** is in the card's overflow menu.

All tabs page 20 items with **Load more**. Load errors show **Try again**.

---

## API reference

| Action  | Endpoint                      |
| ------- | ----------------------------- |
| List    | `GET list-my-reviews`         |
| Respond | `POST respond-to-host-review` |
| Report  | `POST report-review` (guest)  |

Query: `?tab=to_write|by_you|about_you&cursor=`

---

## Implementation map

| Concern | Path                                                              |
| ------- | ----------------------------------------------------------------- |
| Page    | `ui/src/features/guest/account/pages/GuestAccountReviewsPage.tsx` |
| API     | `ui/src/features/reviews/lib/guestReviewsApi.ts`                  |
| Edge    | `list-my-reviews`, `respond-to-host-review`, `report-review`      |
| Nav     | `guestAccountNav.ts` · `guestAccountPaths.ts`                     |

---

## Testing

| Layer | Path / spec                                              | Manual                                                 |
| ----- | -------------------------------------------------------- | ------------------------------------------------------ |
| E2E   | `ui/e2e/features/account/accountReviews.spec.ts` (`@ci`) | —                                                      |
| Deno  | `supabase/functions/tests/guestMyReviews.test.ts`        | —                                                      |
| Live  | `bun run test:reviews:live` (local stack)                | [`reviews-manual.md`](../../testing/reviews-manual.md) |

---

## Related docs

- [Route index](../../README.md)
- [Trip](../trip.md)
- [Property Reviews](../org/property/reviews.md)
