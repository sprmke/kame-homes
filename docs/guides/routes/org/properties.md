---
title: 'Organization Properties — operator guide'
status: active
tags: [guides, routes, org, properties]
updated: 2026-09-27
---

# Organization Properties — operator guide

Route: `/org/:orgSlug/properties`

> **Status:** Documented

## Progress overview

| Section             | E2E save | Validation | Docs | Notes                                                                                              |
| ------------------- | -------- | ---------- | ---- | -------------------------------------------------------------------------------------------------- |
| Summary cards       | Done     | —          | Done | Total, total revenue, avg monthly revenue, avg occupancy                                           |
| Search & filters    | Done     | —          | Done | Name, slug, tower, address, status, type; bookings-style toolbar                                   |
| Table / grid / list | Done     | —          | Done | Table (desktop), grid cards, list rows; client pagination                                          |
| Property cards      | Done     | —          | Done | Name title, tower/unit subtitle                                                                    |
| Add property        | Done     | Done       | Done | Dialog → settings on create                                                                        |
| Copy settings       | Done     | Done       | Done | 4-step wizard; Phases 0–4 coded; see [[workflow/for-testing/property-settings-copy-to-properties]] |

---

## Overview

Org-level inventory of all properties. On **phone/tablet**, uses the shared **brand hero** shell (`AdminMobilePage`, `dense`) with a **`MobileHeroActionMenu`** (Copy settings / Add property when permitted). Filters sit in a **`FloatingToolbar`** via shared **`OrgListingToolbar`** (Bookings chrome: search + refine + view toggle; desktop Status + Filters popover + per-page + View). Cards / list / table surface profile data from `properties` + `properties.settings` and booking KPIs for the **current Manila calendar month** (not all-time). Large catalogs paginate client-side (31 / 50 / 100); no always-on results count meta. Table is desktop-only (`lg+`).

**Access:** Requires **`org.properties:view`** (org owner, org hub member with the leaf, platform admin). **Property-only members** (`accessKind: property_member`) cannot open org routes — `RequireOrgPermission` redirects them to an assigned property dashboard. Scoped org admins (`all_listings = false`) only see assigned properties.

**Add property:** Requires **`org.properties:create`** (grantable on org templates; owners and platform admins always have it).

**Copy settings:** Shown when the org has **at least two** properties (header button + property ⋯ menu). Server enforces per-target edit permissions and plan gates (skip + report).

**Loading:** hero stays mounted; summary cards, toolbar, and listings render as `OrgListingPageSkeleton` in the default view (list under five, table on desktop / grid on phone at five+, from the cached property count). Same on Parkings.

---

## Host-facing knowledge

This page is the catalog of every rental you operate under the organization. Summary cards at the top show how many properties you have and how they’re performing this month; each property card shows photos, location, and booking stats. Use it to jump into a property dashboard, open settings, or copy the guest booking link. When you have more than one property, **Copy settings** lets you reuse configuration from one unit onto others without redoing setup by hand.

**Common host questions**

- Q: Why does revenue on a card differ from what I expect for all-time earnings?
  A: Revenue and occupancy on this page use the **current calendar month** (Philippines time), not lifetime totals. Active booking counts are pipeline bookings still in progress.
- Q: Why can’t I see the **Add property** button?
  A: Your org role needs permission to add properties. Owners always have it; invited members only if their template or custom permissions include it.
- Q: How do I send a guest to book a specific unit?
  A: Open the property’s actions menu and choose **Copy guest link** or **Guest calendar**. Both point guests to that property’s public booking entry.
- Q: How do I copy settings from one property to another?
  A: On **Properties**, tap **Copy settings** in the header, or open a property’s ⋯ menu and choose **Copy settings**. Pick the source property, choose which groups to copy (listing, pricing, templates, notifications, and more), select one or more other properties, review the preview, then confirm. Name, address, and tower/unit stay on each target. Bookings, guests, payment methods, team members, and calendar date blocks are never copied. If a target’s plan or your permissions don’t allow a group, that group is skipped for that property and listed in the review.

