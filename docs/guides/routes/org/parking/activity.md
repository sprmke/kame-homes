---
title: 'Activity — operator guide'
status: active
tags: [guides, routes, org, parking, activity, audit-log]
updated: 2026-09-10
---

# Activity — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/settings` → **Activity** section → **Manage** (modal). Legacy `/org/:orgSlug/parking/:parkingSlug/activity` redirects to `…/settings?open=activity`. No parking-sidebar link.

> **Status:** Documented

## Overview

Parking-scoped slice of the org **activity / audit timeline** — every action against **this parking listing**: broadcast claims / declines, status changes, cancellations, payout actions, team changes, settings / pricing edits, and guest parking requests. Read-only.

Same feed / filters / detail sheet as the org-level page ([org/activity.md](../activity.md)); scope is locked to this parking (`scope=parking`, `parkingId` bound). Long feeds virtualize against the Manage modal scrollport past ~30 rows; the feed live-refreshes on new activity via the org's `activity:org:<orgId>` Broadcast channel. CSV export is owner / org-admin only and gated on the `activityLogExport` plan feature (Starter+).

## Permissions

Gated on **`activity:view`** in the parking catalog. The Settings → Activity section is hidden without it and `list-activity-log` only returns rows for parking slots where the member holds the leaf. Existing parking members with `bookings:view` were backfilled; the built-in Operations and Read Only roles include it.
---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |

## Related

- Org-wide view: [org/activity.md](../activity.md) · Property: [org/property/activity.md](../property/activity.md)
- `<EntityActivityHistory>` renders a compact feed in the parking **Settings → Activity** section — see [org/activity.md](../activity.md) § Entity activity panels.
