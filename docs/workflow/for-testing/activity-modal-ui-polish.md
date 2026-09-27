---
stage: for-testing
title: 'Activity Manage modal UI/UX polish'
status: for-testing
tags: [workflow, for-testing, activity-log, ui, mobile-native]
updated: 2026-09-27
kind: plan
---

# Activity Manage modal UI/UX polish

Polish the Settings → Activity → **Manage** modal (org, property, parking) so filters, search, export, and the feed are aligned, scannable, and fast with thousands of rows.

Parent feature: [`../for-testing/org-activity-audit-log.md`](../for-testing/org-activity-audit-log.md). Does **not** include [`activity-log-followups.md`](../planned/activity-log-followups.md) (RBAC leaves, cron summary rows, partitioning).

## Goals

1. Fix broken / unaligned toolbar chrome (search, Filters, Export).
2. Friendly, organized filters + search on desktop and mobile (category / severity / date selects inside Filters; no standalone Destructive control or category pills).
3. Smooth handling of large feeds: keyset infinite load + virtualization against the **modal scrollport** (not the window).
4. Readable rows: severity badge placement, line clamp, soften plan UUIDs (`to_plan_name` + client `friendlyActivitySummary`).
5. Keep EntityActivityHistory / SuperAdmin org activity on the shared feed/detail components.
6. Update org / property / parking Activity route guides.

## Non-goals

- Numbered page controls (keyset infinite scroll is the pagination model).
- Dedicated `*.activity:*` RBAC leaves (follow-ups plan).
- Backfilling historical summary text in the DB.

## Checklist

- [x] Modal shell: fixed height, toolbar outside scrollport, panel owns scroll
- [x] Desktop toolbar: Filters · search · Export, matching control heights
- [x] Mobile: search + refine sheet + export icon
- [x] Filters popover/sheet: Category multi-select; Severity All / Info / Notice / Warning / Destructive; single date-range field (`Calendar` mode=range); Clear only inside Filters
- [x] Removed feed “End of activity” footer and redundant toolbar “Clear all”
- [x] `ActivityFeedList` container virtualizer when `scrollParentRef` set
- [x] Infinite scroll `IntersectionObserver` rooted on the panel scrollport
- [x] Row + detail use friendly summaries; billing emitters store `to_plan_name`
- [x] Route guides updated
- [x] Unit tests for format helpers; type-check clean on touched files
- [x] E2E smoke: org + property Activity Manage opens with Search + Export (`orgHubSmoke` / `dashboardModulesSmoke`)

## Ledger

- **2026-09-27:** Implemented modal layout, `AdminListDesktopToolbar` trailing, container virtualization, friendly plan summaries, billing `to_plan_name`, route guides. Vitest activity suite green; Playwright `@ci` activity smokes green (6/6).
- **2026-09-27:** Moved Destructive into Filters severity select; replaced category pills + native dates with multi/single selects + `DatePicker`; removed “End of activity”.
- **2026-09-27:** Severity options expanded to all catalog levels; date filter is one range field (bookings calendar pattern); removed redundant Clear all under the toolbar.

## Related

- UI: `ui/src/features/dashboard/activity/**`
- Guides: `docs/guides/routes/org/activity.md` (+ property / parking)
- Shared toolbar: `AdminListDesktopToolbar` `trailing` slot
