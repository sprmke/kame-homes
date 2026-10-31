---
title: 'Host public profile page (/hosts/:orgSlug)'
status: active
tags: [workflow, done, marketing, public-ui]
updated: 2026-08-27
stage: done
kind: reference
---

# Host public profile page — shipped

Guest-facing org brochure at **`/hosts/:orgSlug`** (distinct from signed-in **`/org/:orgSlug`** dashboard).

## Shipped (2026-08-27)

| Area             | Change                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API**          | `get-public-host` uses batched `app_settings` / `parking_settings` reads (`batchLoadPropertyPricing`, `batchLoadParkingPricing`) — no per-listing `ensurePropertySettings` upserts. Fixes large-org 400s and redirect to `/properties`. |
| **Layout**       | When org has **both** homes and parkings: **`HostPublicListingsTabs`** (segmented pill tabs with counts). Single inventory type: section header + grid (no tabs).                                                                       |
| **Pagination**   | Inline chevrons on tab/header row; **4 visible rows** per page (`HOST_LISTING_MAX_ROWS`, responsive page size via `useHostListingPageSize`). Tab/page change scrolls listings into view.                                                |
| **Tabs styling** | Active tab uses org **`--primary`** (via `GuestPublicBrandShell`), not solid `foreground` black.                                                                                                                                        |

## Implementation map

| Piece          | Path                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Page           | `ui/src/features/guest/marketing/pages/HostPublicPage.tsx`                                        |
| Tabs           | `ui/src/features/guest/marketing/hosts/components/HostPublicListingsTabs.tsx`                     |
| Grid/page size | `ui/src/features/guest/marketing/hosts/lib/hostListingGrid.ts`, `hooks/useHostListingPageSize.ts` |
| API            | `supabase/functions/_shared/publicHostService.ts`, `publicListingFacets.ts`                       |
| Guides         | `docs/guides/routes/properties.md` § Public host profile                                          |

## Deferred (not in scope)

- Development-detail parity (hero banner/gallery from org settings)
- URL `?tab=` deep link
