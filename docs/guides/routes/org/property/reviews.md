---
title: 'Property Reviews — operator guide'
status: active
tags: [guides, routes, org, property, reviews]
updated: 2026-10-22
---

# Property Reviews — operator guide

Route: `/org/:orgSlug/property/:propertySlug/reviews`

> **Status:** Documented

## Progress overview

| Section           | E2E save | Validation | Docs       | Notes                                                                  |
| ----------------- | -------- | ---------- | ---------- | ---------------------------------------------------------------------- |
| KPI cards         | —        | —          | Documented | Average rating, Reviews, Responded, To write (opens the tab)           |
| Rating breakdown  | —        | —          | Documented | Star distribution + six category averages, in a sheet off Average      |
| List toolbar      | —        | Yes        | Documented | Search, rating / response filters, sort, per page, Table · Card        |
| From guests tab   | Yes      | Yes        | Documented | Published guest reviews; respond / report / marketing deep link        |
| To write tab      | Yes      | Yes        | Documented | Open windows without a host review yet                                 |
| About guests tab  | —        | —          | Documented | Host reviews of guests                                                 |
| Super-admin queue | —        | Yes        | Documented | Reported reviews on `/admin/approvals` Type = Reviews                  |
| Auto-review sheet | Yes      | Yes        | Documented | Pro+ `reviewAutomation`; timing, posted ratings, templates, skip rules |

---

## Overview

Property operators manage stay reviews here: published guest reviews of this listing, reviews they wrote about guests, and guests still waiting for a host review during the 14-day window.

Page order matches every other admin list (Bookings, Finance, Maintenance): **KPI cards → tabs → toolbar → table or cards → pagination**.

This page and the [org rollup](../reviews.md) are the same component — `ReviewsListPage` with `scope="property"` / `scope="org"`, the way Bookings does it. Changes to the tabs, toolbar, tables, cards or detail sheet land on both; keep that in mind when editing either. Auto-review settings are **not** in the page body; they live in a sheet opened from the page header, so the list stays a list.

Core reviews are ungated on every plan. Team RBAC uses `reviews:view`, `reviews.guests:edit`, and `reviews.responses:edit`.

**Plans:** Core page ungated on every tier. Auto-review rules, pause, and Draft with AI are **`reviewAutomation` (Pro+)**. Preview-open sheet; Enable / Save / Draft open the upgrade prompt below Pro.

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
- Q: Where is Auto-review?
  A: Open it from **Auto-review** in the page header (sparkles icon on phone).
- Q: How do I find one review?
  A: Use the search box for the guest's name or words from the review, then narrow with the rating and response filters. The page address keeps your filters, so you can share or bookmark the list.
- Q: Can I see reviews as a table instead of cards?
  A: Yes, on a computer. Use the view control on the right of the toolbar. Phones always show cards.
- Q: Where did the ratings chart go?
  A: Tap the **Average rating** card to open the star breakdown and the category scores.
- Q: What does Auto-review do?
  A: On Pro, it can post your guest review from a template a few days after checkout. It skips stays with issue tags, open maintenance, or a reduced deposit. You can pause it on one booking. Draft with AI writes text for you to edit. It never posts a response on its own.
- Q: What rating does Auto-review post?
  A: Whatever you set under **What it posts** in the Auto-review sheet. It defaults to 5 stars on every category and Would host again.
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

## KPI cards

Four stat cards, the same row every other property list page opens with: **Average rating** (stars under the value), **Reviews**, **Responded**, **To write**. All four read the `summary` block `list-property-reviews` already returns. Average and Responded show a dash, not `0.0` / `0%`, when there are no reviews.

Two of them are controls: **Average rating** opens the rating breakdown sheet, and **To write** switches to that tab (and highlights while it is open).

## Rating breakdown

A sheet, not a page band: the 5→1 star distribution with counts and the six guest category averages (Cleanliness, Accuracy, Check-in, Communication, Location, Value). Opened from the Average rating card.

## List toolbar

One toolbar for all three tabs, built from the shared admin list controls.

| Control      | From guests                              | To write               | About guests                       |
| ------------ | ---------------------------------------- | ---------------------- | ---------------------------------- |
| **Search**   | Guest name + review text                 | Guest name             | Guest name + review text           |
| **Ratings**  | Multi-select 1–5 stars                   | —                      | Multi-select 1–5 stars             |
| **Filters**  | Responded / Awaiting response            | —                      | Would host again / Would not       |
| **Sort**     | Newest · Oldest · Highest · Lowest rated | Closing soonest · last | Newest · Oldest · Highest · Lowest |
| **Per page** | 31 · 50 · 100                            | same                   | same                               |
| **View**     | Table · Card                             | same                   | same                               |

Every control is in the URL (`q`, `ratings`, `responded`, `hostAgain`, `sort`, `page`, `limit`, `view`), so a filtered list is shareable and survives a reload. Switching tab keeps the view and page size and resets the tab-specific filters and sort. Search is debounced 300 ms and resets to page 1, as do all filters.

