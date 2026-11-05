---
title: 'Activity — operator guide'
status: active
tags: [guides, routes, org, property, activity, audit-log]
updated: 2026-09-10
---

# Activity — operator guide

Route: `/org/:orgSlug/property/:propertySlug/settings` → **Activity** section → **Manage** (modal). Legacy `/org/:orgSlug/property/:propertySlug/activity` redirects to `…/settings?open=activity`. No property-sidebar link.

> **Status:** Documented

## Overview

Property-scoped slice of the org **activity / audit timeline** — every action against **this property**: booking transitions, direct booking-detail edits, cancellations, team changes for this property, settings / pricing / finance / maintenance edits, and guest actions on its public pages. Read-only.

Same feed / filters / detail sheet as the org-level page ([org/activity.md](../activity.md)); the scope is locked to this property (`scope=property`, `propertyId` bound). Listing-scoped team members see only the properties they are assigned to. Long feeds virtualize against the Manage modal scrollport past ~30 rows; the feed live-refreshes on new activity via the org's `activity:org:<orgId>` Broadcast channel. CSV export is owner / org-admin only and gated on the `activityLogExport` plan feature (Starter+).

## Host-facing knowledge

Activity is the read-only history for this property: booking changes, guest actions, team updates, and edits to settings, pricing, finance, and maintenance. Open it from **Settings** → **Activity** → **Manage**.

**Common host questions**

- Q: Where do I find this property's activity?
  A: Open the property **Settings**, find the **Activity** section, and choose **Manage**. The old direct Activity link opens the same modal.
- Q: Does this include actions from other properties?
  A: No. This view is limited to this property. Use the organization Activity view in Settings for everything across the org.
- Q: What can I search or filter?
  A: Search matches the summary and target, and you can filter by category, severity, and date range. The default window is the last 90 days.
- Q: Can I see the details of a change?
  A: Yes. Open a row to see who did it, when, from where, and which fields changed. Use **Back** to return to the feed.
- Q: Can I export this property's activity?
  A: Owners and org admins can export the filtered view to CSV on Starter and above. Viewing the feed is free on every plan.
- Q: Who can open Activity on a property?
  A: Team members whose role includes Activity access. Without it, the Activity section is hidden and the feed stays filtered to listings they can see.

## Permissions

Gated on **`activity:view`** (property Team catalog, module "Activity"). The Settings → Activity section is hidden without it and `list-activity-log` only returns rows for listings where the member holds the leaf. Owners, org admins with `org.activity:view`, and platform admins see everything. Existing members who could see bookings were backfilled with the leaf; Full Access, Operations, and Read Only templates include it.

## Related

- Org-wide view: [org/activity.md](../activity.md) · Parking: [org/parking/activity.md](../parking/activity.md)
- `<EntityActivityHistory>` renders a compact per-entity feed on the booking detail Overview tab, the property **Settings → Activity** section, and the finance / maintenance edit modals — see [org/activity.md](../activity.md) § Entity activity panels.

---

## Testing

| Layer | Path / spec                                                                           | Manual         |
| ----- | ------------------------------------------------------------------------------------- | -------------- |
| Unit  | `supabase/functions/_shared/activityLog.ts` catalog + redaction helpers               | —              |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` activity shell load (`@ci`) | CSV export     |
| N/A   | Per-booking `<EntityActivityHistory>` panel                                           | Booking detail |
