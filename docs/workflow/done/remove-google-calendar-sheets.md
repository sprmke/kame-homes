---
title: 'Remove Google Calendar and Sheets'
stage: done
status: done
updated: 2026-08-13
---

# Remove Google Calendar + Google Sheets, Replace Gmail Listener with Inbound Webhook — Implementation Plan

> **Status:** Done (2026-08-13). Engineering shipped: Calendar/Sheets removed, Gmail API listener replaced by Resend `approval-email-webhook`, Connect Google / Gmail OAuth retired. Plan checkboxes below were never marked during implementation — treat them as historical task list, not open work. Appendix GCP Console cleanup remains optional ops follow-up.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Superpowers repo-path override in effect:** save this plan to `docs/workflow/planned/remove-google-calendar-sheets.md` (no date prefix) and add a row to `docs/workflow/planned/README.md` — never `docs/superpowers/plans/`.

**Goal:** Remove Google Calendar and Google Sheets integrations entirely from the app, and replace the Gmail API listener (GAF/pet approval automation) with a CASA-free inbound-email-webhook, so the app no longer needs Google's CASA security assessment before public launch.

**Architecture:** Phase 1 deletes/edits every Calendar and Sheets code path (edge functions, DB columns, UI, docs) while leaving Gmail OAuth machinery untouched. Phase 2 replaces the Gmail API polling listener with a Resend Receiving inbound webhook that ports the same GAF/pet matching + booking-transition logic, then retires the listener (hard cutover — burn-in window skipped per product decision to ship production-ready inbound path immediately). Narrow OAuth consent remains `gmail.readonly` for optional internal Connect Google only.

**Tech Stack:** Vite + React 18 (`ui/`), Deno Supabase Edge Functions (`supabase/functions/`), plain SQL migrations (`supabase/migrations/`), Resend (already the outbound email provider).

## Context

The screenshot that started this request shows the admin booking-workflow panel's "Save to Database / Update Google Calendar" checklist (`ui/src/features/dashboard/bookings/lib/workflowDevControls.ts`). The business driver: Google requires a paid CASA (Cloud Application Security Assessment, roughly $500–1k/yr + weeks of process) before an External production app can use _restricted_ OAuth scopes (`calendar`, `spreadsheets`, `gmail.readonly`) at scale. That cost is a blocker for public launch.

Research during planning surfaced a critical fact already recorded in `docs/workflow/planned/google-oauth-verification.md` (2026-08-02): **removing Calendar + Sheets alone does not avoid CASA** — the Gmail listener's `gmail.readonly` scope is independently restricted and triggers CASA on its own for an External production app. The user confirmed (via question during planning) that this plan should therefore cover both: (1) delete Calendar + Sheets entirely, and (2) replace the Gmail API listener with a CASA-free inbound-email-webhook (Resend Receiving), so the combined result actually reaches a CASA-free state. Google Sign-In (admin auth) and Google Maps (API key) are non-restricted and explicitly out of scope — do not touch them.

All three integrations (Gmail, Calendar, Sheets) share one Google Cloud OAuth "Connect Google" client and one combined consent-scope string (`GOOGLE_CONNECT_OAUTH_SCOPES` in `_shared/gmailMailOAuthAccess.ts`) and largely share auth/config plumbing (`propertyGoogleApiAuth.ts`, `propertyGoogleConfig.ts`, `propertyGoogleOAuthProvision.ts`, `propertySyncToggles.ts`) — this is why the removal is mostly "surgical edit," not "delete the folder."

## Global Constraints

- Never edit a shipped migration under `supabase/migrations/` — every schema change here is a **new** migration file.
- No test suite exists in this repo (Vitest for UI / Deno test runner are the eventual convention, but nothing is wired up yet) — every task's "verify" step uses `bun run type-check` / `bun run lint` / `bun run build` / manual local exercise via the `verify` skill (Playwright MCP for UI, direct function invocation for edge functions), not unit tests.
- All user-visible dates: `Asia/Manila`. Guest DB date fields: `MM-DD-YYYY` text.
- Named exports only; `PascalCase.tsx` components, `useX.ts` hooks, `camelCase.ts` lib files, `kebab-case/index.ts` edge functions — follow existing file conventions when creating `approval-email-webhook/` and `approvalEmailMatcher.ts`.
- Don't put email/calendar/webhook side-effect calls inline in a handler that isn't the orchestrator — all booking-status side effects go through `WorkflowOrchestrator.transition()`.
- Update the matching doc in the same task that changes behavior (`docs/PROJECT.md`, `.cursor/rules/booking-workflow.mdc`, `.claude/skills/integrations/SKILL.md`, relevant `docs/guides/routes/**`) — do not defer doc updates to a separate pass.
- `docs/archive/**` is historical record — do not rewrite it as part of this plan.

---

# Phase 1 — Remove Google Calendar + Google Sheets

Self-contained and independently shippable. Does **not** touch `gmail-listener/index.ts`'s polling logic, `google-mail-oauth-start`/`-callback`'s Gmail token exchange, or `gmail_mail_integration`/`gmail_listener_state` tables (those belong to Phase 2). Ends with a migration dropping six now-unused DB columns.

### Task 1: Delete `calendarService.ts` and `sheetsService.ts`

**Files:**

- Delete: `supabase/functions/_shared/calendarService.ts` (757 lines, `CalendarService` class — confirmed zero external callers of its internal helpers/`STATUS_CALENDAR_META`/`buildCalendarSummary` outside this file)
- Delete: `supabase/functions/_shared/sheetsService.ts` (540 lines, `SheetsService` class)

**Interfaces:**

- Produces: nothing — these are the leaf modules everything else imports. Deleting them first makes every remaining importer fail type-check, which is the intended discovery mechanism for Task 2/3.

- [ ] **Step 1:** Delete both files.
- [ ] **Step 2:** Run `bun run type-check`. Expected: many failures — `Cannot find module './calendarService.ts'` / `'./sheetsService.ts'` across `submit-form`, `submit-pay-parking`, `sync-booking-integrations`, `workflowOrchestrator.ts`, `gmail-backfill-approvals`. Save this failure list — it drives Tasks 2–7.
- [ ] **Step 3:** Commit.

```bash
git add supabase/functions/_shared/calendarService.ts supabase/functions/_shared/sheetsService.ts
git commit -m "chore: delete calendarService and sheetsService"
```

---

### Task 2: Remove Calendar/Sheets date helpers from `_shared/utils.ts`

**Files:**

