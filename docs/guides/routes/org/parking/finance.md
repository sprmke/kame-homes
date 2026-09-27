---
title: 'Parking finance — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-08-17
---

# Parking finance — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/finance`

> **Status:** Documented

## Overview

Same finance dashboard as property **`FinancePage`**, including the **brand hero** shell on phone/tablet (`AdminMobilePage` — one ··· menu for Add transaction + PDF export; date range in overlapping toolbar). Month/date filter, summary cards, cash-flow chart, ledger toolbar (table / card / calendar), **Add Transaction**, and **Export report**. Operating income and expense lines are scoped to the parking slot via `parking_id` on `finance_line_items`. There is no stays ledger for parking (no `guest_submissions` link); summary cards and charts reflect operating transactions only.

---

## Host-facing knowledge

Parking **Finance** tracks money in and out for this slot only: rent collected, maintenance, supplies, and other operating lines. It works like property finance: add income or expenses, view them in a table or calendar, export reports, and set Telegram reminders for due dates. There is **no stays ledger** here because parking finance is separate from guest stay bookings.

**Common host questions**

- Q: Can I see guest stay payments on this page?
  A: No. This ledger is for the parking slot’s own operating transactions. Guest stay payments stay under each **property’s** finance module.
- Q: How do I get reminded before a bill is due?
  A: Configure **Finance** notifications (Telegram) under this slot’s **Notifications** page, then add due dates when you create or edit expense lines.
- Q: Who can add or delete transactions?
  A: Team members with finance edit access for this parking slot. View-only roles can see summaries but not change lines.

---

## Permissions

Requires parking team **`finance:view`** (read) and **`finance:edit`** (create/update/delete transactions). Enforced server-side in `resolveFinanceAssetAccess` → `verifyParkingTeamAccess`.

---

## Add / edit transaction

- **Add Transaction** opens the shared `FinanceTransactionModals` / `OperatingLineItemForm` (income or expense, category, amount, date, notes, recurrence, Telegram reminder when finance Telegram is configured for this parking slot).
- Configure finance Telegram under **Notifications → Finance** (`/notifications?module=finance`).
- Edit/delete from table, card, or calendar row actions.
- Recurring series: same modal flows as property finance.

---

## Export

**Export report** menu: overview, transactions, and full report (PDF). Stays ledger export is hidden on parking finance.

CSV: `GET /functions/v1/finance-export?parking_id=…&type=…`

---

## API

| Method                | Edge function        | Scope          |
| --------------------- | -------------------- | -------------- |
| GET                   | `finance-summary`    | `?parking_id=` |
| GET/POST/PATCH/DELETE | `finance-line-items` | `?parking_id=` |
| GET                   | `finance-export`     | `?parking_id=` |

Property finance uses `property_id` instead; never send both.

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Concern      | Path                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Page         | `ui/src/features/dashboard/parking/pages/ParkingFinancePage.tsx`                               |
| Shared UI    | `ui/src/features/dashboard/finance/components/*`                                               |
| Hooks        | `useFinanceSummary`, `useFinanceLineItems` (asset scope via `useAdminAssetScope`)              |
| API client   | `ui/src/features/dashboard/finance/hooks/useFinanceApi.ts`, `assetEdgeFetch`                   |
| DB           | `finance_line_items.parking_id` — migration `20260919120000_finance_line_items_parking_id.sql` |
| Server scope | `supabase/functions/_shared/financeAssetScope.ts`                                              |
| Server CRUD  | `supabase/functions/finance-line-items/index.ts`                                               |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |
