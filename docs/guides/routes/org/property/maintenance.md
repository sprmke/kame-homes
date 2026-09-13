---
title: 'Maintenance — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-10
---

# Maintenance — operator guide

Route: `/org/:orgSlug/property/:propertySlug/maintenance`

> **Status:** Documented

## Progress overview

| Section        | E2E save | Validation | Docs       | Notes                                                                                |
| -------------- | -------- | ---------- | ---------- | ------------------------------------------------------------------------------------ |
| Summary cards  | —        | —          | Documented | Total, Telegram, completed, pending                                                  |
| Reminders CRUD | ✅       | ✅         | Documented | `maintenance_items`                                                                  |
| Export report  | ✅       | —          | Documented | PDF menu (header); includes by-category breakdown; Starter+ (`maintenanceReporting`) |

---

## Overview

Single-page maintenance view (no tabs), structured like Finance.

**Header (top right):** date range filter, **Export report**, **Add reminder**. On **phone/tablet**, Add + export options live in one hero ··· menu; the overlap toolbar is date range only.

**Summary cards:** Total, Telegram enabled, Completed, Pending — `AdminMetricCard` styling (matches Finance/Bookings).

**Reminders toolbar** (`MaintenanceRemindersToolbar`):

- **Mobile (`max-lg`):** search + refine icon (sheet: status / category / telegram / sort / per-page) + view toggle.
- **Desktop (`lg+`):** **Status** · **Filters** (category / telegram; nested selects stay open inside Filters and match trigger width) · **search (flex)** · sort · per-page · **View**

Status, category, and Telegram filters apply **client-side** on items already loaded for the date range; search still uses the API `q` param. List/card views paginate filtered results; calendar shows all matching rows for the period.

**Reminders list:** table / card / calendar (`?view=table|card|calendar`). CRUD via modal; recurring series and mark-as-done supported. On phone, card rows match Bookings density: title + **⋯** on the first line; status badge · date · category · recurrence on the second; edit / delete / series open from the **⋯** sheet (not inline icon buttons). Notes stay hidden until edit. `sm+` keeps the taller stacked card with notes and a footer action bar.

Maintenance Telegram defaults: **Notifications → Maintenance**.

Legacy **`?tab=settings`** redirects to **`/notifications?module=maintenance`**.

Recurring reminder definitions (not one-offs or done history) are bulk-copyable via org **Properties → Copy settings**.

---

## Host-facing knowledge

This page helps you track upkeep for your property: cleaning schedules, appliance checks, and other recurring reminders. You can add tasks, mark them complete, filter and search the list, switch between table, card, or calendar views, and export a report for a date range.

**Common host questions**

- Q: How do I get Telegram reminders for maintenance tasks?
  A: Go to **Notifications** and open the Maintenance section to connect your Telegram bot and turn on reminders. This page tracks the tasks; Notifications controls when alerts are sent.
- Q: Can I filter to see only what's still pending?
  A: Yes, use the status filter to show only pending or completed reminders, then sort by date to see what's due soonest.
- Q: What does the calendar view show?
  A: It lays out your maintenance reminders on a monthly calendar so you can spot busy weeks at a glance.

---

Client-side PDF generation via **Export report** in the header (shared layout in `ui/src/lib/pdf/`):

| Option           | Content                                          |
| ---------------- | ------------------------------------------------ |
| Full report      | Summary + by-category breakdown + reminders list |
| Overview summary | Summary cards + by-category table only           |
| Reminders list   | Reminder rows for the period                     |

**PDF layout (shared `@/lib/pdf/*`):** Soft page canvas; masthead **`Maintenance Report - {unit}`** + **`Date Range:`** subtitle; Plus Jakarta Sans (ExtraBold titles, Bold sections); bordered KPI cards; white table header/footer rows; reminder **Status** uses `STATUS_TONE` badge colors (Done = green, Pending = amber); category, count, and notes columns left-aligned. Hero metric uses brand accent rail. Footer: `{tower/unit} · Maintenance`.

Filenames: `kame-maintenance-{report|overview|reminders}_{from}_{to}.pdf`.

**Plan gating (`maintenanceReporting`, Starter+):** Export also requires **`maintenance.export:view`** (permission = visibility; plan = actionability). Reminder data stays visible with `maintenance:view` on every tier. Client: `useFeatureGate('maintenanceReporting')`. Export is client-side PDF only (no server export endpoint).

---

## Permissions

| Capability       | Required permission                |
| ---------------- | ---------------------------------- |
| Open Maintenance | `maintenance:view`                 |
| Add reminder     | `maintenance.reminders:add`        |
| Edit reminder    | `maintenance.reminders:edit`       |
| Delete reminder  | `maintenance.reminders:delete`     |
| Export report    | `maintenance.export:view` (+ plan) |

Legacy stored `maintenance:edit` expands to all reminder + export leaves.

---

## Implementation map

| Concern                | Path                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                   | `ui/src/features/dashboard/maintenance/pages/MaintenancePage.tsx`                                                                                                       |
| Summary cards          | `ui/src/features/dashboard/maintenance/components/MaintenanceSummaryCards.tsx`                                                                                          |
| Toolbar                | `ui/src/features/dashboard/maintenance/components/MaintenanceRemindersToolbar.tsx`                                                                                      |
| Export menu + PDF      | `ui/src/features/dashboard/maintenance/components/MaintenanceExportMenu.tsx`, `ui/src/features/dashboard/maintenance/lib/exportPdf.ts`, shared PDF layout `@/lib/pdf/*` |
| Filters / sort helpers | `ui/src/features/dashboard/maintenance/lib/maintenanceReminders.ts`                                                                                                     |
| Reminders list         | `ui/src/features/dashboard/maintenance/components/MaintenanceRemindersTab.tsx`                                                                                          |
| API                    | `maintenance-summary`, `maintenance-items`                                                                                                                              |

---

## Reminder activity history

The **Edit reminder** modal (`MaintenanceRemindersTab`) embeds `<EntityActivityHistory targetType="maintenance_item" targetId={editing.id} />` below the form — the recent `maintenance.task_created` / `_updated` events for that item (`list-activity-log`). Read-only; only shown when editing an existing reminder.

---

## Testing

| Layer | Path / spec                                                                         | Manual |
| ----- | ----------------------------------------------------------------------------------- | ------ |
| Unit  | Recurrence helpers mirror finance patterns when extracted                           | —      |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` maintenance shell (`@ci`) | —      |
| N/A   | PDF export layout checks                                                            | Manual |

---

## Related docs

- [Route index](../../README.md)
- [`docs/PROJECT.md`](../../../PROJECT.md)
