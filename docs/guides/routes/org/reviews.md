---
title: 'Org Reviews — operator guide'
status: active
tags: [guides, routes, org, reviews]
updated: 2026-10-19
---

# Org Reviews — operator guide

Route: `/org/:orgSlug/reviews`

> **Status:** Documented

## Progress overview

| Section           | E2E save | Validation | Docs       | Notes                                             |
| ----------------- | -------- | ---------- | ---------- | ------------------------------------------------- |
| KPI strip         | —        | —          | Documented | Org average, count, response rate, to-write       |
| Property table    | —        | —          | Documented | Desktop table, phone list rows; links to property |
| Received feed     | Yes      | Yes        | Documented | Published guest reviews; property filter sheet    |
| Public host block | —        | —          | Documented | `/hosts/:orgSlug` average + recent published text |

---

## Overview

Org operators see guest-review performance across every property: portfolio average, per-listing counts, and a merged received feed. Responding and writing guest reviews still happen on the property Reviews page or booking detail.

**Plans:** N/A. Core two-way reviews are free on every tier.

**activity-log:** N/A. This page is read-only.

---

## Host-facing knowledge

This page is a portfolio view of guest reviews. You see how each property is rated, who still needs a review after checkout, and recent published guest comments. Open a property to reply or review a guest.

**Common host questions**

- Q: Can I reply from this page?
  A: No. Open the property Reviews page to write a public response.
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

## KPI strip

Same four cards as the property page: average, review count, response rate, to-write. To-write counts open review windows (not expired, not published) that have no host review yet, across the visible properties. Average shows `–` when there are no published reviews.

## Property table

One row per property: average, published count, response rate, to-write. Desktop uses a table. Phones use tappable list rows. Each name opens `/org/:orgSlug/property/:propertySlug/reviews`.

## Received feed

Published guest reviews across the org, newest first, cursor-paginated. Optional property filter (bottom sheet). Each card shows the guest, listing name, stars, public text, and host response when present. **Open property** goes to that listing's Reviews page.

Unpublished counterpart reviews never appear. Internal host notes never appear.

Loading keeps the page chrome mounted and shows card and row skeletons. A failed load shows **Try again** in place of the feed.

---

## API reference

| Action      | Endpoint                                        |
| ----------- | ----------------------------------------------- |
| List + KPIs | `GET list-org-reviews` (`org_slug` or `org_id`) |

Query: `?property_id=` (optional UUID) `&cursor=`.

---

## Implementation map

| Concern     | Path                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Page        | `ui/src/features/reviews/pages/OrgReviewsPage.tsx`                                                                 |
| Hook        | `ui/src/features/reviews/hooks/useOrgReviews.ts`                                                                   |
| Edge        | `supabase/functions/list-org-reviews/`                                                                             |
| Shared list | `supabase/functions/_shared/orgReviewList.ts`                                                                      |
| SQL         | `review_summary_for_properties`, `review_stats_by_property`, `host_review_due_counts` (migration `20261316128200`) |

---

## Related

- Property page: [`property/reviews.md`](./property/reviews.md)
- Public host page: [`../properties.md`](../properties.md) (`/hosts/:orgSlug`)
