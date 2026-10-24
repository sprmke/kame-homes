---
title: 'Org Reviews — operator guide'
status: active
tags: [guides, routes, org, reviews]
updated: 2026-10-21
---

# Org Reviews — operator guide

Route: `/org/:orgSlug/reviews`

> **Status:** Documented

## Progress overview

| Section           | E2E save | Validation | Docs       | Notes                                                 |
| ----------------- | -------- | ---------- | ---------- | ----------------------------------------------------- |
| KPI cards         | —        | —          | Documented | Org average, count, response rate, to-write           |
| List toolbar      | —        | Yes        | Documented | Listing filter, search, rating / response, sort, view |
| From guests tab   | Yes      | Yes        | Documented | Every listing's published reviews; respond in place   |
| To write tab      | Yes      | Yes        | Documented | Open windows across listings; write without leaving   |
| About guests tab  | —        | —          | Documented | Host reviews of guests, org-wide                      |
| By property tab   | Yes      | —          | Documented | Per-listing rollup; row switches the feed to that one |
| Public host block | —        | —          | Documented | `/hosts/:orgSlug` average + recent published text     |

---

## Overview

The org rollup is the **same page as the property Reviews page**, scoped to every listing: `ReviewsListPage` with `scope="org"`. Same KPI cards, same tabs, same toolbar, same table and card views, same detail sheet, same pagination. The org scope adds three things: a **Listing** column, a **listing filter**, and a **By property** tab.

It is a working surface, not a read-only rollup: responding, reporting and writing guest reviews all happen here, against each review's own listing, without opening the property page.

Page order is the standard admin list: **KPI cards → tabs → toolbar → table or cards → pagination**.

**Auto-review is property-only.** Its rules are per listing, so the header **Auto-review** action appears on the property page only.

**Plans:** N/A. Core two-way reviews are free on every tier.

**activity-log:** the actions log exactly as they do on the property page (`review.response_posted` / `review.response_deleted`, `review.reported`), because they call the same endpoints with the row's `property_id`.

---

## Host-facing knowledge

This page is a portfolio view of guest reviews. You see how each property is rated, who still needs a review after checkout, and recent published guest comments. Open a property to reply or review a guest.

**Common host questions**

- Q: Can I reply from this page?
  A: Yes. Respond, edit a response or report a review straight from the list. Each one applies to the listing that review came from.
- Q: Why can I reply on one listing but not another?
  A: Replying needs the review permission on that listing. Your role may grant it on some and not others. Ask the owner for access.
- Q: How do I look at one property only?
  A: Use the **All listings** filter in the toolbar, or open the **By property** tab and tap a listing. The page address keeps your choice, so you can share or bookmark it.
- Q: Which listing needs attention?
  A: Open **By property** and sort by lowest rated, least responded or most to write.
- Q: Why is a listing average blank?
  A: That listing has no published guest reviews yet.
- Q: Do unpublished reviews show here?
  A: No. Guest reviews stay hidden until both sides finish or 14 days after checkout pass.
- Q: Why do I only see some properties?
  A: Your team role covers only the listings assigned to you. Ask the owner for access to more.
- Q: What does the public host page show?
  A: Guests see the org average and recent published reviews. Private notes never appear.

---

## Permissions

| Permission         | UI                                       |
| ------------------ | ---------------------------------------- |
| `org.reviews:view` | Open the page and read published reviews |

Seeded templates that already had `org.bookings:view` receive `org.reviews:view`.

**Listing scope:** owners, platform admins and org members with all-listings access see every property. Org members limited to assigned listings see only those properties in the KPIs, the table and the feed. The `property_id` filter can narrow the visible set, never widen it.

---

## KPI cards

The same four cards as the property page, summed across every visible listing: **Average rating**, **Reviews**, **Responded**, **To write**. Average and Responded show a dash, not `0.0` / `0%`, when there are no published reviews. Average opens the rating breakdown; To write switches to that tab.

The cards and the By-property table always cover **every** visible listing. Only the feed narrows when the listing filter is set, so the filter reads as "which listings am I looking at", not "which listings exist".

## Tabs

| Tab              | Query             | Holds                                                     |
| ---------------- | ----------------- | --------------------------------------------------------- |
| **From guests**  | _(default)_       | Published guest reviews across every visible listing      |
| **To write**     | `?tab=to_write`   | Open windows with no host review yet, across listings     |
| **About guests** | `?tab=written`    | Reviews the team wrote about guests, across listings      |
| **By property**  | `?tab=properties` | One row per listing: rating, reviews, responded, to write |

## List toolbar

Same controls as the property page plus the listing filter. Only one facet sits next to **Filters**, so the search field keeps its width: on the org rollup the listing filter takes that slot and the rating filter moves inside Filters.