- Modify: `supabase/functions/_shared/utils.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing — `buildGoogleCalendarDateTime`/`buildGoogleCalendarOccupiedEndDateTime` were only consumed by the now-deleted `calendarService.ts`.

- [ ] **Step 1:** Grep-confirm no remaining callers: `grep -rn "buildGoogleCalendarDateTime\|buildGoogleCalendarOccupiedEndDateTime" supabase ui` should return zero hits after Task 1.
- [ ] **Step 2:** Delete `buildGoogleCalendarDateTime`, `buildGoogleCalendarOccupiedEndDateTime`, and the deprecated wrapper alias for `buildGoogleCalendarDateTime`.
- [ ] **Step 3:** Run `deno check supabase/functions/_shared/utils.ts` (or repo's edge-function type-check command). Expected: PASS, no other exports touched.
- [ ] **Step 4:** Commit.

```bash
git add supabase/functions/_shared/utils.ts
git commit -m "chore: remove Google Calendar date helpers from utils"
```

---

### Task 3: Remove Calendar-summary helpers from `_shared/statusMachine.ts`

**Files:**

- Modify: `supabase/functions/_shared/statusMachine.ts`

**Interfaces:**

- Produces: nothing — confirmed via grep that `STATUS_CALENDAR_META`, `buildCalendarSummary`, `resolveCalendarSummaryStatus`, `buildCalendarSummaryIconPrefix`, `PendingDocumentsCalendarBooking` have zero callers outside the now-deleted `calendarService.ts`.

- [ ] **Step 1:** Delete these exports: `STATUS_CALENDAR_META`, `PendingDocumentsCalendarBooking` type, `buildPendingDocumentsCalendarSummaryPrefix`, `buildCalendarSummaryIconPrefix`, `buildCalendarSummary`, `resolveCalendarSummaryStatus`. Leave every status-transition/document-completion export untouched.
- [ ] **Step 2:** Run `deno check supabase/functions/_shared/statusMachine.ts`. Expected: PASS.
- [ ] **Step 3:** In the same task, remove the dead client-side mirror in `ui/src/features/dashboard/bookings/lib/workflow.ts`: delete the exported `buildPendingDocumentsCalendarSummaryPrefix` function (line ~328, confirmed zero callers elsewhere in `ui/`) and its two doc-comment references to it.
- [ ] **Step 4:** Run `bun run type-check` for `ui/`. Expected: PASS.
- [ ] **Step 5:** Commit.

```bash
git add supabase/functions/_shared/statusMachine.ts ui/src/features/dashboard/bookings/lib/workflow.ts
git commit -m "chore: remove Google Calendar summary helpers from statusMachine"
```

---

### Task 4: Delete Calendar/Sheets auth+config+provisioning shared modules

**Files:**

- Delete: `supabase/functions/_shared/propertyGoogleApiAuth.ts` (confirmed via grep: `tryUserOAuthAccessToken`/`getServiceAccountAccessToken` have zero callers outside this file — safe to delete wholesale, not just the Calendar/Sheets-specific exports)
- Delete: `supabase/functions/_shared/propertyGoogleConfig.ts` (`resolveGoogleCalendarId`, `resolveGoogleSpreadsheetId`, `resolveGoogleServiceAccount`, `loadGoogleIdFromDb` — verify no other consumer before deleting, see Step 1)
- Delete: `supabase/functions/_shared/propertyGoogleOAuthProvision.ts` (`createPropertyCalendar`, `createPropertySpreadsheet`, `provisionPropertyGoogleResources`, `persistProvisionedGoogleIds`, `KAME_BOOKINGS_SHEET_HEADERS`)
- Delete: `supabase/functions/_shared/propertySyncToggles.ts` (`PropertySyncToggles` type, `DEFAULT_PROPERTY_SYNC_TOGGLES`, `mergePropertySyncToggles`, `resolvePropertySyncToggles`)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing — these four files exist solely to serve Calendar+Sheets. Task 5–8 remove their call sites.

- [ ] **Step 1:** Before deleting, grep each file's exported symbol names repo-wide (`grep -rn "resolveGoogleServiceAccount\|resolveGoogleCalendarId\|resolveGoogleSpreadsheetId" supabase`, `grep -rn "provisionPropertyGoogleResources\|persistProvisionedGoogleIds\|createPropertyCalendar\|createPropertySpreadsheet" supabase`, `grep -rn "PropertySyncToggles\|resolvePropertySyncToggles\|mergePropertySyncToggles" supabase ui`) to confirm every caller is inside files this plan is already editing (Tasks 5–8, 11). If any caller turns up outside that set, stop and re-scope this task before deleting.
- [ ] **Step 2:** Delete all four files.
- [ ] **Step 3:** Run `bun run type-check` for `supabase/functions`. Expected: failures in the call-site files — proceed to Task 5.
- [ ] **Step 4:** Commit.

```bash
git add -A supabase/functions/_shared/propertyGoogleApiAuth.ts supabase/functions/_shared/propertyGoogleConfig.ts supabase/functions/_shared/propertyGoogleOAuthProvision.ts supabase/functions/_shared/propertySyncToggles.ts
git commit -m "chore: delete Calendar/Sheets auth, config, and provisioning modules"
```

---

### Task 5: Surgically edit `workflowOrchestrator.ts`

**Files:**

- Modify: `supabase/functions/_shared/workflowOrchestrator.ts`

**Interfaces:**

- Consumes: nothing from deleted modules — this task removes the imports.
- Produces: `TransitionResult.sideEffects` no longer has `calendar`/`sheet` keys. `DevControlFlags` no longer has `updateGoogleCalendar`/`updateGoogleSheets`. Callers of `transition()` that read `sideEffects.calendar`/`sideEffects.sheet` must be updated in later tasks (Task 12: `useTransitionBooking.ts`).

- [ ] **Step 1:** Remove `import { CalendarService } from './calendarService.ts';` and `import { SheetsService } from './sheetsService.ts';`.
- [ ] **Step 2:** Remove `updateGoogleCalendar?: boolean` and `updateGoogleSheets?: boolean` from the `DevControlFlags` type; remove `calendar: boolean` and `sheet: boolean` from the side-effects result type.
- [ ] **Step 3:** Delete "Step 6: Google Calendar update" block (the `if (flag(devControls,'updateGoogleCalendar') && syncToggles.syncCalendar) { ... CalendarService.updateCalendarEventStatus(...) ... }` block and its `calendarOk` variable) and the adjacent "Step 7: Google Sheets update" block (`sheetOk` variable and its `SheetsService.syncFullRowFromDbBooking(...)` call), in the same commit — they're structurally identical and adjacent, editing together avoids a half-broken intermediate compile state on this large shared file.
- [ ] **Step 4:** Remove `calendarOk`/`sheetOk` from the final result-object assembly and remove `calendar: calendarOk` / `sheet: sheetOk` from the returned `sideEffects`.
- [ ] **Step 5:** Update the file's header comment (lines ~5-6) that names `calendarService`/`sheetsService` as services the orchestrator may call.
- [ ] **Step 6:** Run `deno check supabase/functions/_shared/workflowOrchestrator.ts`. Expected: PASS except for the still-unedited callers (Task 6-11 will fix those).
- [ ] **Step 7:** Commit.

```bash
git add supabase/functions/_shared/workflowOrchestrator.ts
git commit -m "chore: remove Calendar/Sheets side effects from workflowOrchestrator"
```

---

### Task 6: Edit `submit-form/index.ts` and `submit-pay-parking/index.ts`

**Files:**

- Modify: `supabase/functions/submit-form/index.ts`
- Modify: `supabase/functions/submit-pay-parking/index.ts`

- [ ] **Step 1:** In `submit-form/index.ts`: remove the `CalendarService`/`SheetsService` imports, the `isCalendarUpdateEnabled`/`isSheetsUpdateEnabled` flag reads, their log lines, and both `if` blocks that call `CalendarService.createOrUpdateCalendarEvent(...)` / `SheetsService.appendToSheet(...)` (these are two independent, cleanly separable blocks).
- [ ] **Step 2:** In `submit-pay-parking/index.ts`: remove the `CalendarService.updateCalendarEventStatus(...)` and `SheetsService.syncFullRowFromDbBooking(...)` calls from inside the shared `try` block, and update the `catch` log message (currently `'[submit-pay-parking] Calendar/sheet sync failed'`) to drop the now-inapplicable text or remove the catch if it becomes empty.
- [ ] **Step 3:** Run `deno check` on both files. Expected: PASS.
- [ ] **Step 4:** Verify locally: start the local stack (`./dev.sh`), submit a test guest booking through `/form`, confirm in function logs that no Calendar/Sheets network calls fire and the booking is created successfully.
- [ ] **Step 5:** Commit.

```bash
git add supabase/functions/submit-form/index.ts supabase/functions/submit-pay-parking/index.ts
git commit -m "chore: remove Calendar/Sheets calls from submit-form and submit-pay-parking"
```

---

### Task 7: Delete `sync-booking-integrations` and its UI caller

**Files:**

- Delete: `supabase/functions/sync-booking-integrations/` (whole directory — entire function's purpose was "Refresh Google Calendar + Sheets after admin save"; confirmed via grep its only caller is `useUpdateBooking.ts`)
- Modify: `ui/src/features/dashboard/bookings/hooks/useUpdateBooking.ts`

**Interfaces:**

- Produces: `useUpdateBooking`'s save flow no longer POSTs to `/sync-booking-integrations` after a successful edit — the booking save itself (via whichever function handles booking edits) is unaffected.

- [ ] **Step 1:** Delete the `supabase/functions/sync-booking-integrations/` directory.
- [ ] **Step 2:** In `useUpdateBooking.ts`, remove the `fetch(scopedFunctionsUrl('/sync-booking-integrations', propertyId))` call and its surrounding `onSuccess`/doc-comment logic. Do this in the **same task** as Step 1 — deleting one without the other leaves the UI calling a 404 on every booking save.
- [ ] **Step 3:** Run `bun run type-check` for `ui/`. Expected: PASS.
- [ ] **Step 4:** Verify locally via Playwright (per the `verify` skill): open a booking detail page, click "Edit booking", change a field, save, confirm no 404/network error in the browser console and the save completes normally.
- [ ] **Step 5:** Commit.

```bash
git add -A supabase/functions/sync-booking-integrations ui/src/features/dashboard/bookings/hooks/useUpdateBooking.ts
git commit -m "chore: remove sync-booking-integrations function and its UI caller"
```

---

### Task 8: Minimal fix to `gmail-backfill-approvals/index.ts` (keep it deployable)

**Files:**

- Modify: `supabase/functions/gmail-backfill-approvals/index.ts`

This file is part of the Gmail approval pipeline that Phase 2 will replace — do **not** do a broader rewrite here. But it currently calls the now-deleted `SheetsService` inside `persistApprovedPdfOnly()`, which would break its deploy/compile the moment Task 1 lands. Fix just that.

- [ ] **Step 1:** Remove the `SheetsService` import and the `SheetsService.syncFullRowFromDbBooking(...)` call inside `persistApprovedPdfOnly()`.
- [ ] **Step 2:** Remove the `updateGoogleSheets: true` key from `BACKFILL_DEV_CONTROLS`.
- [ ] **Step 3:** Run `deno check supabase/functions/gmail-backfill-approvals/index.ts`. Expected: PASS. Do not touch anything else in this file — Azure email parsing, PDF persistence, and orchestrator transitions all stay exactly as-is for now.
- [ ] **Step 4:** Commit.

```bash
git add supabase/functions/gmail-backfill-approvals/index.ts
git commit -m "chore: remove Sheets call from gmail-backfill-approvals (Calendar/Sheets removal only, Gmail pipeline unchanged)"
```

---

### Task 9: Trim `google-mail-oauth-callback/index.ts` provisioning tail

**Files:**

- Modify: `supabase/functions/google-mail-oauth-callback/index.ts`

**Interfaces:**

- Produces: OAuth callback no longer auto-provisions a Calendar or Spreadsheet after a successful Gmail connect. Gmail refresh-token storage is untouched.

- [ ] **Step 1:** Keep the Gmail OAuth token exchange/storage logic (the part that saves the refresh token to `gmail_mail_integration`) exactly as-is.
- [ ] **Step 2:** Delete the auto-provisioning tail that reads `google_calendar_id`/`google_spreadsheet_id`, computes `createCalendar`/`createSpreadsheet`, and calls `provisionPropertyGoogleResources`/`persistProvisionedGoogleIds`.
- [ ] **Step 3:** Run `deno check supabase/functions/google-mail-oauth-callback/index.ts`. Expected: PASS.
- [ ] **Step 4:** Verify locally: run the "Connect Google" OAuth flow end-to-end against local/staging and confirm token exchange still succeeds with no error from the removed provisioning call.
- [ ] **Step 5:** Commit.

```bash
git add supabase/functions/google-mail-oauth-callback/index.ts
git commit -m "chore: remove Calendar/Sheets auto-provisioning from Google OAuth callback"
```

---

### Task 10: Trim `propertyGoogleIntegrationSeed.ts`

**Files:**

- Modify: `supabase/functions/_shared/propertyGoogleIntegrationSeed.ts`

**Interfaces:**

- Produces: `seedGoogleIntegrationForNewProperty(orgId, newPropertyId, propertyName)` return type collapses from `{ copied: boolean; provisioned: boolean }` to `{ copied: boolean }`.

- [ ] **Step 1:** Keep the Gmail-token-copy logic and the `gmail_listener_state` upsert block untouched (the latter is Gmail-listener plumbing, revisited in Phase 2 Task 21 — not Calendar/Sheets).
- [ ] **Step 2:** Delete the provisioning tail that calls `provisionPropertyGoogleResources`, and update the function's return type and docstring (currently says "auto-provision calendar + spreadsheet (Phase 2g.4)") to match.
- [ ] **Step 3:** Grep for callers of this function (`grep -rn "seedGoogleIntegrationForNewProperty" supabase`) and update any that destructure `.provisioned` from the result.
- [ ] **Step 4:** Run `deno check` on this file and its callers. Expected: PASS.
- [ ] **Step 5:** Commit.

```bash
git add -A
git commit -m "chore: remove Calendar/Sheets provisioning from property Google integration seed"
```

---

### Task 11: `appSettings.ts`, `propertyIntegrationStatus.ts`, `app-settings/index.ts`, `parking-settings/index.ts`, single-line flag removals

**Files:**

- Modify: `supabase/functions/_shared/appSettings.ts`
- Modify: `supabase/functions/_shared/propertyIntegrationStatus.ts`
- Modify: `supabase/functions/app-settings/index.ts`
- Modify: `supabase/functions/parking-settings/index.ts`
- Modify: `supabase/functions/import-revert/index.ts`
- Modify: `supabase/functions/submit-sd-form/index.ts`
- Modify: `supabase/functions/sd-refund-cron/index.ts`

- [ ] **Step 1:** `appSettings.ts` — grep for exact field names first (`google_calendar_id`, `sync_calendar`, `google_spreadsheet_id`, `sync_sheets`, `syncCalendar`, `syncSheets`) to scope the diff tightly; remove them from the raw row type, the resolved settings type, and the DB-row-to-settings mapping. Touch nothing else in this large shared file.
- [ ] **Step 2:** `propertyIntegrationStatus.ts` — remove `googleCalendar`/`googleSpreadsheet` fields from `PropertyIntegrationStatus`, and their computation inside `buildParkingIntegrationStatus()` (reads `calendar_connected`/`sheets_connected` from `parking_settings`) and `buildPropertyIntegrationStatus()` (reads `google_calendar_id`/`google_spreadsheet_id` from `app_settings`). Keep Gmail-status computation in both functions untouched.
- [ ] **Step 3:** `app-settings/index.ts` — remove the `if (typeof body.syncCalendar === 'boolean') { patch.sync_calendar = ... }` and the equivalent `syncSheets` block from the PATCH handler.
- [ ] **Step 4:** `parking-settings/index.ts` — remove `calendarConnected`/`sheetsConnected` from the GET response mapping and their PATCH handling.
- [ ] **Step 5:** `import-revert/index.ts`, `submit-sd-form/index.ts`, `sd-refund-cron/index.ts` — drop the `updateGoogleCalendar`/`updateGoogleSheets` keys from each file's `DevControlFlags` object literal (one line each).
- [ ] **Step 6:** Run `bun run type-check` for `supabase/functions`. Expected: PASS.
- [ ] **Step 7:** Commit.

```bash
git add supabase/functions/_shared/appSettings.ts supabase/functions/_shared/propertyIntegrationStatus.ts supabase/functions/app-settings/index.ts supabase/functions/parking-settings/index.ts supabase/functions/import-revert/index.ts supabase/functions/submit-sd-form/index.ts supabase/functions/sd-refund-cron/index.ts
git commit -m "chore: remove Calendar/Sheets fields from app-settings, parking-settings, and dev-control flags"
```

---

### Task 12: UI — workflow dev-controls and booking-detail panel (the screenshot)

**Files:**

- Modify: `ui/src/features/dashboard/bookings/lib/workflowDevControls.ts`
- Modify: `ui/src/features/dashboard/bookings/hooks/useTransitionBooking.ts`
- Modify: `ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx`

This is the file behind the "Save to Database / Update Google Calendar / Update Google Sheets" checklist shown in the original screenshot.

- [ ] **Step 1:** In `workflowDevControls.ts`: delete the `updateGoogleCalendar` and `updateGoogleSheets` entries from `WORKFLOW_DEV_CONTROLS`; remove `syncCalendar`/`syncSheets` from the `PropertySyncToggles` type and `DEFAULT_PROPERTY_SYNC_TOGGLES`; remove the corresponding `case` branches from `isWorkflowDevControlRelevant()`, `workflowDevControlsForCancel()`, `withPropertySyncDisabledState()`, and `sanitizeDevControlsForPropertySync()` — keep the function shapes and every other control (`saveToDatabase`, `generatePdf`, etc.) untouched.
- [ ] **Step 2:** In `useTransitionBooking.ts`: remove `updateGoogleCalendar?`/`updateGoogleSheets?` from the local `DevControlFlags`-mirroring type and `calendar?`/`sheet?` from the side-effects result type.
- [ ] **Step 3:** In `WorkflowPanel.tsx`: remove the `syncCalendar` local state read from `appSettings?.syncCalendar`.
- [ ] **Step 4:** Run `bun run type-check` for `ui/`. Expected: PASS.
- [ ] **Step 5:** Verify locally via Playwright: open a booking detail page, open the workflow confirm modal, confirm the checklist shows only "Save to Database" (and any other remaining controls like "Generate PDF") — no Calendar/Sheets rows.
- [ ] **Step 6:** Commit.

```bash
git add ui/src/features/dashboard/bookings/lib/workflowDevControls.ts ui/src/features/dashboard/bookings/hooks/useTransitionBooking.ts ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx
git commit -m "chore: remove Google Calendar/Sheets from workflow dev-controls checklist"
```

---

### Task 13: UI — Integrations panel, app-settings hook, property-settings

**Files:**

- Modify: `ui/src/features/dashboard/bookings/components/PropertyIntegrationsPanel.tsx`
- Modify: `ui/src/features/dashboard/bookings/hooks/useAppSettings.ts`
- Modify: `ui/src/features/dashboard/org/hooks/usePropertyGoogleAttentionItem.ts`
- Modify: `ui/src/features/dashboard/org/lib/propertySettingsSave.ts`
- Modify: `ui/src/features/dashboard/org/components/property-settings/PropertyWorkflowDocumentsSection.tsx`
- Modify: `ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts`
- Modify: `ui/src/features/dashboard/parking/hooks/useParkingSettings.ts`

- [ ] **Step 1:** `PropertyIntegrationsPanel.tsx` — remove the "Google Calendar" `GoogleServiceRow` and "Google Spreadsheet" `GoogleServiceRow` from the connected-Google card, keeping the Gmail inbox row.
- [ ] **Step 2:** `useAppSettings.ts` — remove `googleCalendar`, `syncCalendar`, `syncSheets` fields and their dirty-check comparisons.
- [ ] **Step 3:** `usePropertyGoogleAttentionItem.ts` — remove the Calendar/Spreadsheet `configured` checks from the "needs attention" banner condition, keeping the Gmail check.
- [ ] **Step 4:** `propertySettingsSave.ts` — remove `syncCalendar`/`syncSheets` from the diff/patch-building/response-mapping logic (multiple call sites within this file — grep `syncCalendar\|syncSheets` in the file to find them all).
- [ ] **Step 5:** `PropertyWorkflowDocumentsSection.tsx` — remove both `SyncToggleRow` instances (sync-calendar and sync-sheets) from the "Booking Workflow" section.
- [ ] **Step 6:** `propertySettingsCompletion.ts` — remove Calendar/Spreadsheet from the completion-checklist boolean and its copy string.
- [ ] **Step 7:** `useParkingSettings.ts` — remove `calendarConnected`/`sheetsConnected` fields.
- [ ] **Step 8:** Run `bun run type-check` for `ui/`. Expected: PASS.
- [ ] **Step 9:** Verify locally via Playwright: open Property Settings → Booking Workflow section, confirm no Sync Google Calendar/Sheets toggles render; open the Integrations panel, confirm no Google Calendar/Spreadsheet rows.
- [ ] **Step 10:** Commit.

```bash
git add ui/src/features/dashboard/bookings/components/PropertyIntegrationsPanel.tsx ui/src/features/dashboard/bookings/hooks/useAppSettings.ts ui/src/features/dashboard/org/hooks/usePropertyGoogleAttentionItem.ts ui/src/features/dashboard/org/lib/propertySettingsSave.ts ui/src/features/dashboard/org/components/property-settings/PropertyWorkflowDocumentsSection.tsx ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts ui/src/features/dashboard/parking/hooks/useParkingSettings.ts
git commit -m "chore: remove Google Calendar/Sheets from property settings and integrations UI"
```

---

### Task 14: UI — guest form dev controls

**Files:**

- Modify: `ui/src/features/guest/form/components/GuestForm.tsx`

- [ ] **Step 1:** Remove `devApiControls.updateCalendar`/`updateGoogleSheets` from the dev-controls state initializer.
- [ ] **Step 2:** Remove the two checkbox JSX blocks (the "Update Google Calendar" and "Update Google Sheets" `<div>`s in the dev-controls panel).
- [ ] **Step 3:** Remove the `formData.append('updateGoogleCalendar', ...)` / `formData.append('updateGoogleSheets', ...)` calls.
- [ ] **Step 4:** Remove the Calendar/Sheets mentions from the cancel-booking `window.confirm()` dialog copy string.
- [ ] **Step 5:** Leave `ui/src/features/guest/form/lib/bookingSourceFromSearchParams.ts`'s `STRIPPED_GUEST_QUERY_KEYS` entries for `'updateGoogleCalendar'`/`'updateGoogleSheets'` **as-is** — this is a no-cost safety net that strips stale query params from old bookmarked/cached guest links, not dead code that needs removal.
- [ ] **Step 6:** Run `bun run type-check` for `ui/`. Expected: PASS.
- [ ] **Step 7:** Verify locally: load `/form` with dev controls visible, confirm no Calendar/Sheets checkboxes render, submit a test booking successfully.
- [ ] **Step 8:** Commit.

```bash
git add ui/src/features/guest/form/components/GuestForm.tsx
git commit -m "chore: remove Google Calendar/Sheets dev controls from guest form"
```

---

### Task 15: Shrink OAuth scopes and update Connect Google copy

**Files:**

- Modify: `supabase/functions/_shared/gmailMailOAuthAccess.ts`
- Modify: `ui/src/features/dashboard/bookings/components/GmailMailIntegrationCard.tsx`
- Modify: `ui/src/features/dashboard/bookings/components/GmailReconnectModal.tsx`

This is the "point of no return" task for Phase 1 — sequence it last, after every Calendar/Sheets code path that could request those scopes is gone.

- [ ] **Step 1:** In `gmailMailOAuthAccess.ts`, shrink `GOOGLE_CONNECT_OAUTH_SCOPES` from `[GMAIL_READONLY_SCOPE, 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets']` to `[GMAIL_READONLY_SCOPE]`. Note in a comment that this is forward-only: already-connected properties keep their originally-granted refresh-token scopes until they re-consent; only new/re-connects get the narrower scope.
- [ ] **Step 2:** Update copy in `GmailMailIntegrationCard.tsx`/`GmailReconnectModal.tsx` from "Connect Google (Gmail listener + Calendar + Sheets)" to Gmail-only language.
- [ ] **Step 3:** Run `deno check`/`bun run type-check` across both packages. Expected: PASS.
- [ ] **Step 4:** Verify locally: run the "Connect Google" OAuth flow and confirm the Google consent screen shown to the user now lists only the Gmail read-only permission, not Calendar/Sheets.
- [ ] **Step 5:** Commit.

```bash
git add supabase/functions/_shared/gmailMailOAuthAccess.ts ui/src/features/dashboard/bookings/components/GmailMailIntegrationCard.tsx ui/src/features/dashboard/bookings/components/GmailReconnectModal.tsx
git commit -m "chore: shrink Connect Google OAuth scope to gmail.readonly only"
```

---

### Task 16: Batch verification before the migration

**Files:** none (verification only)

- [ ] **Step 1:** Run `bun run type-check`, `bun run lint`, `bun run build` at the repo root. Expected: all PASS.
- [ ] **Step 2:** Grep repo-wide for residual references, excluding docs/migrations/archive: `grep -rn "CalendarService\|SheetsService\|google_calendar_id\|google_spreadsheet_id\|sync_calendar\|sync_sheets\|calendarConnected\|sheetsConnected" --include="*.ts" --include="*.tsx" supabase/functions ui/src`. Expected: zero hits (aside from the deliberately-kept `STRIPPED_GUEST_QUERY_KEYS` entries from Task 14 Step 5, which use the string literals `'updateGoogleCalendar'`/`'updateGoogleSheets'`, not the removed symbols above — confirm those are the only matches, if any).
- [ ] **Step 3:** If any stragglers turn up, fix them before proceeding to Task 17.

---

### Task 17: Migration — drop the six now-unused columns

**Files:**

- Create: `supabase/migrations/20261009130000_remove_google_calendar_sheets.sql` (timestamp chosen to sort after the latest existing migration, `20261009120000_ai_platform_usage.sql` — do not use today's literal date, this repo's migration timestamps are not calendar-accurate)

```sql
-- Remove Google Calendar and Google Sheets integration columns.
-- Calendar/Sheets features were removed from the app (CASA cost); Gmail
-- OAuth (gmail_mail_integration, gmail.readonly scope) is unaffected.

ALTER TABLE app_settings DROP COLUMN IF EXISTS google_calendar_id;
ALTER TABLE app_settings DROP COLUMN IF EXISTS sync_calendar;
ALTER TABLE app_settings DROP COLUMN IF EXISTS google_spreadsheet_id;
ALTER TABLE app_settings DROP COLUMN IF EXISTS sync_sheets;

ALTER TABLE parking_settings DROP COLUMN IF EXISTS calendar_connected;
ALTER TABLE parking_settings DROP COLUMN IF EXISTS sheets_connected;
```

- [ ] **Step 1:** Create the migration file above.
- [ ] **Step 2:** Run `bun run db:migrate` (local-only migration apply, per this repo's convention — never `deploy:supabase`/remote migration without explicit `kamewave` authorization).
- [ ] **Step 3:** Confirm the columns are gone: `bun run start:supabase` then check via Supabase Studio or `\d app_settings` / `\d parking_settings` locally.
- [ ] **Step 4:** Re-run the Task 16 Step 2 grep once more as a final sanity check — a `DROP COLUMN` against code that still selects it would 500 at runtime (Postgrest), not fail at compile time.
- [ ] **Step 5:** Commit.

```bash
git add supabase/migrations/20261009130000_remove_google_calendar_sheets.sql
git commit -m "chore: drop Google Calendar/Sheets columns from app_settings and parking_settings"
```

---

### Task 18: Docs pass

**Files:**

- Modify: `docs/PROJECT.md` (integrations table row — drop "Google Calendar, Google Sheets")
- Modify: `docs/architecture/integrations.md` (delete §9.2 "Google Calendar" and §9.3 "Google Sheets" wholesale; trim the PDF section's `sync_calendar`/`sync_sheets` toggle mention)
- Modify: `docs/architecture/edge-functions.md` (trim Calendar/Sheets mentions from function-table rows: `submit-form`, `cancel-booking`, `delete-organization`, `transition-parking-booking`, `sd-refund-cron`, `app-settings`, `submit-pay-parking`; remove the `sync-booking-integrations` row entirely; remove the `backfill-calendar-event-dates` row entirely if it still exists — see Task 19)
- Modify: `docs/architecture/validation-and-env.md` (env/config table rows for `GOOGLE_SERVICE_ACCOUNT`/`GOOGLE_CALENDAR_ID`/`GOOGLE_SPREADSHEET_ID`, `propertySyncToggles` reference)
- Modify: `docs/architecture/overview.md` and `docs/architecture/routing.md` (prose/diagram mentions — quick pass)
- Modify: `.cursor/rules/booking-workflow.mdc` (frontmatter file-glob list drops `calendarService.ts`/`sheetsService.ts`; delete §4 "Calendar color + title map" wholesale; strip the "Calendar"/"Sheet" columns from the status-transition side-effect matrix table; remove the `sync-booking-integrations` reference; update the "Don't put calendar/sheet/email calls inside DatabaseService" line to "Don't put email calls inside DatabaseService")
- Modify: `.cursor/rules/admin-auth.mdc` (dev-panel description, dev-controls table rows for Update Google Calendar/Sheets)
- Modify: `.claude/skills/integrations/SKILL.md` (frontmatter description drops "Calendar, Sheets"; body drops the "Calendar + Sheets IDs on `app_settings`" line and the `booking-workflow.mdc` calendar/sheet side-effects reference)
- Modify: `.claude/skills/verify/SKILL.md` (trim "sheet row," from its checklist line)
- Modify relevant `docs/guides/routes/**` route guides (`org/property/settings.md`, `org/settings.md`, `org/property/dashboard.md`, `org/property/bookings-detail.md`, `form.md`, `bookings/parking.md`) — trim Calendar/Sheets UI references identified during research
- Modify: `supabase/.env.example`, `supabase/.env.dev.example`, `supabase/.env.prod.example` — remove `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SPREADSHEET_ID`; keep `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `GMAIL_API_WEB_CLIENT_JSON`, `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`, `GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS`, `VITE_GOOGLE_MAPS_API_KEY`

Do **not** touch `docs/archive/**` — leave historical records as-is.

- [ ] **Step 1:** Work through each doc file above, removing/trimming the Calendar+Sheets content per the file-specific notes.
- [ ] **Step 2:** Re-read `.cursor/rules/booking-workflow.mdc` end-to-end after editing to confirm the transition matrix table and quick-reference sections are internally consistent (no leftover "Calendar" header with no column, etc).
- [ ] **Step 3:** Commit.

```bash
git add docs .cursor/rules .claude/skills supabase/.env.example supabase/.env.dev.example supabase/.env.prod.example
git commit -m "docs: remove Google Calendar/Sheets references"
```

---

### Task 19: Delete the dedicated Calendar-only backfill function

**Files:**

- Delete: `supabase/functions/backfill-calendar-event-dates/` (whole directory — one-shot admin tool, Calendar-only)

- [ ] **Step 1:** Confirm no UI route or doc still links to this function's endpoint (grep `backfill-calendar-event-dates` repo-wide).
- [ ] **Step 2:** Delete the directory.
- [ ] **Step 3:** Confirm `supabase/config.toml` has no leftover per-function entry for it, if one exists.
- [ ] **Step 4:** Run `bun run build`. Expected: PASS.
- [ ] **Step 5:** Commit.

```bash
git add -A supabase/functions/backfill-calendar-event-dates supabase/config.toml
git commit -m "chore: delete backfill-calendar-event-dates function"
```

**Phase 1 is now complete and independently shippable.**

---

# Phase 2 — Replace Gmail Listener with Resend Inbound Webhook (CASA fix)

This is the larger, riskier half. It supersedes the earlier `docs/workflow/planned/google-oauth-verification.md` plan's Phase 0-5 breakdown with concrete file-level tasks. Do not start Task 26 (retirement) until burn-in (Task 25) passes.

### Task 20: Decision lock + shared matcher module

**Files:**

- Create: `supabase/functions/_shared/approvalEmailMatcher.ts`

Extract the GAF/pet matching logic that is today duplicated between `gmail-listener/index.ts` and `gmail-backfill-approvals/index.ts` into one shared module, so both the still-running listener and the new webhook can use a single implementation during burn-in.

**Interfaces:**

- Produces:
  - `parseApprovalSubject(subject: string): { kind: 'gaf' | 'pet'; checkIn: string; checkOut: string } | null` — property-driven matching: accept the existing hardcoded-property regex pattern as a fallback, but primarily resolve the property from the inbound address (plus-addressing, see Task 22) or from a per-property subject template stored on `properties`/`app_settings`, not a single hardcoded "Monaco 2604" string. Reuses `parseDateTokenToDbFormat()` logic (handles `MM-DD-YYYY`, `YYYY-MM-DD`, free-text dates).
  - `isSenderAllowed(propertyId: string, fromHeader: string): Promise<boolean>` — ports the `EMAIL_TO` allow-list check.
  - `matchAttachment(filename: string): 'gaf' | 'pet' | null` — ports the filename normalizer (lowercase, strip spaces/`_`/`-`, matches `approvedgaf.pdf`/`approvedpet.pdf`/`approvedpetform.pdf`).
  - `findBookingForApproval(propertyId: string, kind: 'gaf' | 'pet', checkIn: string, checkOut: string): Promise<{ booking: Booking } | { ambiguous: true; matchCount: number } | null>` — ports the `guest_submissions` lookup by `property_id + check_in_date + check_out_date + status IN (expected)` with the **ambiguous multi-match skip preserved exactly** (no auto-resolve on >1 match).

- [ ] **Step 1:** Confirm two decisions before writing code (record the decision in this file's header comment): (a) addressing — plus-addressing per property (`approvals+{propertySlug}@inbound.{domain}`) as the primary routing signal, subject-regex as secondary confirmation only; (b) dedupe — hard cutover, repurpose `processed_emails.message_id` to store Resend's inbound `email_id`/RFC `Message-Id` instead of adding a dual-source column (no other consumer needs dual-path).
- [ ] **Step 2:** Write `approvalEmailMatcher.ts` porting the four functions above from `gmail-listener/index.ts`'s existing logic (lines documented during planning research: `GAF_RE`/`PET_RE`, `parseDateTokenToDbFormat`, sender allow-list, attachment matcher, booking lookup).
- [ ] **Step 3:** Refactor `gmail-listener/index.ts` and `gmail-backfill-approvals/index.ts` to import from this new module instead of their duplicated inline copies — this de-risks the burn-in period, since both the old and new intake paths then share one implementation.
- [ ] **Step 4:** Verify: manually invoke the refactored `gmail-listener` locally against a fixture inbox (or the real Testing-mode mailbox) and confirm behavior is unchanged — compare `processed_emails` output before/after the refactor for a sample poll.
- [ ] **Step 5:** Commit.

```bash
git add supabase/functions/_shared/approvalEmailMatcher.ts supabase/functions/gmail-listener/index.ts supabase/functions/gmail-backfill-approvals/index.ts
git commit -m "refactor: extract shared approval-email matcher for listener and backfill"
```

---

### Task 21: Svix webhook signature verification

**Files:**

- Create: `supabase/functions/_shared/resendWebhookVerify.ts`

**Interfaces:**

- Produces: `verifyResendWebhookSignature(rawBody: string, svixId: string, svixTimestamp: string, svixSignature: string, secret: string): Promise<boolean>` — implements Svix's scheme: HMAC-SHA256 over `{svixId}.{svixTimestamp}.{rawBody}` using the base64-decoded signing secret, compared against the (possibly multi-value, space-separated `v1,<base64sig>` formatted) `svix-signature` header.

- [ ] **Step 1:** Read `supabase/functions/_shared/metaInboxGraph.ts`'s `verifyMetaWebhookSignatureAsync` as a structural template (raw-body-read → `crypto.subtle.importKey` → `crypto.subtle.sign` → compare) — note the header scheme differs (Svix uses three headers and a `{id}.{timestamp}.{body}` signed string, not Meta's single `X-Hub-Signature-256`), so this is an adaptation, not a copy.
- [ ] **Step 2:** Implement `verifyResendWebhookSignature` per Svix's documented scheme.
- [ ] **Step 3:** Verify: construct a synthetic signed payload locally with a known test secret (small standalone script or Deno test) and confirm the verifier accepts a correctly-signed payload and rejects both a tampered body and a stale/mismatched timestamp.
- [ ] **Step 4:** Commit.

```bash
git add supabase/functions/_shared/resendWebhookVerify.ts
git commit -m "feat: add Svix webhook signature verification for Resend inbound"
```

---

### Task 22: New `approval-email-webhook` edge function

**Files:**

- Create: `supabase/functions/approval-email-webhook/index.ts`
- Modify: `supabase/config.toml` (register the function with `verify_jwt = false`, matching `gmail-listener`/`gmail-backfill-approvals`/`meta-inbox-webhook`)

**Interfaces:**

- Consumes: `verifyResendWebhookSignature` (Task 21), `approvalEmailMatcher.ts`'s four exports (Task 20), `WorkflowOrchestrator.transition()`, `bookingAssetStorageKey()` from `_shared/bookingStoragePaths.ts`.
- Produces: a public POST endpoint that processes Resend `email.received` events.

- [ ] **Step 1:** Pattern the function after `meta-inbox-webhook/index.ts`: read the raw text body first, verify the Svix signature via headers (`svix-id`, `svix-timestamp`, `svix-signature`) before doing anything else, then `JSON.parse` the body.
- [ ] **Step 2:** Extract the inbound address (for property routing via plus-addressing), sender, subject, and attachment references from the parsed Resend payload; fetch attachment content via Resend's Received/Attachments API.
- [ ] **Step 3:** Call `matchAttachment()` to identify GAF vs pet, `parseApprovalSubject()`/address-routing to resolve the property + check-in/check-out, `isSenderAllowed()` to gate on the allow-list, `findBookingForApproval()` to locate the booking — preserving the ambiguous-match skip (no auto-resolve, log and return 200 without transitioning).
- [ ] **Step 4:** On a single match: upload the PDF using the **same storage contract** as the listener — `bookingAssetStorageKey(propertyId, bookingId, 'approved-gaf.pdf' | 'approved-pet.pdf')`, bucket `approved-gafs`/`approved-pet-forms`, `{ contentType: 'application/pdf', upsert: true }` — then call `WorkflowOrchestrator.transition(bookingId, 'PENDING_DOCUMENTS', { approved_gaf_pdf_url | approved_pet_pdf_url, document_completion_target }, <same silent dev-controls the listener uses today>, false)`.
- [ ] **Step 5:** Write a `processed_emails` row keyed on Resend's inbound `email_id` (or `Message-Id` header) — same table, same dedupe pattern as today, just a different source for the key value (per the hard-cutover decision in Task 20).
- [ ] **Step 6:** Register the function in `supabase/config.toml` with `verify_jwt = false`.
- [ ] **Step 7:** Verify: run the local Supabase stack, POST a synthetic Resend `email.received` payload (fixture PDF attachment reference) to the function and confirm (a) signature verification passes, (b) the booking transitions to the expected status, (c) a new `processed_emails` row appears, (d) the Storage bucket receives the PDF at the expected key. Also POST a payload representing an ambiguous multi-match and confirm it skips without transitioning.
- [ ] **Step 8:** Commit.

```bash
git add supabase/functions/approval-email-webhook supabase/config.toml
git commit -m "feat: add approval-email-webhook (Resend inbound) edge function"
```

---

### Task 23: Resend infra setup (ops task)

No code changes — a checklist to execute against the Resend dashboard and DNS provider.

- [ ] **Step 1:** Register MX records on an inbound subdomain (e.g. `inbound.{your-domain}`) per [Resend Receiving docs](https://resend.com/docs/dashboard/receiving/introduction).
- [ ] **Step 2:** Register the webhook endpoint (`https://<project>.functions.supabase.co/approval-email-webhook`) for the `email.received` event in the Resend dashboard; copy the signing secret.
- [ ] **Step 3:** Store the signing secret as a new edge function secret, e.g. `RESEND_INBOUND_WEBHOOK_SECRET`, and add it to `supabase/.env.example`/`.env.dev.example`/`.env.prod.example` (value blank/placeholder in the example files, real value set via `supabase secrets set` locally/per-env — never commit the real secret).
- [ ] **Step 4:** Confirm receiving works end-to-end by sending a real test email to the inbound address and confirming the webhook fires (check function logs).

---

### Task 24: Outbound cutover — Reply-To on GAF/pet request emails

**Files:**

- Modify: `supabase/functions/_shared/emailService.ts`

**Interfaces:**

- Produces: `sendEmail()`/`sendPetEmail()`'s outbound GAF/pet request emails now set `reply_to` to the new inbound address (per-property plus-address) instead of `EMAIL_REPLY_TO`, with `EMAIL_REPLY_TO` added as a CC so property ops still sees Azure's reply in their human inbox.

- [ ] **Step 1:** In both `sendEmail()` (GAF) and `sendPetEmail()` (pet), change `reply_to: EMAIL_REPLY_TO` to `reply_to: <inbound address for this property>` (e.g. `approvals+${propertySlug}@inbound.{domain}`), and add `cc: [EMAIL_REPLY_TO]` (or equivalent) so ops keeps visibility.
- [ ] **Step 2:** Keep the existing "never CC the guest" invariant intact — verify the guest's address is not in the new CC list.
- [ ] **Step 3:** Verify: send a real test GAF/pet request email from local/staging and confirm the received message's `Reply-To` header points at the inbound address and ops still receives a CC.
- [ ] **Step 4:** Commit.

```bash
git add supabase/functions/_shared/emailService.ts
git commit -m "feat: route GAF/pet request Reply-To through inbound approval webhook"
```

---

### Task 25: Burn-in — parallel run and comparison

**Files:**

- Create: a small comparison script (e.g. `scripts/integrations/compare-approval-intake.mjs` or a documented SQL query — pick whichever is faster to stand up) that compares `processed_emails` rows written by `gmail-listener` (Gmail-sourced) against those written by `approval-email-webhook` (Resend-sourced) for the same time window.

This is the highest-risk task in the whole plan — give it real review time, not a rubber stamp.

- [ ] **Step 1:** Run `gmail-listener` (polling, unchanged) and `approval-email-webhook` (push, new) in parallel against the same inbox traffic for an agreed burn-in window (recommend minimum 1–2 weeks).
- [ ] **Step 2:** Use the comparison script/query to confirm parity each day: same bookings advance to the same statuses, same ambiguous-skip behavior, no bookings advanced by one path and missed by the other.
- [ ] **Step 3:** Document any discrepancies found and fix `approvalEmailMatcher.ts`/`approval-email-webhook` before proceeding — do not retire the listener until a full burn-in window passes with zero unexplained discrepancies.
- [ ] **Step 4:** Get explicit sign-off (from you) that burn-in has passed before starting Task 26.

---

### Task 26: Retirement

**Files:**

- Delete: `supabase/functions/gmail-listener/`
- Delete: `supabase/functions/gmail-backfill-approvals/` (or, if ops wants a manual reprocess path, port its dry-run reprocessing capability into a lightweight admin action first — this needs an explicit decision from you before this task starts; default recommendation is to delete outright since the manual "mark complete" admin action already exists as a recovery path)
- Create: `supabase/migrations/<next-timestamp>_drop_gmail_listener_state.sql` — `DROP TABLE IF EXISTS gmail_listener_state;`
- Modify: `supabase/functions/_shared/propertyGoogleIntegrationSeed.ts` — remove the `gmail_listener_state` upsert block deferred from Phase 1 Task 10

- [ ] **Step 1:** Confirm burn-in sign-off (Task 25 Step 4) happened.
- [ ] **Step 2:** Disable `gmail-listener`'s cron trigger first (keep the function directory present but not scheduled) for one deploy cycle as a rollback buffer, before hard-deleting.
- [ ] **Step 3:** After the buffer period with no issues, delete `gmail-listener/` and `gmail-backfill-approvals/` (per the decision above).
- [ ] **Step 4:** Create the migration dropping `gmail_listener_state` and remove its upsert from `propertyGoogleIntegrationSeed.ts` in the same task.
- [ ] **Step 5:** Run `bun run type-check`/`bun run build`. Expected: PASS.
- [ ] **Step 6:** Commit.

```bash
git add -A supabase/functions/gmail-listener supabase/functions/gmail-backfill-approvals supabase/migrations supabase/functions/_shared/propertyGoogleIntegrationSeed.ts
git commit -m "chore: retire gmail-listener in favor of approval-email-webhook"
```

---

### Task 27: Connect Google UI decision

**Files:**

- Modify: `ui/src/features/dashboard/bookings/components/PropertyIntegrationsPanel.tsx`, `GmailMailIntegrationCard.tsx`, `GmailReconnectModal.tsx`

- [ ] **Step 1:** Keep the Gmail OAuth plumbing (`google-mail-oauth-start`/`-callback`, `gmail_mail_integration` table) in place — do not remove it in this plan. Recommend hiding or relabeling the "Connect Google" UI entry point as "internal only" / staff-testing-mode, since the production approval path no longer needs hosts to connect Gmail.
- [ ] **Step 2:** Update copy accordingly.
- [ ] **Step 3:** Document full Gmail OAuth removal as an explicit follow-up item in `docs/workflow/planned/google-oauth-verification.md` (mark this plan's phases as superseding its Phase 0-5, per that doc's own "Docs to update" table), not part of this plan.
- [ ] **Step 4:** Commit.

```bash
git add ui/src/features/dashboard/bookings/components/PropertyIntegrationsPanel.tsx ui/src/features/dashboard/bookings/components/GmailMailIntegrationCard.tsx ui/src/features/dashboard/bookings/components/GmailReconnectModal.tsx docs/workflow/planned/google-oauth-verification.md
git commit -m "chore: relabel Connect Google as internal-only after webhook cutover"
```

---

### Task 28: Docs pass for Phase 2

**Files:**

- Modify: `docs/PROJECT.md`, `.cursor/skills/gmail-listener/SKILL.md` (or `.claude/skills/gmail-listener/SKILL.md`), `.cursor/rules/booking-workflow.mdc`, `docs/guides/routes/org/property/settings.md`
- Create: `docs/archive/operations/approval-email-inbound.md` (setup, MX, webhook secret, Reply-To/CC strategy, test checklist)
- Modify: `docs/archive/operations/README.md` (index row for the new doc)

- [ ] **Step 1:** Write the new ops runbook covering the inbound webhook setup end-to-end (mirrors the structure already sketched in `docs/workflow/planned/google-oauth-verification.md`'s Phase 5).
- [ ] **Step 2:** Update `PROJECT.md`, the gmail-listener skill, `booking-workflow.mdc`, and the property settings route guide to point at the inbound webhook as the production approval path.
- [ ] **Step 3:** Commit.

```bash
git add docs .cursor/skills .claude/skills .cursor/rules
git commit -m "docs: document approval-email-webhook as production GAF/pet intake path"
```

---

# Appendix: Google Cloud Console cleanup guide

Separate ops doc, not inlined in the engineering plan: create `docs/archive/operations/google-cloud-console-cleanup.md`, referenced from both this plan and `docs/workflow/planned/google-oauth-verification.md`. Console changes are harder to reverse than code, so they run on their own timeline, gated on production confirmation — don't check these boxes just because the code merged.

## Pre-flight (before any console change)

- [ ] Confirm Phase 1 code is deployed to production.
- [ ] In Google Cloud Console → APIs & Services → Dashboard, confirm zero requests to the Calendar API and Sheets API for a full monitoring window (recommend 7+ days) after the Phase 1 deploy.
- [ ] In Cloud Audit Logs, confirm the service account (`GOOGLE_SERVICE_ACCOUNT`) shows zero recent authenticated API calls.

## Console steps, in order

1. **Disable Calendar API and Sheets API** in the GCP project (APIs & Services → Library → find each → Disable). Reversible — do this first.
2. **Remove `calendar`/`spreadsheets` scopes from the OAuth consent screen's scope list** (APIs & Services → OAuth consent screen → Scopes). Only do this after confirming zero active refresh tokens still request those scopes going forward — note that existing already-connected properties' refresh tokens retain their originally-granted scopes regardless of this change; it only prevents _new_ grants from including them (Phase 1 Task 15 already narrowed the app-side request, this narrows what's offered on the consent screen itself).
3. **Revoke/delete the service account key** (not the service account identity itself) — IAM & Admin → Service Accounts → find the account → Keys → delete the active key. Do this last, only after the API-disablement step has run cleanly through the monitoring window with zero errors.

## For the Phase 2 Gmail scope shrink (once Phase 2 lands and burn-in passes)

- [ ] Shrink the OAuth consent screen's scope list to `gmail.readonly` only (Calendar/Sheets scopes should already be gone per the steps above).
- [ ] If the "Connect Google" UI is fully retired later (a documented follow-up, not part of this plan), note the eventual step of deleting the OAuth client itself — explicitly out of scope here.

## Rollback note

Keep the service account and its Calendar/Sheets IAM role bindings **undeleted for a minimum 30-day grace period** after code removal ships, in case a hotfix needs to temporarily reference the old integration.

---

## Verification (end-to-end, after Phase 1 or Phase 2 lands)

- `bun run type-check && bun run lint && bun run build` at repo root — must pass with zero errors.
- `bun run check:filenames` — must pass (naming convention check).
- Local stack (`./dev.sh`) manual walkthrough via the `verify` skill (Playwright MCP):
  - Guest form submission → booking created, no Calendar/Sheets calls in logs.
  - Admin booking-detail workflow panel → confirm/transition a status → confirm modal only (no side-effect checkboxes); transition succeeds with orchestrator defaults.
  - Property Settings → Booking Workflow section → no Sync Google Calendar/Sheets toggles.
  - Property Settings → Integrations panel → no Google Calendar/Spreadsheet rows, Gmail row still present.
  - (Phase 2) POST a synthetic Resend webhook payload locally → booking transitions correctly; POST an ambiguous-match payload → skips without transitioning.
  - (Phase 2) Real end-to-end test: trigger a GAF/pet request email, reply as "Azure" to the inbound address, confirm the booking auto-advances the same way the old listener did.
- Grep sweep (Task 16 Step 2) — zero residual `CalendarService`/`SheetsService`/`google_calendar_id`/`google_spreadsheet_id`/`sync_calendar`/`sync_sheets`/`calendarConnected`/`sheetsConnected` references outside intentionally-kept guest-query-param stripping.