---

## Stats period (important)

All revenue and occupancy figures on this page use the **current calendar month in `Asia/Manila`**, matching the dashboard default trend window (`dashboardService.ts#defaultManilaMonthRange`).

| Metric                                             | Scope                              | Formula                                                                                                                                                                                    |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Per-property revenue** (`stats.monthlyRevenue`)  | Current Manila month, one property | Sum of **booking rate** allocated to **occupied nights** that fall inside the month (same proration as dashboard **rated revenue** / calendar price pills). Excludes `CANCELLED` bookings. |
| **Per-property occupancy** (`stats.occupancyRate`) | Current Manila month, one property | `round(occupiedNightsInMonth ÷ daysInMonth × 100)`. One property → max 100% if every night is booked.                                                                                      |
| **Per-property bookings** (`stats.activeBookings`) | All time (pipeline)                | Count of rows where `status` is not `CANCELLED` and not `COMPLETED`.                                                                                                                       |

---

## Summary cards

| Card                    | Computation                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Total properties**    | Count of all org properties (`ACTIVE` + `INACTIVE`).                            |
| **Total revenue**       | Sum of each property’s `stats.monthlyRevenue` for the **current Manila month**. |
| **Avg monthly revenue** | `totalRevenue ÷ totalProperties` (includes properties with ₱0).                 |
| **Avg occupancy**       | Mean of each property’s `stats.occupancyRate` for the **current Manila month**. |

---

## Property card / list row

| UI element              | Source                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Image carousel          | `properties.settings.media` — swipe/drag on touch and pointer; arrows and dots change slide only      |
| Card navigation         | Stretched link behind card body; carousel and **⋯** menu sit above it and do not trigger navigation   |
| **Title**               | `properties.name`                                                                                     |
| **Subtitle**            | Tower + unit (`properties.tower` + `properties.unit_number`, or legacy `tower_and_unit`) when present |
| **Residence**           | Org / development — `text-xs` meta line when `developmentName` or org name is passed                  |
| **Location**            | `{residence}, {city}, {province}` comma-separated on one `text-xs` line (no map icon)                 |
| Description (list only) | `settings.description`                                                                                |
| **Bookings**            | Active pipeline count (see table above)                                                               |
| **Revenue**             | Current-month lodging revenue for this property                                                       |
| **Occupancy**           | Current-month occupancy % for this property                                                           |

Cards omit type and bed/bath/guest chips (type remains available via the toolbar filter; capacity lives in property settings).

---

## Filters

| Control  | Behavior                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Search   | Name, slug, tower, unit, residence, address (debounced; clear control)                                                        |
| Status   | `ACTIVE` / `INACTIVE` — desktop leading filter; in refine sheet on phone                                                      |
| Type     | Case-insensitive match on `properties.type` — desktop Filters popover; in refine sheet on phone                               |
| Per page | 31 / 50 / 100 (same sizes as Bookings); resets to page 1                                                                      |
| View     | **Table** (desktop only), **Grid**, **List**. Default list when fewer than five properties; table (or grid on phone) at five+ |

Toolbar layout matches Bookings / Finance: phone uses search + refine icon + segmented view toggle; desktop uses `AdminListDesktopToolbar` (Status · Filters · search · per-page · View).

**Pagination:** client-side over the filtered list. Page controls appear when there is more than one page (same pattern as Bookings; no always-on count meta above the list).
---

## Actions menu

| Action          | Target                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Open dashboard  | `/org/:orgSlug/property/:propertySlug`                                                                     |
| Settings        | `…/settings`                                                                                               |
| Guest calendar  | Public `/?property=<slug>` (new tab)                                                                       |
| Copy guest link | Clipboard                                                                                                  |
| Copy settings   | Opens **Copy settings** wizard (source = this property); hidden when the org has fewer than two properties |