| Control      | From guests                              | To write               | About guests             | By property             |
| ------------ | ---------------------------------------- | ---------------------- | ------------------------ | ----------------------- |
| **Search**   | Guest name + review text                 | Guest + listing name   | Guest name + review text | Listing name            |
| **Listings** | Multi-select                             | Multi-select           | Multi-select             | —                       |
| **Filters**  | Ratings · Responded / Awaiting           | —                      | Ratings · Would host     | —                       |
| **Sort**     | Newest · Oldest · Highest · Lowest rated | Closing soonest · last | Newest · Oldest · rated  | A–Z · rating · to write |
| **Per page** | 31 · 50 · 100                            | same                   | same                     | — (whole list)          |
| **View**     | Table · Card                             | same                   | same                     | same                    |

Everything is in the URL (`tab`, `q`, `properties`, `ratings`, `responded`, `hostAgain`, `sort`, `page`, `limit`, `view`, `listingSort`), so a filtered portfolio view is shareable. Switching tab keeps the view, page size and listing scope, and resets the tab-specific filters and sort.

The listing filter and the Listing column only appear when the caller can see more than one listing, and the column hides when the filter is already narrowed to exactly one.

## From guests, To write, About guests

Same rows, cards and detail sheet as the property page, with the listing added. Row actions come from **per-listing permissions**, not one page-level flag: the endpoint returns `canRespond` on each review (`reviews.responses:edit`) and `canWrite` on each open window (`reviews.guests:edit`), and the action is hidden where the caller lacks it. The endpoints re-check on every call, so hiding is presentation, not the boundary.

Opening a sheet pins it to that row's listing (`ReviewPropertyScopeProvider`), so Respond, Report and Write guest review post to the right property without a route change.

Unpublished counterpart reviews never appear. Internal host notes never appear.

Loading keeps the page chrome mounted and shows KPI and table or card skeletons; paging keeps the previous page on screen. A failed load shows **Try again**.

## By property

One row per visible listing: name, rating with stars, published count, responded rate, and a **to write** chip. Sort by listing name, rating, review count, least responded or most to write — that last one is the "which listing is behind" read.

A row click narrows the feed to that listing and returns to **From guests**; the to-write chip does the same into **To write**; the trailing action opens that listing's own Reviews page. Listings with no reviews show a dash rather than `0.0`, and sort last on rating.

---

## API reference

| Action      | Endpoint                                              |
| ----------- | ----------------------------------------------------- |
| List + KPIs | `GET list-org-reviews` (`org_slug` or `org_id`)       |
| Respond     | `POST respond-to-guest-review` (row's `property_id`)  |
| Report      | `POST report-review` (row's `property_id`)            |
| Write guest | `POST submit-host-guest-review` (row's `property_id`) |

Query: `?tab=received|written|to_write|properties` plus `q`, `properties` (comma-separated UUIDs; `property_id` still accepted), `ratings`, `responded`, `hostAgain`, `sort`, `page`, `limit`. The response is `{ tab, summary, items, total }` — offset pages with an exact total. `tab=properties` returns the summary with an empty feed, since that tab only needs the rollup.

Both Reviews endpoints share `_shared/reviewListParams.ts`, so the two pages accept the same vocabulary.

---

## Implementation map

| Concern       | Path                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page          | `ui/src/features/reviews/pages/OrgReviewsPage.tsx` → shared `ReviewsListPage.tsx` (`scope="org"`)                                                                                       |
| By property   | `ui/src/features/reviews/components/OrgPropertyReviewsTable.tsx`                                                                                                                        |
| Sheet scoping | `ui/src/features/reviews/lib/reviewPropertyScope.tsx` + `reviewPropertyScopeContext.ts`                                                                                                 |
| List state    | `ui/src/features/reviews/lib/orgReviewsApi.ts`, `propertyReviewsApi.ts`                                                                                                                 |
| Hook          | `ui/src/features/reviews/hooks/useOrgReviews.ts`                                                                                                                                        |
| Edge          | `supabase/functions/list-org-reviews/`                                                                                                                                                  |
| Shared list   | `supabase/functions/_shared/orgReviewList.ts`, `reviewListParams.ts`                                                                                                                    |
| Permissions   | `orgAuth.ts#resolvePropertyIdsWithPermissionForOrgUser`                                                                                                                                 |
| SQL           | `review_summary_for_properties`, `review_stats_by_property`, `host_review_due_counts` (migration `20261316128200`); `host_reviews_to_write_for_properties` (migration `20261316128520`) |

---

## Testing

| Layer | Path / spec                                                                |
| ----- | -------------------------------------------------------------------------- |
| E2E   | `ui/e2e/features/reviews/orgReviewsPage.spec.ts` (`@ci`)                   |
| Edge  | `supabase/functions/tests/propertyReviews.test.ts` (shared param contract) |

---

## Related

- Property page: [`property/reviews.md`](./property/reviews.md)
- Public host page: [`../properties.md`](../properties.md) (`/hosts/:orgSlug`)
