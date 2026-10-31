---
title: 'Bookings List — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-08-27
---

# Bookings List — operator guide

Route: `/org/:orgSlug/property/:propertySlug/bookings`

> **Status:** Documented

## Progress overview

| Section                       | E2E save  | Validation | Docs | Notes                                                             |
| ----------------------------- | --------- | ---------- | ---- | ----------------------------------------------------------------- |
| Summary stage cards           | —         | —          | Done | Finance-style cards; status hints inline; click toggles `?stage=` |
| Filter bar                    | —         | —          | Done | Mobile: search + refine sheet + view; desktop: inline filters     |
| Table / card / calendar views | —         | —          | Done | Existing behavior                                                 |
| Kanban view                   | via modal | —          | Done | Reuses `WorkflowPanel` from detail page                           |
| New booking (modal)           | via modal | server     | Done | Embeds `GuestForm`; skips guest auth gate; inline success view    |
| CSV import (modal wizard)     | via modal | server     | Done | Property-scoped; `bookings.import:add` + Starter+ `bookingImport` |
| Mobile shell                  | —         | —          | Done | Brand hero + overlap filters (`max-lg` only)                      |

---

## Overview

Paginated booking list with PMA-style **stage summary cards** and four view modes: **table**, **card**, **kanban**, **calendar**.

Layout (top → bottom):

1. **Mobile (`max-lg`):** brand hero with tenant switcher + **Import** icon + **New booking** icon (property scope); overlapping floating toolbar with **date range** only (same as Finance / Maintenance); layout frosted header hidden on this route.
2. **Desktop (`lg+`):** page header — **date range** (top right) + **Import** (outline) + **New booking** → opens `AdminNewBookingModal` (in-dashboard modal; see below)
3. **Summary cards** — Action Required, Pending Docs, Confirmed Stays, History (Finance-style `surface-card`; count + inline status hints; click toggles `?stage=` filter)
4. **Toolbar** (`BookingFilters` in page body — always visible, matches Finance / Maintenance):
   - **Mobile (`max-lg`):** search + refine icon (opens sheet for status / more filters / sort / per-page) + view toggle (**Kanban** hidden below `md` / phone width)
   - **Desktop (`lg+`):** **Status** · **Filters** (more only) · **search (flex)** · sort · per-page · **View**. Filters left of search; presentation controls on the right. Toolbar controls match Team height (`h-10` + `min-h-[44px]` → 44px). Status/Filters popovers omit redundant titles and use comfortable row spacing.
5. Active view content + pagination (table/card only)

---

## Host-facing knowledge

This page is your main dashboard for all bookings at this property. Summary cards group reservations by workflow stage, and you can switch between table, card, kanban, or calendar views to find and work bookings the way you prefer.

**Common host questions**

- Q: What do the summary cards at the top mean?
  A: They group bookings by where they are in your workflow: things needing your action, waiting on guest documents, confirmed upcoming stays, and past or cancelled bookings. Tap a card to filter the list.
- Q: Can I move a booking forward without opening every detail page?
  A: Yes on **tablet and desktop** (Kanban view). Drag bookings between columns — the board auto-scrolls near the edges, and status chips above the board stay visible (valid ones highlight green while you drag). You can also click a card to open a quick workflow panel with the same actions as the full booking page. On phone, use card or table (desktop) and open a booking for workflow actions.
- Q: How do I create a new booking?
  A: Use **New booking** in the page header. It opens the same guest booking form in a dialog, right in the dashboard — fill it out on the guest's behalf. After you submit, you can add another booking or jump straight to the new booking's detail page.
- Q: Can I bulk-import bookings from a spreadsheet?
  A: Yes on **Starter and above**. Use **Import** beside **New booking** (property bookings only). You can open the wizard and upload a file on Free to try it, but continuing past the first step asks you to upgrade. On a paid plan, confirm column mapping, then review the rows. Select **Need fixing** to see problem rows; **Fix** opens the complete row so you can correct every invalid value together. **Skipped** rows stay openable the same way, so use **Restore** to bring them back, or **Fix** to correct them. Past stays commit as **Imported**; today and future stays show **Pending Review** but still appear when you filter by **Imported**. No new-booking emails or calendar events on import.