---

## Add property

**Add property** (header button, empty state, sidebar switcher **+**) → `AddPropertyDialog` → **`POST create-property`** (`org:properties:create`) → navigates to new property **Settings**. Hidden for org **Admin** and property-only members.

---

## Copy settings

**Entry:** Header **Copy settings** (desktop) / hero ⋯ (mobile), or property card/list **⋯ → Copy settings**. Visible when `properties.length >= 2`.

**Wizard (`CopyPropertySettingsDialog`)** — four steps:

1. **Source** — pre-filled from the card menu; otherwise pick from ACTIVE/INACTIVE org properties.
2. **Groups** — checkbox tree by property sidebar module (**Settings** first, then Pricing, Team, Marketing, Inbox, Notifications, Templates, Public Pages, Finance, Maintenance). Child labels match Settings sections / page headings (e.g. Email Automations, Telegram notifications, Pinned snippets). Nested opt-ins appear under their parent when checked: **Include email recipients** (under Email Automations), **Include Telegram credentials** (under Telegram notifications). Separate **Options**: **Override existing settings** (on by default; turn off to leave target groups that already have values unchanged). Contact details stay off by default under Settings.
3. **Targets** — multi-select of other org properties; **Select all** / **Clear** toggle; search when the list is long; scrollable list.
4. **Confirm** — loads a dry-run preview per target (will copy / skipped / failed / unchanged). Primary **Copy settings** runs the real copy. Preview uses a separate request from the copy mutation so the footer does not show “Copying…” during preview. Batches over 10 targets require an extra confirm checkbox. Footer: **Back** (left after step 1) · **Cancel** + **Next** / **Copy settings** (right). **Back** stays available while the preview loads.

**What is copied (when selected):** listing details and content, amenities, house rules, cancellation, brand/socials, photos/videos, guest-form toggles, building-form fields (+ signature assets), email automation timing/toggles (+ recipients if opted in), pricing rates/fees/holiday rules, Smart Pricing settings, voucher config, Telegram notification config (+ shared bot token; per-module credentials if opted in), inbox snippets, templates (incl. section images), public-page template/config (showcase stays unpublished), marketing designs, voice receptionist + AI overrides, custom team **role definitions**, recurring finance/maintenance **series definitions** (new series on the target from the next due date).

**What is never copied:** property identity (name, slug, tower/unit, address, maps), payment methods, bookings/guests, date overrides / blocked dates, channel sync feeds, Meta connections / inbox threads, team members & invitations, plans/billing, finance/maintenance one-offs and history, reviews proof, Google calendar/spreadsheet IDs, announcement read state. Cross-org and parking listings are out of scope.

**Per-target skips:** For each selected group, the edge function checks that target’s edit permission leaf(s) and plan feature (when gated). Failures are skip+report; the rest of the batch continues. Same-org only.

**Plans / Team RBAC:** Plan feature **`copyPropertySettings`** (Pro / `growth` and above). Wizard is browseable below Pro; Confirm **Copy settings** and the real edge write require the feature (`TierBadge` / upgrade modal). Team RBAC: N/A new leaf — reuses existing per-group edit leaves. Entry is not gated by a dedicated org leaf.

**After a real run:** `property_settings_copy_log` row; in-app `property_settings_copied` per target with applied groups; settings-change notice email to org owner / target notify recipients. Recent runs appear under **Copy history** on the org Properties page (`POST copy-property-settings` with `{ action: 'listLogs', orgSlug }`).

Full registry table: [[workflow/for-testing/property-settings-copy-to-properties]] §2.

---

## API reference

| Action        | Endpoint                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| List + stats  | `GET list-properties?orgSlug=` → `{ properties: [{ …, stats }] }`                                                                           |
| Create        | `POST create-property` — **`org:properties:create`** (owner / platform admin)                                                               |
| Copy settings | `POST copy-property-settings` — body `{ sourcePropertyId, targetPropertyIds, groups, options?, dryRun? }` → `{ dryRun, results[], logId? }` |
| Copy history  | `POST copy-property-settings` — body `{ action: 'listLogs', orgSlug, limit? }` → `{ logs[] }` (org member; service-role read)               |

