---
title: 'Property Reviews — operator guide'
status: active
tags: [guides, routes, org, property, reviews]
updated: 2026-10-19
---

# Property Reviews — operator guide

Route: `/org/:orgSlug/property/:propertySlug/reviews`

> **Status:** Documented

## Progress overview

| Section           | E2E save | Validation | Docs       | Notes                                                           |
| ----------------- | -------- | ---------- | ---------- | --------------------------------------------------------------- |
| KPI strip         | —        | —          | Documented | Average, count, response rate, to-write                         |
| Received tab      | Yes      | Yes        | Documented | Published guest reviews; respond / report / marketing deep link |
| Written tab       | —        | —          | Documented | Host reviews of guests                                          |
| To write tab      | Yes      | Yes        | Documented | Open windows without a host review                              |
| Super-admin queue | —        | Yes        | Documented | Reported reviews on `/admin/approvals` Type = Reviews           |
| Auto-review       | Yes      | Yes        | Documented | Pro+ `reviewAutomation`; templates, skip rules, Draft with AI   |

---

## Overview

Property operators manage stay reviews here: published guest reviews of this listing, reviews they wrote about guests, and guests still waiting for a host review during the 14-day window.

Core reviews are ungated on every plan. Team RBAC uses `reviews:view`, `reviews.guests:edit`, and `reviews.responses:edit`.

**Plans:** Core page ungated on every tier. Auto-review rules, pause, and Draft with AI are **`reviewAutomation` (Pro+)**. Preview-open card; Enable / Save / Draft open the upgrade prompt below Pro.

**activity-log:** `review.response_posted` / `review.response_deleted` on respond; `review.reported` on report; `review.removed` when a super-admin upholds a report; `review.automation_updated` on save rules; `review.auto_review_paused` / `review.auto_review_resumed` per booking. Cron auto-submits are counted on `system.cron_run` (`autoReviewsSubmitted` / `autoReviewsSkipped`), one row per org per run and only when that org had activity.

**Guest email on response:** the guest gets one email when the response first appears. Editing or removing it sends nothing.

**Report scope:** hosts report guest reviews of their stay. The team's own review of a guest cannot be reported (edit it before publish instead). When a super-admin removes a review, other open reports on it close with it.

**Auto-review skip is final per booking:** once auto-review skips a stay (issue tags, open maintenance, deposit deduction), it does not retry that booking. The host reviews it by hand. Stored in `booking_review_windows.auto_review_skipped_reason`.

**Draft with AI context:** uses the guest's own web-chat thread at this property (matched by account), never a thread found by name.

---

## Host-facing knowledge

This page is where you read guest reviews of this listing, write a public response, and review guests after checkout. Guest reviews stay hidden until both sides finish or the 14-day window closes.

**Common host questions**

- Q: Why don't I see a guest's review yet?
  A: Reviews stay hidden until you review the guest, they review you, or 14 days after checkout pass.
- Q: Can I edit my response?
  A: Yes. You can change or remove the public response from Received.
- Q: What does Report do?
  A: It sends the review to the platform team. They can keep it or remove it. You can file up to two open reports per review.
- Q: What is Use in marketing?
  A: It opens Marketing Studio on Posts with that review selected, so you can put it on a graphic.
- Q: What does Auto-review do?
  A: On Pro, it can post your guest review from a template a few days after checkout. It skips stays with issue tags, open maintenance, or a reduced deposit. You can pause it on one booking. Draft with AI writes text for you to edit. It never posts a response on its own.
- Q: Auto-review skipped a stay. Will it try again?
  A: No. Review that guest yourself from To write or the booking.
- Q: Does the guest get an email every time I edit my response?
  A: No. Only when your response first appears.

---

## Permissions

| Permission               | UI                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `reviews:view`           | Open the page, read published reviews                                                                |
| `reviews.guests:edit`    | Write / edit a guest review; save auto-review rules; pause auto-review; Draft with AI on host review |
| `reviews.responses:edit` | Respond, edit/remove response, report a review; Draft with AI on the response                        |

---

## Tabs

### Received

Published guest reviews of this property. Each card: stars, text, categories, private note (host-only), public response, Respond, overflow (Use in marketing, Report).

Unpublished counterpart reviews never appear here.

### Written

Host reviews of guests for this property (submitted or published). Unpublished rows show as hidden until publish.

### To write

Open review windows (not expired, not published) with no host review yet, soonest close first. Write opens the same guest-review sheet as booking detail; saving refreshes this list and the KPIs. Pagination uses a `closes_at|booking_id` cursor because same-day check-outs close at the same second (`host_reviews_to_write` RPC).

Loading keeps the page chrome mounted and shows card and row skeletons. A failed load shows **Try again**. The guest-review sheet keeps what the host typed when the saved draft refetches in the background.

---

## Save path

1. Respond → `POST respond-to-guest-review` (`bookingId`, `responseText`)
2. Report → `POST report-review` (`reviewKind`, `reviewId`, `reason`, `details` ≥ 30 chars)
3. Write guest review → `POST submit-host-guest-review` (same as booking Stay tab)
4. Auto-review rules → `PATCH review-automation-settings` `{ action: 'saveRules', ... }`
5. Pause auto-review → `PATCH review-automation-settings` `{ action: 'setPaused', bookingId, paused }`
6. Draft with AI → `POST draft-review-with-ai` `{ bookingId, kind: 'host_review' \| 'guest_response' }` (fills the sheet; never posts)

---

## API reference

| Action      | Endpoint                                    |
| ----------- | ------------------------------------------- |
| List + KPIs | `GET list-property-reviews`                 |
| Respond     | `POST respond-to-guest-review`              |
| Report      | `POST report-review`                        |
| Write guest | `POST submit-host-guest-review`             |
| Auto-review | `GET/PATCH review-automation-settings`      |
| AI draft    | `POST draft-review-with-ai`                 |
| Moderate    | `POST moderate-review-report` (super-admin) |

Query: `?tab=received|written|to_write&cursor=` plus `property_id`.

---

## Implementation map

| Concern        | Path                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Page           | `ui/src/features/reviews/pages/PropertyReviewsPage.tsx`                                                                   |
| Cards / sheets | `ui/src/features/reviews/components/`                                                                                     |
| Hooks          | `ui/src/features/reviews/hooks/usePropertyReviews.ts`                                                                     |
| List service   | `supabase/functions/_shared/propertyReviewList.ts`                                                                        |
| Edge           | `list-property-reviews`, `respond-to-guest-review`, `report-review`, `review-automation-settings`, `draft-review-with-ai` |
| Super-admin    | `moderate-review-report`, `list-super-admin-approvals` (reported)                                                         |

---

## Testing

| Layer   | Path / spec                                                                                     | Manual                                                    |
| ------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Handler | `supabase/functions/tests/propertyReviews.test.ts`, `reviewReports.test.ts`                     | —                                                         |
| E2E     | `ui/e2e/features/reviews/hostReviewsPage.spec.ts` (`@ci`)                                       | —                                                         |
| Live    | `bun run test:reviews:live` (local stack: double-blind, publish, report, moderation, org scope) | [`reviews-manual.md`](../../../testing/reviews-manual.md) |

---

## Related docs

- [Route index](../../README.md)
- [`docs/workflow/for-testing/two-way-reviews.md`](../../../../workflow/for-testing/two-way-reviews.md)
- [Approvals](../../admin/approvals.md)
- [Bookings detail](./bookings-detail.md)
- [Marketing](./marketing.md)