- Q: How do I read the calendar view?
  A: Use **Month**, **Week**, or **Day** in the calendar toolbar. Month shows stays as colored pills across nights — click a pill to open that booking, or click a day for the side list. If a day has more stays than fit in the cell, you’ll see a **+N** chip — click the day to review them all. Week and Day show an hour grid so you can see checkout/check-in gaps; multi-night stays read as one continuous block. Hover uses a darker shade of that booking’s status color (not the brand primary). A pricing-style tip appears on hover. In week view, tap a day header to zoom into that day.

---

## New booking (modal)

**Gated:** org owner/admin, or property team members with **`bookings.create:add`**. Hidden at org-wide bookings scope.

**Entry:** **New booking** button in the page header (desktop) or hero icon (mobile). Opens `AdminNewBookingModal` — no route change, target property fixed from the current page context.

The modal embeds the same multi-step guest booking form used on the public site (`GuestForm`, embedded mode) — same steps, same field validation, same downpayment-receipt upload. Two admin-only differences from the public flow:

- No guest sign-in is required before submitting (the admin is already authenticated; the form would otherwise share the guest sign-in session and could disrupt the admin's own login).
- On success, the modal shows an inline summary (dates, guests, email, phone) instead of navigating to the public "Booking Confirmed" page, with two actions: **Add another booking** (resets the form for another entry, same modal) and **View booking** (closes the modal and opens the new booking's detail page). The bookings list refreshes in the background so the new booking appears without a manual reload.

Submission goes through the same `submit-form` edge function and side effects (email, calendar, PDF) as a guest-submitted booking — the admin is simply filling out the form on the guest's behalf.

---

## CSV import (modal wizard)

**Gated:** org owner/admin, or property team members with **`bookings.import:add`** (legacy stored id `import:manage` still expands). Hidden at org-wide bookings scope. Plan feature **`bookingImport`** (Starter+): Free hosts can open the wizard and upload a file (preview-open); **Continue** on Upload (and Match / Preview / Commit server paths) open the upgrade modal / require the plan. The **Import** toolbar button shows a solid `TierBadge` when not entitled. Permission gates visibility; plan gates actionability.

**Entry:** **Import** button in the page header (desktop) or hero icon (mobile). Opens `ImportWizardModal` — no route change. Target property is fixed from the current page context (no property picker).

**Steps:**

1. **Upload** — CSV or Excel (`.csv`, `.xlsx`, `.xls`), max 2,000 rows / 15 MB. Calls `import-parse-file` (CSV via PapaParse; Excel via SheetJS, **first worksheet only**). File is held in storage until commit or cancel. **Continue** stays disabled until the file parses successfully; no toast on success. **Back** from later steps returns here with the same file — use **Replace** to pick a different file.
   - **Google Sheets:** not a native upload — in Sheets use **File → Download → Microsoft Excel (.xlsx)** or **CSV**, then upload that file.
   - **Download template** first opens a short confirmation explaining that existing CSV or spreadsheet files can be uploaded as-is because column matching is automatic. **Download template** confirms and builds a CSV client-side (`lib/importCsvTemplate.ts`); **Cancel** returns to Upload. The file has one header row of 21 canonical columns (starting with `guest_display_name`, which commits to DB column `guest_facebook_name`) plus one example row showing the expected date (`YYYY-MM-DD`), time (`HH:mm`), and yes/no shapes. It must stay uploadable as-is — no note lines and no second table, or every row's column count disagrees with the header and the upload fails. Legacy header `guest_facebook_name` still auto-maps.
   - **QA fixtures:** run `node scripts/dev/generate-import-booking-fixtures.mjs` — writes scenario CSVs and matching `.xlsx` samples under `temp/import-booking/` (gitignored; see README there).
   - **Parse tolerance:** a UTF-8 BOM is stripped, blank lines are skipped, and ragged rows (a trailing note, a short row, an over-wide row) are accepted — they arrive as fixable rows in Preview instead of rejecting the file. Only unparseable input (e.g. an unterminated quoted field) aborts the upload.
2. **Match** — AI suggests column → field matches (`import-ai-map-columns`). Requires `import_column_map` in the platform AI allowlist (`/admin/settings`); when the feature is disabled or AI keys are unavailable, matching degrades to **basic mode** (exact header matches only) with a warning. The same step uses the Preview-style clickable summary cards, ordered **Matched** then **Need input**. It auto-selects Need input whenever unresolved columns exist; otherwise it selects Matched. Need input shows every ambiguous/unmatched header with sample values and a booking-field selector; Matched shows the confirmed source → target pairs. Continue stays on this four-step flow, requires every mandatory booking field to be mapped, then persists the complete mapping with `import-save-mapping`. Save failures (including local edge 502 while functions restart) show an inline error with **Try again**.
3. **Preview** — row validation errors (blocking) vs property mismatch warnings (non-blocking). The Ready / Need fixing / Skipped / Warnings summary cards are the filters. Entering the step auto-selects **Need fixing** when any error rows exist, otherwise **Ready**; if the host clears the error queue while Need fixing is selected, it switches to Ready. Select the active card again to show all. The Issue column has a fixed readable width and shows the field, reason, and quoted bad value. **Fix** opens a row editor at the same desktop width as the import wizard: **Row details** are on the left and all blocking **Fields to fix** are on the right; invalid fields remain visible in Row details using their original bad value and red text, while missing invalid values appear as `—`. Client validation runs on every edit. The primary **Fix** action stays disabled until every flagged value is valid, then `import-update-row` `{ fieldValues }` patches `raw_data` and re-validates server-side. **Skip** leaves a row out of the import (matching the **Skipped** status) and keeps its validation issues so the row stays reviewable. Skip and Fix use equal minimum widths. **Skipped** rows stay clickable (row or **Fix**) and open the same editor titled **Skipped row N** with **Restore** + **Fix** instead of Skip + Fix; Restore calls `import-update-row` `{ validationStatus: 'valid' }` and re-validates — a row that comes back still invalid moves to Need fixing and toasts that it needs fixing. A skipped row with no blocking issues shows Restore alone as the primary action. The editor's queue and its Skip/Restore mode are fixed when it opens: opening from Need fixing walks the error rows, opening from Skipped walks the skipped rows, and Prev/Next stay available in both. Acting on a row drops it from that queue and moves to the next one in it; the editor never switches queues mid-session and closes once the queue it opened with is empty. Ready rows use the **Import** switch. Phone: stacked cards + bottom sheet; tablet+: table + dialog.
4. **Commit** — a compact summary shows how many bookings are ready and how many rows are not included. Under it, the host reviews only the rows that will be created in a paginated table: source row number, guest, check-in, check-out, total guests (adults + children), and booking rate. Ten rows render at a time; phone layouts use compact stacked rows with the same information. The review reads from the existing Preview cache and makes no extra API request. Email and calendar side-effect details are intentionally omitted from this screen to avoid confusion. `import-commit` inserts rows with **`imported_from_batch_id`**; **past** check-ins get **`status = IMPORTED`**, **today/future** get **`PENDING_REVIEW`** (Asia/Manila). No email/calendar/PDF side effects. Success toast + list refresh.

**Leave / discard:** Closing the wizard (X, Escape, overlay) after a file is parsed asks for confirm (**Leave this import?**). **Discard import** runs `import-cancel` (deletes batch + storage) and closes; **Keep working** or Escape dismisses only the confirm and returns to the current step. Both dismiss paths are blocked while a network action is in flight.

**Manual override after commit:** from booking detail, admin can move **`IMPORTED → PENDING_REVIEW`** or **`IMPORTED → CANCELLED`** (manual-only). Future imports already start at **`PENDING_REVIEW`**.

**Filters:** **Imported** in the status filter (explicit chip) matches literal **`IMPORTED`** rows **and** batch-linked rows (including future **`PENDING_REVIEW`** imports). **History** stage includes past **`IMPORTED`** only (not future imports). Past **`IMPORTED`** rows are excluded from Action Required, SD-refund cron, and guest calendar availability; future import rows block availability like normal pending bookings.

---

## Stage summary cards

Click a card to filter the list (table, card, kanban, calendar). Click again to clear.

| Card            | Label                                      | Statuses included                                                                    |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Action Required | Action Required                            | `PENDING_REVIEW`, `READY_FOR_CHECKOUT`, `PENDING_SD_REFUND`                          |
| Pending Docs    | **Pending Docs** (not “Awaiting Response”) | `PENDING_DOCUMENTS`, `PENDING_GAF`, `PENDING_PARKING_REQUEST`, `PENDING_PET_REQUEST` |
| Confirmed Stays | Confirmed Stays                            | `READY_FOR_CHECKIN`                                                                  |
| History         | History                                    | `COMPLETED`, `CANCELLED`, `IMPORTED`                                                 |

**URL:** `?stage=action_required|pending_docs|confirmed|history` (omit for all).

Counts come from a secondary list fetch (same date range, up to 100 rows, includes completed).

When a stage is active, the list query sends the matching `status[]` values to `list-bookings` (intersected with manual status filters when compatible; otherwise stage wins).

---

## Views

| View     | URL               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table    | default (desktop) | `BookingTable`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Card     | `?view=card`      | Mobile default. Phone list rows: guest name + amount; full status badge on its own line; stay dates with optional flags trailing (no chevron, no `Nn`/`Ng`). Property label only when org-scoped. Email omitted on phone (on booking detail). `sm+` keeps the taller stacked card with email, nights/guests, and footer flags.                                                                                                                                 |
| Kanban   | `?view=kanban`    | **Property scope only**, **`md+`** (768px+). Hidden on phone and at org-wide scope. Reuses card styling; workflow modal                                                                                                                                                                                                                                                                                                                                        |
| Calendar | `?view=calendar`  | **Month** (default): square day cells; occupancy pills inset from cell edges with status-tone borders; multi-week join sides open; stacked lanes + `+N` overflow chips. **Week** / **Day**: hourly time grid; stay blocks use status-tone borders only (no brand-primary / destructive clash rings); hover darkens the same status tone across the whole stay; pricing-style tooltips. Month \| Week \| Day toggle (`limit=100`, `showCompletedBookings=true`) |

---

## Kanban

- **Availability:** property bookings only, viewport **`md` and up** (tablet → desktop). The view toggle omits Kanban on phone; `?view=kanban` redirects to card when the viewport is below `md`.
- Columns follow workflow order: Pending Review → GAF / Parking / Pet → Ready for Check-in → Ready for Check-out → Pending SD Refund → Completed. There is **no** separate **Pending Documents** column — bookings with `status = PENDING_DOCUMENTS` appear in the first incomplete nested step (GAF, then parking, then pet; all complete → Ready for Check-in). **Cancelled** bookings are omitted from the board. Columns are slightly narrower so more stages fit before horizontal scroll.
- **Click** a card → opens the workflow sheet with stage-specific forms and actions (no progress stepper). **Drop** on a valid column (or on a sticky destination chip in the always-visible jump rail) → skips the intermediate guest-summary / Proceed shell and opens the **transition confirm** directly when no sub-form is required; otherwise opens only the required sub-form sheet (pricing, guest balance, etc.) and then the confirm once the form is complete. Uses `WorkflowPanel` `variant="modal"`. Forms use `WorkflowFormShell` `variant="modal"` (section title, no nested card chrome). From **Pending Review**, the only docs drop target is **Pending GAF Request** (not Parking / Pet) — that drop still runs **Proceed to Pending Documents**. **Pending Review → Ready for Check-in** is only valid when the property has **no** document requirements (D2 empty list).
- Destination chips stay mounted above the board (no show/hide jump). Idle: every column is a muted scroll shortcut. While dragging, allowed chips turn green (`cursor-copy`) and disallowed chips mute; columns also get a green/red wash. Chips always **wrap** (icon + short label, no horizontal scrollbar at any width — the board below owns horizontal scroll). Full status names are in each chip’s tooltip / `aria-label`. Drag overlay stays opaque (`bg-card`); the grip is a small corner control that does not reserve a left column.
- The kanban workflow dialog is a **single custom shell**: header with guest name + status subtitle + close, scrollable body, sticky action footer. Drop confirm-only hides that shell via CSS so `WorkflowPanel` stays mounted while `WorkflowConfirmModal` portals on top.
- Drag uses `@dnd-kit` with **edge auto-scroll**. Valid drops use the same confirm flow as `/bookings/:bookingId` (automation triggers stay on the detail page). Drag-drop does **not** auto-transition without confirm.

---

## Filters & query params

Existing params unchanged: `q`, `status`, `from`, `to`, `hasPets`, `needParking`, `sort`, `page`, `limit`, `view`.

`from` / `to` filter on **check-in date** and apply to **every status** — navigating to a month with no check-ins shows an empty list. (Pending Review rows used to be exempt so new submissions were never hidden; that made month navigation look broken and was removed.) No range is applied until the host picks one, so the default landing view still lists all active bookings.

`showCompletedBookings` remains supported for calendar/kanban (auto-enabled in those views); there is no UI toggle — use the **History** stage card or status filter for completed rows.

New: `stage` (see above).

---

## API

- `list-bookings` edge function — admin JWT; see [[PROJECT|Guest Form Management — Project Documentation]] API table.
- CSV import: `import-parse-file`, `import-ai-map-columns`, `import-save-mapping`, `import-preview`, `import-update-row`, `import-commit`, `import-cancel` — all require **`bookings.import:add`** (or org owner/admin) + `?property_id=`. Match / preview / commit paths also require plan **`bookingImport`** (Starter+).

---

## Permissions

| Action                   | Permission                      |
| ------------------------ | ------------------------------- |
| View list / open detail  | `bookings:view`                 |
| New booking              | `bookings.create:add`           |
| CSV import               | `bookings.import:add` (+ plan)  |
| Kanban drag → transition | `bookings.detail.workflow:edit` |

Kanban card open still works without workflow permission (Progress rail read-only). Org-wide bookings scope hides New / Import / workflow mutations.

## Implementation map

| Concern               | Path                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Page                  | `ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx`                                       |
| New booking modal     | `ui/src/features/dashboard/bookings/components/AdminNewBookingModal.tsx`                              |
| Success summary       | `ui/src/features/dashboard/bookings/components/AdminBookingSuccessSummary.tsx`                        |
| Guest form (embedded) | `ui/src/features/guest/form/components/GuestForm.tsx` (`embed.skipAuthGate`, `embed.onSubmitSuccess`) |
| Import wizard modal   | `ui/src/features/dashboard/import/components/ImportWizardModal.tsx`                                   |
| Shared modal chrome   | `ui/src/features/dashboard/import/components/ImportModalChrome.tsx`                                   |
| Import hooks / types  | `ui/src/features/dashboard/import/hooks/`, `lib/`, `types/`                                           |
| Stage mapping         | `ui/src/features/dashboard/bookings/lib/bookingStages.ts`                                             |
| Summary cards         | `ui/src/features/dashboard/bookings/components/BookingsSummaryCards.tsx`                              |
| Kanban board          | `ui/src/features/dashboard/bookings/components/BookingKanban.tsx`                                     |
| Kanban workflow modal | `ui/src/features/dashboard/bookings/components/BookingKanbanWorkflowModal.tsx`                        |
| Workflow (reused)     | `ui/src/features/dashboard/bookings/components/WorkflowPanel.tsx`                                     |
| Filters               | `ui/src/features/dashboard/bookings/components/BookingFilters.tsx`                                    |
| Mobile page shell     | `ui/src/components/mobile/MobileBrandHero.tsx` (`AdminMobilePage`)                                    |
| Routes                | `ui/src/features/dashboard/routes/index.tsx`                                                          |

---

## Testing

| Layer | Path / spec                                            | Manual |
| ----- | ------------------------------------------------------ | ------ |
| Unit  | `workflow.test.ts`                                     | —      |
| E2E   | `dashboardModulesSmoke.spec.ts` bookings shell (`@ci`) | —      |

---

## Related docs

- [Booking detail](./bookings-detail.md)
- [Route index](../../README.md)
- [Booking workflow rule](../../../../.cursor/rules/booking-workflow.mdc)
- [`docs/PROJECT.md`](../../../PROJECT.md)