### `stats` shape (per property)

```json
{
  "activeBookings": 2,
  "monthlyRevenue": 95000,
  "occupancyRate": 78
}
```

Server: `list-properties` loads org properties, batch-loads `guest_submissions` for those IDs, then `propertyListStats.ts` → `dashboardService.ts#computePropertyPeriodStats` per property.

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Concern                  | Path                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                     | `ui/src/features/dashboard/org/pages/OrgPropertiesPage.tsx`                                                                                                               |
| Cards / list / table     | `OrgPropertyCard.tsx`, `OrgPropertiesTable.tsx`                                                                                                                           |
| Copy settings UI         | `ui/src/features/dashboard/org/components/org-properties/CopyPropertySettingsDialog.tsx`                                                                                  |
| Copy history UI          | `ui/src/features/dashboard/org/components/org-properties/CopyPropertySettingsHistory.tsx`                                                                                 |
| Copy settings hook / API | `ui/src/features/dashboard/org/hooks/useCopyPropertySettings.ts`, `usePropertySettingsCopyLogs.ts`, `lib/copyPropertySettingsApi.ts`, `lib/copyPropertySettingsGroups.ts` |
| Carousel                 | `ui/src/features/dashboard/org/components/org-properties/OrgPropertyImageCarousel.tsx`                                                                                    |
| Summary / toolbar        | `OrgPropertiesSummaryCards.tsx`, `OrgPropertiesToolbar.tsx` → shared `OrgListingToolbar.tsx`                                                                              |
| Pagination / view mode   | `orgListingPagination.ts`, `useOrgListingPagination.ts`, `orgListingViewMode.ts`, `useOrgListingViewMode.ts`, `OrgListingViewToggle.tsx`                                  |
| Card model               | `ui/src/features/dashboard/org/lib/orgPropertyCardModel.ts`                                                                                                               |
| Title helpers            | `ui/src/features/dashboard/org/lib/propertyDisplay.ts`                                                                                                                    |
| Stats aggregation        | `supabase/functions/_shared/propertyListStats.ts`, `dashboardService.ts#computePropertyPeriodStats`                                                                       |
| List API                 | `supabase/functions/list-properties/index.ts`                                                                                                                             |
| Copy API                 | `supabase/functions/copy-property-settings/index.ts` + `_shared/propertySettingsClone*.ts`, `propertyAssetClone.ts`                                                       |

---

## Testing

| Layer | Path / spec                                                                      | Manual                   |
| ----- | -------------------------------------------------------------------------------- | ------------------------ |
| Unit  | `orgListingViewMode.test.ts`, `orgListingPagination.test.ts`                     | —                        |
| Unit  | `supabase/functions/_shared/propertySettingsClone_test.ts`                       | —                        |
| E2E   | `ui/e2e/features/org/orgHubSmoke.spec.ts` inventory shell load (`@ci`)           | —                        |
| E2E   | `ui/e2e/features/org/copyPropertySettingsDryRun.spec.ts` dry-run preview (`@ci`) | Real multi-property copy |
| N/A   | Add property dialog full create flow                                             | —                        |

---

## Related docs

- [Route index](../README.md)
- [Property settings](./property/settings.md)
- [`docs/PROJECT.md`](../../PROJECT.md)
- Plan: [[workflow/for-testing/property-settings-copy-to-properties]]

---

## Pending / follow-ups

- [ ] Delete/archive shortcuts from card actions menu (today: settings → Danger zone)
- [ ] Per-property deep link to filtered bookings list from stats row
- [ ] Optional plpgsql atomic RPCs for multi-row clone groups (deferred / out of v1)
