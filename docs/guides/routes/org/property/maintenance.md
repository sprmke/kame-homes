---
title: 'Maintenance — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-11-06
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

**Reminders list:** table / card / calendar (`?view=table|card|calendar`). CRUD via a **3-step** modal (Details → Reminders → Preview); recurring series and mark-as-done supported. On phone, card rows match Bookings density: title + **⋯** on the first line; status badge · date · category · recurrence on the second; edit / delete / series open from the **⋯** sheet (not inline icon buttons). Notes stay hidden until edit. `sm+` keeps the taller stacked card with notes and a footer action bar.

**Category picker** (`CategoryCombobox`, shared with Finance): presets are ordered by trade and frequency (plumbing, electrical, aircon, appliance, cleaning, pest control, repairs, painting, structural, landscaping, pool, safety, amenities, supplies, utilities, other). Typing filters the list; the pinned **Use "…"** row saves a custom category. Choosing **Other (type your own)** clears the field and prompts for a custom name. Enter picks the highlighted preset or the typed value, Escape restores the value from before opening. Presets live in `maintenanceCategories.ts`.

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
- Q: Can a maintenance reminder repeat on a schedule?
  A: Yes. When you add or edit a reminder, set it as a recurring series. One-off tasks and completed history stay separate.
- Q: Is exporting a maintenance report included on my plan?
  A: Viewing reminders is included on every plan. PDF export needs the reporting feature, which starts on Starter, and the export permission on your team role.
- Q: None of the categories match my task. Can I create one?
  A: Yes. Pick **Other (type your own)**, then type the category name and press Enter (or choose **Use "…"**). It saves with the reminder and appears in filters, cards, and reports like the built-in categories.

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

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Concern                | Path                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                   | `ui/src/features/dashboard/maintenance/pages/MaintenancePage.tsx`                                                                                                          |
| Loading skeleton       | `MaintenancePageBodySkeleton` (`FinancePageSkeleton.tsx`) — KPIs, toolbar, then reminders table (desktop) / cards (phone) or calendar from `?view=`                        |
| Summary cards          | `ui/src/features/dashboard/maintenance/components/MaintenanceSummaryCards.tsx`                                                                                             |
| Toolbar                | `ui/src/features/dashboard/maintenance/components/MaintenanceRemindersToolbar.tsx`                                                                                         |
| Export menu + PDF      | `ui/src/features/dashboard/maintenance/components/MaintenanceExportMenu.tsx`, `ui/src/features/dashboard/maintenance/lib/exportPdf.ts`, shared PDF layout `@/lib/pdf/*`    |
| Filters / sort helpers | `ui/src/features/dashboard/maintenance/lib/maintenanceReminders.ts`                                                                                                        |
| Reminders list         | `ui/src/features/dashboard/maintenance/components/MaintenanceRemindersTab.tsx`                                                                                             |
| Category picker        | `ui/src/features/dashboard/finance/components/CategoryCombobox.tsx` (shared with Finance), presets in `ui/src/features/dashboard/maintenance/lib/maintenanceCategories.ts` |
| API                    | `maintenance-summary`, `maintenance-items`                                                                                                                                 |

---

## Reminder activity history

The **Edit reminder** modal (`MaintenanceRemindersTab`) uses a stepper (`MaintenanceItemForm`: Details → Reminders → Preview). Footer: **Back** (left after step 1) · **Cancel** + **Next** / **Save** (right). Embeds `<EntityActivityHistory targetType="maintenance_item" targetId={editing.id} />` on the **Preview** step — the recent `maintenance.task_created` / `_updated` events for that item (`list-activity-log`). Read-only; only shown when editing an existing reminder.

---

## Guest-reported issues

The guest AI receptionist (web/Meta auto-reply, host Suggest) can file a reminder on the guest's behalf with the `report_maintenance_issue` tool when a signed-in guest reports something broken during their own active stay. Requires the `aiChatAutoReply` plan feature and is rate-limited to 3 reports a day per guest. Filed rows use `category: 'Guest reported'`, `created_by: 'guest_ai'`, and the guest's own description in `notes` — same table and UI as a host-added reminder, no schema or UI change. The host gets a `maintenance_guest_reported` notification and an `inbox.ai_handoff`-style activity-log row. Source: `_shared/guestReceptionistTools.ts`.

---

## Testing

| Layer | Path / spec                                                                         | Manual |
| ----- | ----------------------------------------------------------------------------------- | ------ |
| Unit  | `maintenanceItemFormSteps.test.ts`; recurrence helpers mirror finance               | —      |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` maintenance shell (`@ci`) | —      |
| N/A   | PDF export layout checks                                                            | Manual |

---

## Related docs

- [Route index](../../README.md)
- [`docs/PROJECT.md`](../../../PROJECT.md)