Phone and tablet get the standard compact chrome: search + a **Refine** sheet holding filters, sort and per page. Card is the only phone view, so no view toggle is drawn there.

## Table and card views

Desktop defaults to **Table**; phone and tablet always render **Cards**. Both open the same detail sheet.

| Tab              | Table columns                                              |
| ---------------- | ---------------------------------------------------------- |
| **From guests**  | Guest · Rating · Review · Response · Stay · actions        |
| **To write**     | Guest · Stay · Window · actions                            |
| **About guests** | Guest · Rating · Review · Host again · Submitted · actions |

Columns drop progressively below `xl` / `lg` / `md`; the guest cell carries the dates on narrow screens. Row actions are Respond (From guests), Write review (To write), and an overflow menu with Open booking, Use in marketing and Report.

## Tabs

Tab labels name the subject, not the voice. Query values are unchanged (`received | written | to_write`), so existing links keep working.

| Tab              | Query           | Holds                                              |
| ---------------- | --------------- | -------------------------------------------------- |
| **From guests**  | _(default)_     | Published guest reviews of this listing            |
| **To write**     | `?tab=to_write` | Open windows with no host review yet (count badge) |
| **About guests** | `?tab=written`  | Reviews the team wrote about guests                |

### From guests

Published guest reviews. The row (or card) carries guest, stars, an excerpt and whether it has a response; opening it shows the full review in a sheet: review text (clamped past ~320 characters with **Show more**), the guest's feedback tags, any attached photos or clips (open in a new tab), that stay's category scores, the host-only **Private note** (neutral surface) and the public **Your response** (brand surface, so the two do not read alike). The sheet's actions are **Report**, **Open booking** and **Respond** / **Edit response**; **Use in marketing** stays in the row and card overflow menus.

Unpublished counterpart reviews never appear here.

### To write

Open review windows (not expired, not published) with no host review yet, soonest close first. Each row shows the guest, the stay dates, and a **N days left** chip that turns amber inside 3 days. The tab carries a count badge from `summary.dueCount`.

**Auto-review** rules open from the page header (**Auto-review** on desktop, sparkles on phone). Write opens the same guest-review sheet as booking detail; saving refreshes this list and the KPI cards. The `host_reviews_to_write` RPC has no filter or sort arguments, so the server scans the open window once (capped at 200 rows — the 14-day window keeps the set small) and then searches, sorts and pages it.

### About guests

Reviews the team wrote about guests (submitted or published). Rows show stars, the submitted date and a **Would host again** / **Would not host again** chip; opening one shows the review text, the guest's reply when there is one, and **Open booking**. Rows still waiting are marked **Hidden until publish** with the remaining window.

Loading keeps the page chrome mounted and shows KPI and table or card skeletons; paging keeps the previous page on screen while the next one loads. A failed load shows **Try again**. The guest-review sheet keeps what the host typed when the saved draft refetches in the background.

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

Query: `?tab=received|written|to_write` plus `q`, `ratings` (comma-separated 1–5), `responded`, `hostAgain`, `sort`, `page`, `limit` and `property_id`. The response is `{ tab, summary, items, total }` — offset pages with an exact total, so the list shows numbered pagination instead of Load more. Filters that do not belong to a tab are ignored server-side, and an unknown `sort` falls back to that tab's default.

Guest names live on the stay, not on the review, so a name search first resolves matching `guest_submissions` ids and ORs them into the review query. Search terms are stripped of `,` `(` `)` before they reach a PostgREST `or()` clause.

---

## Implementation map

| Concern      | Path                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Page         | `ui/src/features/reviews/pages/PropertyReviewsPage.tsx` → shared `ReviewsListPage.tsx` (`scope="property"`)               |
| KPI cards    | `ui/src/features/reviews/components/ReviewsSummaryCards.tsx`                                                              |
| Breakdown    | `ui/src/features/reviews/components/ReviewsRatingSheet.tsx`                                                               |
| Toolbar      | `ReviewsToolbar.tsx`, `ReviewsFilters.tsx`, `ReviewsViewToggle.tsx`                                                       |
| Table / card | `ReviewsTable.tsx`, `ReviewsCardGrid.tsx`, shared `ReviewCardContent.tsx`                                                 |
| Detail sheet | `ui/src/features/reviews/components/ReviewDetailSheet.tsx`                                                                |
| List state   | `ui/src/features/reviews/lib/propertyReviewsApi.ts` (URL ⇄ query ⇄ API params)                                            |
| Auto-review  | `ReviewAutomationSheet.tsx` (page header)                                                                                 |
| Sheets       | `ui/src/features/reviews/components/`                                                                                     |
| Hooks        | `ui/src/features/reviews/hooks/usePropertyReviews.ts`                                                                     |
| List service | `supabase/functions/_shared/propertyReviewList.ts`, `reviewListParams.ts` (query vocabulary shared with the org rollup)   |
| Edge         | `list-property-reviews`, `respond-to-guest-review`, `report-review`, `review-automation-settings`, `draft-review-with-ai` |
| Super-admin  | `moderate-review-report`, `list-super-admin-approvals` (reported)                                                         |

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
