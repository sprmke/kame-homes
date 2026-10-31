---
title: 'New Booking Flow — Implementation Plan'
status: archived
tags: [planning]
updated: 2026-08-02
---

# New Booking Flow — Implementation Plan

> Planning document for the redesign described in [[NEW_FLOW|New Flow]].
> Status: **§6.1 decisions locked**; **§6.2** = **Q7.4** (surprise setup) refinement only. **Phases 0–5 are implemented in-repo** (see [`docs/archive/todos/shipped/`](../todos/shipped/README.md)). **Phase 6+** (backfill script) still planned.
> Companion to [[PROJECT|Guest Form Management — Project Documentation]] (current state) and [`docs/todos/`](../todos/README.md) (backlog).

This doc captures:

1. What the new flow changes vs. the current system ([[PROJECT|Guest Form Management — Project Documentation]]).
2. The full file-level change list (what to add, edit, delete).
3. Decisions — **§6.1** (resolved) and **§6.2** (refinement: **Q7.4** only).
4. A phased rollout plan with migration/backup strategy.

---

## 1. Summary of the change

### 1.1 Today (as implemented)

- Guest submits `/form` → edge function runs **all side effects in one pass** (DB save, storage, PDF, GAF email to Azure, optional pet email, Google Calendar event, Google Sheet row).
- Status is a flat enum: `booked` or `canceled`.
- No admin/owner UI. Review happens out-of-band (via email + calendar).
- Historically, dev behavior used **query params** (`?dev=true`, formerly `?testing=true`) plus checkboxes for optional submit side effects. **Current app:** `?testing=true`, `?dev=true`, and test bookings are **removed** — use **local/staging Supabase** for safe trials; public `/form` shows save/storage/calendar/sheet toggles only when **`!production`** (FormData flags; production edge forces full path).

### 1.2 New flow (target)

- Guest submit is **much lighter**: DB save and storage upload only (guest images/receipts). **No PDF at submit time** — filled GAF / pet request PDFs are generated on admin **`PENDING_REVIEW` → initial documents** and attached to Azure request emails. No emails, no calendar, no sheet writes at submit time.
- Bookings move through an **explicit state machine** driven by the unit owner from a new `/bookings` admin dashboard.
- Each state transition fans out the right side effects (emails, calendar color changes, sheet updates, attachment persistence).
- A new **Gmail email listener** auto-advances status when Azure’s GAF and Pet approval emails arrive (and pulls approved PDFs into Supabase Storage).
- A scheduled job (cron) emails **Check-out & SD Refund** details while the stay is still **Ready for check-in** (pre-check-out lead window, Asia/Manila), then auto-transitions to **Ready for check-out** only when final guest balance is settled.
- A new **admin auth gate** (Google login, single allow-listed email) protects `/bookings` and enables dev controls automatically.
- **Guest `/form`:** optional dev API toggles when non-production only (no workflow emails/PDFs from submit; no `?dev=true`). **Admin `/bookings/:id`:** full workflow dev-controls when signed in as allow-listed admin (`RequireAdmin`). **No** test-booking column, **no** `?testing=true`, **no** `[TEST]` prefixes — staging/local env replaces inline test mode.

### 1.3 New booking state machine

```mermaid
stateDiagram-v2
  [*] --> PENDING_REVIEW: guest submits form

  PENDING_REVIEW --> PENDING_GAF: owner clicks "Proceed to PENDING GAF"
  PENDING_REVIEW --> CANCELLED: owner cancels

  PENDING_GAF --> PENDING_PARKING_REQUEST: Azure GAF approved & parking enabled
  PENDING_GAF --> PENDING_PET_REQUEST: Azure GAF approved, no parking, has pets
  PENDING_GAF --> READY_FOR_CHECKIN: Azure GAF approved, no parking, no pets
  PENDING_GAF --> CANCELLED

  PENDING_PARKING_REQUEST --> PENDING_PET_REQUEST: owner proceeds & has pets
  PENDING_PARKING_REQUEST --> READY_FOR_CHECKIN: owner proceeds & no pets
  PENDING_PARKING_REQUEST --> CANCELLED

  PENDING_PET_REQUEST --> READY_FOR_CHECKIN: Azure pet approval detected
  PENDING_PET_REQUEST --> CANCELLED

  READY_FOR_CHECKIN --> READY_FOR_CHECKOUT: sd-refund-cron (email in lead window; transition when settled)
  READY_FOR_CHECKIN --> PENDING_REVIEW: admin edits guest details after ready
  READY_FOR_CHECKIN --> CANCELLED

  READY_FOR_CHECKOUT --> PENDING_SD_REFUND: guest /sd-form or admin

  PENDING_SD_REFUND --> COMPLETED: owner proceeds
  PENDING_SD_REFUND --> CANCELLED

  COMPLETED --> [*]
  CANCELLED --> [*]
```

### 1.4 Google Calendar color mapping

**Calendar event `summary` (title) — no square brackets in production.** The visible status is plain text at the start, then pax/nights/guest:

`{STATUS LABEL} - {pax}pax {nights}night(s) - {guestFacebookName}`

Example: `PENDING REVIEW - 2pax 2nights - Guest Name`

| Status                    | Example `summary`                                                           | Color (Google `colorId`) |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| `PENDING_REVIEW`          | `PENDING REVIEW - 2pax 2nights - Guest Name`                                | Red (`11`)               |
| `PENDING_GAF`             | `PENDING GAF - 2pax 2nights - Guest Name`                                   | Yellow (`5`)             |
| `PENDING_PARKING_REQUEST` | `PENDING PARKING REQUEST - 2pax 2nights - Guest Name`                       | Yellow (`5`)             |
| `PENDING_PET_REQUEST`     | `PENDING PET REQUEST - 2pax 2nights - Guest Name`                           | Yellow (`5`)             |
| `READY_FOR_CHECKIN`       | `READY FOR CHECK-IN - 2pax 2nights - Guest Name`                            | Green (`10`)             |
| `PENDING_SD_REFUND`       | `PENDING SD REFUND - 2pax 2nights - Guest Name`                             | Orange (`6`)             |
| `COMPLETED`               | `COMPLETED - 2pax 2nights - Guest Name`                                     | Blue (`9`)               |
| `CANCELLED`               | `CANCELED - 2pax 2nights - Guest Name` (spelling matches today’s cancel UX) | Purple (`3`)             |

> Current calendar code uses `colorId: 2` (green) universally and `11` for canceled — will be replaced by a `STATUS → colorId` map in `_shared/calendarService.ts`.

---

## 2. New/changed database columns

A new migration will add:

| Column                        | Type          | Notes                                                                                                                                                                                                                                                |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                      | `TEXT`        | **Widen** existing column from `booked\|canceled` to the new enum. Existing `booked` rows migrate per **Q1.1** (§6): past check-ins → `COMPLETED`, today+ → `PENDING_REVIEW`.                                                                        |
| `status_updated_at`           | `TIMESTAMPTZ` | Last transition time, used by cron + sheet sync.                                                                                                                                                                                                     |
| `booking_rate`                | `NUMERIC`     | Entered at `PENDING_REVIEW` review step.                                                                                                                                                                                                             |
| `down_payment`                | `NUMERIC`     | Entered at `PENDING_REVIEW`.                                                                                                                                                                                                                         |
| `balance`                     | `NUMERIC`     | Auto-computed as **Total Guest Balance**: **`booking_rate - down_payment + security_deposit + pet_fee + parking_rate_guest`** (see **Q2.1** in §6). Display copy: "Total Guest Balance (paid on or before check-in)".                                |
| `security_deposit`            | `NUMERIC`     | New column; typical default **₱1500** (see **Q2.1** in §6). Tracked separately from balance.                                                                                                                                                         |
| `parking_rate_guest`          | `NUMERIC`     | Charged to guest. Shown when `need_parking = true`. **UI label (§6.1 Q4.5):** “Guest Parking Rate”.                                                                                                                                                  |
| `parking_rate_paid`           | `NUMERIC`     | Paid to parking owner. Shown at `PENDING_PARKING_REQUEST`. **UI label (§6.1 Q4.5):** “Owner Parking Rate”.                                                                                                                                           |
| `parking_owner`               | `TEXT`        | Owner or agent **display name** (who parking was obtained from). Captured in admin **`ParkingRequestForm`** above “Owner Parking Rate”. Distinct from legacy `parking_owner_email`.                                                                  |
| `parking_endorsement_url`     | `TEXT`        | Screenshot/image from parking owner, saved to Storage.                                                                                                                                                                                               |
| `pet_fee`                     | `NUMERIC`     | Shown when `has_pets = true`.                                                                                                                                                                                                                        |
| `approved_gaf_pdf_url`        | `TEXT`        | Written by email listener.                                                                                                                                                                                                                           |
| `approved_pet_pdf_url`        | `TEXT`        | Written by email listener.                                                                                                                                                                                                                           |
| `gaf_request_pdf_url`         | `TEXT`        | Filled GAF PDF from admin **review → docs** transition (`generatePdf`); not the Azure-approved file.                                                                                                                                                 |
| `pet_request_pdf_url`         | `TEXT`        | Filled pet request PDF from the same transition when `has_pets`.                                                                                                                                                                                     |
| `sd_additional_expense_items` | `JSONB`       | `PENDING_SD_REFUND` / `SdRefundForm` — array of **`{ label, amount }`** for each expense line. Source of truth for labels; amounts are mirrored into `sd_additional_expenses`. Default `[]`.                                                         |
| `sd_additional_profit_items`  | `JSONB`       | Same pattern for profit lines; amounts mirrored into `sd_additional_profits`.                                                                                                                                                                        |
| `sd_additional_expenses`      | `NUMERIC[]`   | Amounts only (derived from `sd_additional_expense_items` on save, or legacy-only rows). Same currency scale as other money columns.                                                                                                                  |
| `sd_additional_profits`       | `NUMERIC[]`   | Amounts only (derived from `sd_additional_profit_items` on save).                                                                                                                                                                                    |
| `sd_refund_amount`            | `NUMERIC`     | Final SD refund amount at `PENDING_SD_REFUND → COMPLETED`: **net SD** = `security_deposit + sum(additional expenses) − sum(additional profits)` (admin UI: read-only “Actual Refund Amount”; expenses **increase** refund, profits **decrease** it). |
| `sd_refund_receipt_url`       | `TEXT`        | URL to uploaded **SD refund receipt** image in Supabase Storage (`sd-refund-receipts` bucket); set via `upload-booking-asset` (`sd_refund_receipt`).                                                                                                 |
| `settled_at`                  | `TIMESTAMPTZ` | Stamp when moving to `COMPLETED`.                                                                                                                                                                                                                    |

**Removed:** `is_test_booking` was dropped in migration **`20260608120000_drop_is_test_booking.sql`** (no test-booking pipeline).

Plus new buckets or reused ones for: `parking-endorsements`, `approved-gafs`, `approved-pet-forms`, `sd-refund-receipts`.

---

## 3. Architecture deltas

### 3.1 New admin surface

- New feature folder `ui/src/features/dashboard/bookings/` with:
  - `pages/SignInPage.tsx` — Google-only sign-in.
  - `pages/BookingsListPage.tsx` — `/bookings` with search, filter (status, date range, has pets, has parking), sort (check-in, created, status), pagination.
  - `pages/BookingDetailPage.tsx` — `/bookings/:bookingId` renders the existing guest form with dev/admin controls always enabled, plus a right-side **workflow panel** showing the current state, available transitions, and state-specific input sections.
  - `components/StatusBadge`, `components/WorkflowPanel`, `components/ReviewPricingForm`, `components/ParkingRequestForm`, `components/SdRefundForm`, `components/BookingTable`, `components/BookingFilters`.
- `ui/src/features/dashboard/bookings/routes/index.tsx` exports protected routes mounted in `ui/src/routes/index.tsx`.
- Auth guard HOC / `RequireAdmin` wrapper.

### 3.2 Auth

- Supabase Auth Google provider (already available in Supabase) configured in dashboard.
- Single allow-listed email: `kamehome.azurenorth@gmail.com` (env: `ADMIN_ALLOWED_EMAILS` comma-separated, so we can grow later).
- UI: `@supabase/supabase-js` client already in project (for edge calls); add `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- Server: new helper `_shared/auth.ts` that validates the JWT on every admin-only edge function (`verify_jwt` flipped to true for those) and checks the allow list.

### 3.3 New / changed edge functions

| Function                                   | Method | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit-form` **(changed)**                | POST   | Saves DB + storage and sets initial status `PENDING_REVIEW` (**no PDF**). **Workflow emails are not sent here**; booking acknowledgement, GAF request (with filled GAF PDF), pet request (with pet PDF when applicable), and parking broadcast are sent only on `PENDING_REVIEW → PENDING_DOCUMENTS` / `PENDING_GAF` via `workflowOrchestrator` (`generatePdf` dev control). **After a successful DB save**, when **`sendEmail` ≠ `false`** (guest dev **Send email** checkbox; default on), sends **New Booking Request** (`sendNewBookingRequestNotify`) **to `EMAIL_REPLY_TO` only** (guest email as `Reply-To`). |
| `get-form` **(unchanged contract)**        | GET    | Still returns booking payload; now also includes workflow fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `get-booked-dates` **(changed)**           | GET    | Treats any non-`CANCELLED` status as blocking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `list-bookings` **(new, admin)**           | GET    | Paginated list for `/bookings`. Supports search/filter/sort.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `transition-booking` **(new, admin)**      | POST   | Body `{ bookingId, toStatus, payload }`. Validates transition, writes DB, fans out side effects, returns new state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `upload-booking-asset` **(new, admin)**    | POST   | Generic asset upload for parking endorsement, additional docs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `gmail-listener` **(new, scheduled)**      | POST   | Polled by Supabase scheduled trigger. Incremental Gmail **history** poll (pay-credit-cards pattern) for GAF/Pet approvals; downloads `APPROVED GAF.pdf`; persists PDFs; transitions booking via `workflowOrchestrator`.                                                                                                                                                                                                                                                                                                                                                                                              |
| `sd-refund-cron` **(new, scheduled)**      | POST   | Runs every ~5 min; sends guest check-out email in the pre-check-out lead window; transitions `READY_FOR_CHECKIN` → `READY_FOR_CHECKOUT` when settlement is complete (Asia/Manila).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `parking-broadcast-email` **(new, admin)** | POST   | Sends the “parking availability” broadcast BCC to `PARKING_OWNER_EMAILS`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `cancel-booking` **(changed)**             | POST   | Status becomes `CANCELLED`; color + title adjusted per new map; keeps existing data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Removed:** `cleanup-test-data` edge function (test-data wipe no longer used).

### 3.4 Email listener design (Gmail)

**Reference implementation (read this first):** `/Users/michaelmanlulu/Projects/personal-projects/automated-tasks/pay-credit-cards/`

The pay-credit-cards repo is the **canonical pattern** for how we already solved “watch Gmail → download PDFs → do work” in production:

| Concern                                  | Where it lives in `pay-credit-cards`                                                                           | What guest-form-management should copy (conceptually)                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth (Desktop client + refresh token)   | `src/gmail-auth.ts`, `docs/SETUP.md` §2 / §2.6                                                                 | One-time human auth writes a **refreshable token**; **Supabase stores the same JSON secrets** (`client_id`, `client_secret`, `refresh_token`) — no browser inside Edge Functions.                                                        |
| Gmail API client                         | `src/gmail.ts#getGmailClient`                                                                                  | Exchange refresh token → short-lived access token on each run; detect `invalid_grant` and surface “re-auth needed”.                                                                                                                      |
| Incremental polling (no full inbox scan) | `src/gmail-history.ts`, `src/gmail-poll-new-soa.ts`                                                            | Persist **`historyId`** (mailbox cursor) + handle **HTTP 404 history expired** by resetting cursor (`--init` equivalent). Use `users.history.list` with `historyTypes: ['messageAdded']` to get **only new message IDs** since last run. |
| Message fetch + attachments              | `src/gmail-poll-new-soa.ts` (`users.messages.get` with `format: 'full'`), `src/gmail.ts#searchAndDownloadPdfs` | For each candidate `messageId`, fetch **full** payload, walk `payload.parts`, download `users.messages.attachments.get`, base64url-decode bytes → upload to Supabase Storage.                                                            |
| Idempotency beyond Gmail history         | `src/gmail-poll-new-soa.ts` (`processedSoaRunMessageIds` ring buffer)                                          | Keep a **DB table** `processed_emails` (already planned) as the durable dedupe layer across deploys; optional `gmail_listener_state` row for `historyId` (see §4.1 migrations).                                                          |

**Important correction vs older notes:** pay-credit-cards does **not** use a Gmail **service account**. It uses **end-user OAuth** (`gmail.readonly` + optional other scopes). For guest-form-management, **`gmail.readonly` alone is sufficient** unless we later decide the listener also writes Calendar (it should not — calendar writes stay in `workflowOrchestrator`).

**Runtime mapping:** pay-credit-cards runs on **Node + `googleapis`**. `gmail-listener` runs on **Deno** — re-implement the same HTTP calls (or import `googleapis` via `npm:` on Deno if we choose; either way keep the **state machine + side effects** in `_shared/workflowOrchestrator.ts`).

**Matching rules (unchanged intent):** poll every ~5 minutes (Supabase schedule) and only process threads that match **the same subject patterns we already send today** (`supabase/functions/_shared/emailService.ts` — `Monaco 2604 - GAF Request (…)` / `Monaco 2604 - Pet Request (…)`; strip optional test/urgent/update/reply prefixes per **§6.1 Q6.3/Q6.4**), contain an approved attachment (case-insensitive filename matching with spaces/underscores/hyphens tolerated; GAF accepts `APPROVED GAF.pdf` variants, Pet accepts `APPROVED PET*.pdf` and legacy `APPROVED GAF.pdf`), and (when configured) have `From` matching **`EMAIL_TO`** (Documents Approver in Settings / `app_settings`).

**Booking correlation:** parse `(checkIn → checkOut)` from the subject, normalize to the DB’s `MM-DD-YYYY` text dates, then `SELECT` the single active row in `PENDING_DOCUMENTS` (legacy fallback: `PENDING_GAF` / `PENDING_PET_REQUEST`) with those dates.

**Side effects:** download attachment → upload to Storage → set `approved_gaf_pdf_url` / `approved_pet_pdf_url` → call `transition-booking` → `workflowOrchestrator` (never call Calendar/Sheet/Email directly from the poller).

**Idempotency:** `processed_emails.message_id PRIMARY KEY` prevents double-processing if Gmail history replays a message id; store `kind` (`gaf` vs `pet`) + `status` (`applied`/`skipped`/`failed`) + `reason` text for debugging.

### 3.5 Templates / emails to add

- `booking_acknowledgement` (to guest, on `PENDING_DOCUMENTS` transition).
- `parking_broadcast` (BCC to parking owners, subject e.g. “Parking availability request — Monaco 2604 (MM-DD to MM-DD)”).
- `parking_paid_confirmation` (to selected parking owner — optional, see Q4.2).
- `ready_for_checkin` (to guest) — includes approved GAF PDF, pet GAF (if any), parking endorsement (if any), payment breakdown, house rules.
- Existing `gaf_request` / `pet_request` emails: tweak so guest is never CC’d.

---

## 4. File-by-file change list

### 4.1 New files

```
docs/
  NEW_FLOW_PLAN.md                                # this document
  migration-runbook.md                            # step-by-step backup + backfill steps

supabase/migrations/
  20260501000000_backup_guest_submissions.sql     # creates guest_submissions_backup_<timestamp>
  20260501000001_add_booking_status_enum.sql      # widens status + seeds new values
  20260501000002_add_workflow_columns.sql         # booking rate, parking rates, pet fee, SD fields, etc.
  20260501000003_add_approved_pdf_columns.sql     # approved_gaf_pdf_url, approved_pet_pdf_url
  20260501000004_add_is_test_booking.sql
  20260501000005_create_processed_emails_table.sql
  20260501000006_create_parking_endorsements_bucket.sql
  20260501000007_create_approved_gafs_bucket.sql
  20260501000008_create_sd_refund_receipts_bucket.sql
  20260501000009_create_gmail_listener_state.sql     # last Gmail historyId (+ optional metadata) — mirrors pay-credit-cards watch state file

supabase/functions/
  _shared/
    auth.ts                                       # verifyAdminJwt(req) helper
    statusMachine.ts                              # canTransition() + color/prefix maps
    gmailClient.ts                                # OAuth + Gmail API helpers (history poll, message get, attachment download)
    workflowOrchestrator.ts                       # orchestrates side effects per transition
    templates/
      booking-acknowledgement.html
      parking-broadcast.html
      ready-for-checkin.html
  list-bookings/index.ts
  transition-booking/index.ts
  upload-booking-asset/index.ts
  gmail-listener/index.ts
  sd-refund-cron/index.ts
  parking-broadcast-email/index.ts

supabase/config.toml changes:
  - new buckets
  - scheduled functions (gmail-listener @ */5 * * * *, sd-refund-cron @ */5 * * * *)
  - verify_jwt = true for list-bookings, transition-booking, upload-booking-asset, parking-broadcast-email

ui/src/features/dashboard/bookings/
  routes/index.tsx
  pages/SignInPage.tsx
  pages/BookingsListPage.tsx
  pages/BookingDetailPage.tsx
  components/
    RequireAdmin.tsx
    BookingTable.tsx
    BookingFilters.tsx
    StatusBadge.tsx
    WorkflowPanel.tsx
    ReviewPricingForm.tsx
    ParkingRequestForm.tsx
    SdRefundForm.tsx
  hooks/
    useAdminSession.ts
    useBookings.ts
    useTransitionBooking.ts
  lib/
    supabaseClient.ts                             # single shared client (if not already extracted)
    workflow.ts                                   # transition rules mirrored from server
```

### 4.2 Files to edit

```
supabase/functions/submit-form/index.ts
  - Remove email, calendar, sheet side effects (workflow uses `transition-booking`).
  - Always DB + storage (optional calendar/sheet via guest-form dev query flags). **No guest-submit PDF** — see Q3.1.
  - Set status = `PENDING_REVIEW`. **No** `is_test_booking`, **no** `[TEST]` / `TEST_` prefixes.

supabase/functions/_shared/calendarService.ts
  - Replace colorId '2' literal with STATUS → colorId map.
  - Replace cancel-specific `[CANCELED]` summary prefix (legacy) with status-driven titles: canceled events use summary `CANCELED - …` (no brackets) + purple `colorId` per §1.4.

supabase/functions/_shared/sheetsService.ts
  - Widen AK → add columns for new fields (booking rate, down payment, balance,
    parking rate guest, parking rate paid, pet fee, approved GAF URL, approved pet URL,
    SD additional expenses array, SD additional profits array, SD refund amount, SD refund receipt URL, status_updated_at).
  - Add a "status text" column matching the new enum (Booked/Canceled is replaced).

supabase/functions/_shared/emailService.ts
  - Remove guest CC from GAF + pet flows.
  - Add sendBookingAcknowledgement(), sendReadyForCheckin(), sendParkingBroadcast(),
    sendParkingPaidConfirmation().
  - Factor out a shared "subject with status + date range" helper.

supabase/functions/_shared/databaseService.ts
  - Add helpers: getBookingById, listBookings({search,filter,sort,page,limit}),
    updateBookingStatus, setWorkflowFields.
  - processFormData stays but no longer kicks side effects.
  - checkOverlappingBookings: treat any non-CANCELLED status as blocking.

supabase/functions/cancel-booking/index.ts
  - Use status machine + workflow orchestrator.
  - Keep soft-cancel semantics.

supabase/functions/get-booked-dates/index.ts
  - Change filter to status NOT IN ('CANCELLED').

supabase/functions/_shared/types.ts
  - Add BookingStatus enum/union type.
  - Add WorkflowPayloads type map.
  - Extend GuestSubmission with new columns.

ui/src/features/guest/form/components/GuestForm.tsx
  - Optional dev API toggles when non-production only (no `dev` / `testing` query params).
  - Dev checkboxes renamed:
    'Send email notification' → 'Send GAF request email'
    + 'Send Parking broadcast email' (shown if needParking)
    + 'Send Pet request email' (shown if hasPets)
  - Parking help text: "Parking fee is non-refundable and cannot be rescheduled."

ui/src/features/guest/calendar/pages/CalendarPage.tsx
  - Legacy /?bookingId=... redirect: drop dev/testing appends; admin session handles it.

ui/src/features/guest/form/routes/index.tsx
  - No structural change — admin routes added in sibling feature folder and merged in ui/src/routes/index.tsx.

ui/src/routes/index.tsx
  - Merge guestFormRoutes + adminRoutes; wrap /bookings routes in <RequireAdmin>.

ui/src/App.tsx
  - Wrap with <AuthProvider> (or tanstack-query + supabase session hook).

ui/package.json
  - Add: @supabase/supabase-js, @tanstack/react-query, @tanstack/react-table (for list),
    zustand or jotai (optional for admin UI state), react-hook-form already present.

docs/PROJECT.md
  - Update to reflect new flow once shipped (per .cursor/rules/documentation-maintenance.mdc).

docs/todos/
  - Mark covered items; add follow-ups uncovered during scoping (GitHub Issues + epic specs).
```

### 4.3 Files to remove / deprecate

- **`cleanup-test-data`** edge function removed; **`is_test_booking`** column dropped (`20260608120000_drop_is_test_booking.sql`).
- Calendar descriptions use admin **`/bookings/:id`** links — no guest-form query-param spam.

---

## 5. Phased rollout

Each phase is independently deployable. (A repo-wide `NEW_FLOW_ENABLED` flag was considered in early drafts; **not** used — gating is by shipped migrations + UI routes.)

Order:

1. ✅ **Phase 0 — Backup & schema.** Snapshot **`guest_submissions_backup_20260501`** (`20260501000000_*`); nullable workflow columns + approved/request PDF URLs + `processed_emails` + `gmail_listener_state` + four storage buckets (`20260501000002`–`20260501000010`). **`20260428120000_*`** (`PENDING_DOCUMENTS`) runs **before** that batch in filename order. No app-code requirement by itself — see **[[migration-runbook|Migration Runbook — New Booking Flow]] §1**.
2. ✅ **Phase 1 — Admin auth + empty dashboard.** Google sign-in, allow list, `/bookings` reads existing rows, no transitions yet. `RequireAdmin` guard.
3. **Phase 2 — State machine read path.** ✅ Migration `20260502000000_widen_status_enum.sql` backfills legacy rows, widens `status` to `TEXT + CHECK`, sets `DEFAULT 'PENDING_REVIEW'`. `_shared/statusMachine.ts` (server) + `ui/src/features/dashboard/bookings/lib/workflow.ts` (client) created with full transition graph, calendar meta map, and sub-form requirements. `get-booked-dates` + `databaseService.checkOverlappingBookings` updated to block on any non-`CANCELLED` status. `StatusBadge` already rendering in the bookings list (wired in Phase 1).
4. ~~**Phase 2 — State machine read path.**~~ ✅ Done — see note above §5.
5. ✅ **Phase 3 — Transitions (no email listener yet).** `_shared/workflowOrchestrator.ts` fans out all side effects (DB, Calendar, Sheet, email) per the side-effect matrix. New edge functions: `list-bookings` (admin, paginated, server-side check-in sort), `transition-booking` (admin, routes all manual advances through orchestrator), `upload-booking-asset` (admin, stores parking endorsement / approved PDFs / guest docs), `parking-broadcast-email` (admin, manual re-send of parking availability BCC). `cancel-booking` refactored through orchestrator. All admin functions set `verify_jwt = false` in `config.toml` (Kong ES256 workaround; `verifyAdminJwt()` in handler is the real gate). Frontend: `/bookings/:bookingId` detail page with `WorkflowPanel`, `ReviewPricingForm`, `ParkingRequestForm`, `SdRefundForm`, `useBooking`, `useTransitionBooking`, `useCancelBooking`. `useBookings` now calls `list-bookings` edge function (with PostgREST fallback) and defaults to `check_in_date:asc` sort per Q5.1. Sort dropdown added to `BookingFilters`. Table rows now link to `/bookings/:bookingId`. New email functions: `sendBookingAcknowledgement`, `sendReadyForCheckin` (with approved GAF PDF, pet PDF, parking endorsement attachments + house rules), `sendParkingBroadcast`. Shared storage helpers (`parseStorageUrl`, `downloadStorageFile`, `toBase64`) extracted to module level. CC fix on GAF/pet emails (guest no longer CC'd). Calendar service updated with `updateCalendarEventStatus` and status→colorId map.

- **Phase 3.1 — Bookings UX upgrade (post-Phase 3).** ✅
  - `/bookings` now offers three views via `?view=table|card|calendar` (`BookingViewToggle` icon segmented control). New `BookingCardGrid` (responsive 1/2/3/4-col grid) and `BookingCalendarView` (month grid + selected-day detail panel with multi-booking handling).
  - Date-range filter ported from `property-management-app/.../calendar`: `useDateNavigation` hook (week/month/year/custom presets, prev/next stepping, "Today" reset) + `useSyncDateRangeWithQuery` to mirror state into URL `?from`/`?to` (YYYY-MM-DD). Custom range uses 2-month `react-day-picker` styled with project tokens. Component: `BookingDateRangeFilter`.
  - Avatars now render `valid_id_url` thumbnails with a single-color (sidebar-primary green) initial fallback via shared `GuestAvatar` (used by table, cards, and calendar detail).
  - Larger flag icons (Car / Dog) pill-style with tinted backgrounds; whole-row click on `BookingTable` (Enter/Space supported) plus whole-card click in `BookingCardGrid`.
  - Free-text search broadened: `q` matches across primary guest, additional guests (`guest2_name`…`guest5_name`), email, phone, address, nationality, pet name/type/breed, plate/brand/color, and free-text notes (`guest_special_requests`, `find_us_details`). Mirrored in both `list-bookings` edge function and `useBookings` PostgREST fallback so behavior is identical on auth hiccups.
  - **Workflow panel actions are guest-data-aware.** New `isTransitionApplicable(from, to, booking)` (in `ui/src/features/dashboard/bookings/lib/workflow.ts`) filters the graph-legal transitions before rendering buttons, so the WorkflowPanel only shows steps that match the booking's `need_parking` / `has_pets` flags. The natural order from §3 of `booking-workflow.mdc` is preserved: parking before pet when both apply, and "skip to Ready for Check-in" only surfaces from `PENDING_GAF` when neither sub-stage is needed. The state machine is unchanged — this is a UI affordance only; the server still validates against the full transition graph.
  - **WorkflowPanel pipeline stepper + Back navigation.** `WorkflowPanel` now renders a vertical stepper (new `PipelineStepper` sub-component) showing the _applicable_ journey for this booking — parking and pet steps are filtered out when those flags are off, completed steps render as emerald checkmarks, the current step gets a blue ring + "Since X ago" timestamp, and upcoming steps render as outlined dots. The "Actions" section was simplified from a flat button list to **one** primary "Proceed to {next step}" CTA + **one** secondary "← Back to {previous step}" recovery button + the existing destructive "Cancel Booking". `next` and `prev` are derived from the booking-aware pipeline via new helpers `bookingPipeline()`, `nextStep()`, `previousStep()` in `workflow.ts`.
  - **Backward overrides** were added to `MANUAL_OVERRIDE_GRAPH` on **both** server (`statusMachine.ts`) and client mirror (`workflow.ts`): `PENDING_GAF → PENDING_REVIEW`, `PENDING_PARKING_REQUEST → PENDING_GAF`, `PENDING_PET_REQUEST → {PENDING_PARKING_REQUEST | PENDING_GAF}`, `READY_FOR_CHECKIN → {PENDING_DOCUMENTS | PENDING_PET_REQUEST | PENDING_PARKING_REQUEST | PENDING_GAF | PENDING_REVIEW | PENDING_SD_REFUND}`, `READY_FOR_CHECKOUT → READY_FOR_CHECKIN`, `PENDING_SD_REFUND → READY_FOR_CHECKOUT`. `COMPLETED` and `CANCELLED` stay terminal.
  - **Email re-fire safety:** `workflowOrchestrator` sends the ready-for-check-in email only when moving **forward** to `READY_FOR_CHECKIN` from `PENDING_DOCUMENTS` or legacy `PENDING_GAF` / `PENDING_PARKING_REQUEST` / `PENDING_PET_REQUEST` (not from e.g. `PENDING_SD_REFUND → READY_FOR_CHECKIN`). The dev control matches those pre-ready statuses. See `.cursor/rules/booking-workflow.mdc` §2.2 for override edges.
  - **Auto-advance `PENDING_DOCUMENTS` → `READY_FOR_CHECKIN`:** after any `PENDING_DOCUMENTS → PENDING_DOCUMENTS (document_completion_target)` transition (marking GAF / parking / pet complete), the orchestrator immediately re-checks `getPendingDocumentsNestedCompletion`. When all required sub-steps are done it fires a recursive non-manual `READY_FOR_CHECKIN` transition (with `sendReadyForCheckinEmail: true`) before returning to the caller. This fires for every path through the orchestrator — gmail-listener, admin parking form submission, and reconciliation — so no manual "Proceed" click is needed when the last sub-step completes. If the auto-advance fails it is non-fatal; the orchestrator logs the error and returns the `PENDING_DOCUMENTS` result so the admin can advance manually.
  - **Calendar title detail for `PENDING_DOCUMENTS`:** event prefix now resolves to the exact currently pending nested stage (`PENDING GAF`, `PENDING PARKING REQUEST`, or `PENDING PET REQUEST`) from completion markers (`*_completed_at` / approved GAF & pet PDFs; parking step uses `parking_completed_at`, not endorsement URL alone). Color remains the same pending-docs yellow family (`colorId: 5`).

6. ✅ **Phase 4 — Email listener + cron.** `gmail-listener` (Gmail OAuth via `GMAIL_OAUTH_CLIENT_JSON` + `GMAIL_OAUTH_TOKEN_JSON` secrets, `users.history.list` incremental poll, `APPROVED GAF.pdf` download + Storage upload, `processed_emails` dedupe, `gmail_listener_state` cursor) + `sd-refund-cron` (Asia/Manila pre-check-out **lead** window + settlement-gated transition, idempotent via status machine + `sd_refund_form_emailed_at`). Schedule config commented out in local `config.toml` (local CLI rejects `schedule` key) — enable in Supabase Cloud dashboard. Gmail OAuth credentials written to `supabase/.env.local` via `npm run gmail-auth`. **Operations + testing:** [[scheduled-jobs-and-testing|Scheduled jobs (cron) and how to test them]] (how `pg_cron` / `pg_net` invoke the functions, local curl and admin “Run now” steps).
7. ✅ **Phase 5 — Submit-form cleanup.** Shipped: `submit-form` is DB + storage only (optional calendar/sheet via guest dev flags); workflow emails only on transitions; **no** test-booking mode (`?testing=true`, `is_test_booking`, `[TEST]` prefixes, `cleanup-test-data`).
8. **Phase 6 — Backfill sync.** One-shot migration script resyncs all non-cancelled bookings into Google Calendar & Sheet with new titles/colors/columns.

See **[[production-deployment|Production deployment — checkout checklist]]** for the **ordered production cutover** (backups, CLI, secrets, Google, UI, cron). See **[[migration-runbook|Migration Runbook — New Booking Flow]]** for migration detail, verification queries, Phase 0 rollback caveats, and **§1.3** follow-on migrations.

---

## 6. Decisions & open questions

### 6.1 Resolved decisions (product + migration)

These are **locked in** from owner answers (2026-04-21). Implementation must follow them.

| ID                   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1.1**             | **Legacy migration for `status = 'booked'`** (non-canceled rows): compare **check-in date** to **today** in **`Asia/Manila`**. If check-in is **strictly before** today → set `COMPLETED`. If check-in is **today or in the future** → set `PENDING_REVIEW`. Rows already `canceled` stay `CANCELLED` (normalize casing to the new canonical spelling). _Rationale: past stays are closed; active/upcoming stays need re-review under the new pipeline._ **Calendar blocking** for legacy rows follows **Q7.2** (`COMPLETED` **still** blocks dates; only `CANCELLED` frees).                                                                                                                                                                                                                                                             |
| **Q1.3**             | **Status column type:** use **`TEXT` + `CHECK (status IN (...))`** (single column, values match the workflow enum). _Rationale:_ Postgres `ENUM` is painful to evolve (each new status needs `ALTER TYPE`); `TEXT` + `CHECK` matches a state machine that will keep gaining edge cases.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Q1.4**             | **Money in Postgres:** **`NUMERIC(12,2)`** for peso fields (`booking_rate`, `down_payment`, `parking_*`, `pet_fee`, `security_deposit`, etc.). _Rationale:_ matches human-readable amounts and existing sheet-style numbers; avoids a large cents migration. (If we ever need sub-cent precision, revisit.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Q1.6**             | **Audit:** ship **`status_updated_at`** (and keep `updated_at` on the row) in v1. **Defer** a dedicated `booking_status_history` table unless we hit a compliance/debug need — manual transitions + `processed_emails` cover a lot of traceability for now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Q2.3**             | **Where numbers appear:** **Google Calendar** event description = **trimmed** (dates, pax/nights, headline amounts: rate, balance, SD line if any — no full fee dump). **Sheet** = **full** numeric columns we already maintain / extend. **Guest emails** = **full payment breakdown** on `ready_for_checkin`; other emails stay focused (only lines relevant to that email).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Q2.4**             | **Currency display:** store DB as numeric; **UI + emails** use **`₱` prefix** and **thousands separators** (e.g. `₱12,345.67`) — implement via a small shared formatter (locale `en-PH` is a good default for grouping).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Q3.1**             | **PDF:** **filled GAF + pet request PDFs** are generated in **`workflowOrchestrator`** on **`PENDING_REVIEW` → `PENDING_GAF` / `PENDING_DOCUMENTS`** (admin dev control `generatePdf`, default on), attached to Azure GAF/pet emails, and persisted to Storage as `gaf_request_pdf_url` / `pet_request_pdf_url` when **Save to database** is on. **`submit-form` does not generate PDFs.**                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Q3.2**             | **Dev controls:** the **workflow dev-controls block** (checkboxes including **Generate GAF / pet request PDFs**) is **admin-only** on `/bookings/:id`. Public guest `/form` exposes **save / storage / calendar / sheet** toggles when **non-production only** (FormData; never `?dev=true`) — **not** PDF or workflow emails. Authenticated allow-listed admin enables the full admin dev panel on `/bookings/:id`.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Q3.3**             | **Renamed email checkboxes** gate **every** path that would send that **category** of email (not only the first `PENDING_REVIEW → PENDING_GAF` hop). If a transition or save triggers “GAF request”, “Pet request”, or “Parking broadcast”, the corresponding checkbox must be respected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Q3.4**             | **Superseded (2026-06):** no `is_test_booking`, no Test Submit, no prod dry-run flags — removed in favor of **local/staging Supabase** projects for safe integration testing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Q4.2**             | **Parking payment notification:** **no** automated “you won” email to the selected parking owner in v1. After the owner manually completes payment with the chosen contact, it stays a **manual reply / manual record** in operations (same as **Q4.3** manual parking thread handling).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Q4.4**             | **Parking endorsement asset:** **manual** — staff takes a **screenshot** and uploads via **`upload-booking-asset`** (or equivalent admin UI). **No** auto-screenshot / browser automation in v1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Q4.5**             | **Display labels** (admin UI + guest-facing copy; DB columns stay `parking_rate_guest` / `parking_rate_paid`): **`parking_rate_guest` → “Guest Parking Rate”**; **`parking_rate_paid` → “Owner Parking Rate”**. Optional helper copy in admin form: **“parking amount paid to parking owners”**. Parking owner email selection is no longer captured in the admin workflow UI/API.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Q5.1**             | **`/bookings` list defaults:** **sort by check-in date** (ascending is a good default so the next stay is on top; admin can change). **Default filter:** **hide `COMPLETED`** bookings whose **check-in date is strictly before today** (`Asia/Manila`) **and** hide **today-and-past** dates when the row is already **completed** — i.e. do **not** clutter the default view with finished past stays. **Still show** past check-in dates when the booking is **not** terminal (e.g. still `PENDING_SD_REFUND` / awaiting money follow-up). (Exact filter SQL / labels can read “Active & upcoming” vs an explicit “Show completed” toggle.)                                                                                                                                                                                            |
| **Q5.2**             | **Pagination:** default **31** rows per page; page-size control **31 / 50 / 100**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Q5.3**             | **Bulk actions:** **yes** where low-risk (e.g. bulk export CSV later, bulk tag test rows if ever needed). **Do not** bulk-force arbitrary status jumps without strong confirmation UI — ship incrementally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Q5.4**             | **Activity log / timeline** on booking detail: **not** in v1 (defer).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Q6.2**             | **Gmail OAuth** is for inbox **`kamehome.azurenorth@gmail.com`** (the mailbox that receives Azure approval threads today).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Q6.5**             | **Multiple DB matches** for one approval email (same parsed date range + more than one row in `PENDING_GAF` / `PENDING_PET_REQUEST`): **do not auto-apply** to a guessed row. **Record** in `processed_emails` as **`skipped`/`failed`** with reason **`ambiguous_multiple_bookings`**, log clearly, and surface a **“needs attention”** indicator on `/bookings` / detail so an admin **manually** attaches the PDF + transitions the correct booking. _This avoids silently approving the wrong guest._ **Owner confirmed:** if this scenario happens, **resolve manually** only — no automation picks a winner.                                                                                                                                                                                                                        |
| **Q6.6**             | **Listener / cron reliability:** Supabase **scheduled** Edge invocations are authoritative (**not** your laptop — sleeping machine does not stop the server). On **transient** Gmail/API errors: **retry with backoff** on the next schedule tick (bounded by Gmail rate limits — not infinite tight loops). On **persistent** failure or **ambiguous** outcomes (**Q6.5**): expose **admin manual triggers** on `/bookings/:id` (or a small admin tools strip): **“Run Gmail poll now”**, **“Run SD refund cron now”** (or generic “re-run scheduled job for this booking”) that call the same Edge endpoints with admin JWT. **Manual overrides** (**§6.1 “Manual overrides”**) remain the escape hatch.                                                                                                                                |
| **Q7.1**             | **SD refund cron timezone:** use **`Asia/Manila`** wall clock consistently with **Q1.1** — `check_out_date` + `check_out_time` minus a configurable **lead** (default **120 minutes**) for automated **guest check-out email** while still `READY_FOR_CHECKIN`; **auto-transition** `READY_FOR_CHECKIN` → **`READY_FOR_CHECKOUT`** only after final balance settlement (implementation as shipped).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Q7.2**             | **`get-booked-dates` / calendar blocking:** **`COMPLETED` still blocks** the booked date range on the picker (same as today’s non-`CANCELLED` behavior). **Only `CANCELLED`** frees dates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Q7.3**             | **Legacy calendar HTML links** that still contain `dev=true` / old query params: **leave existing calendar descriptions as-is** (no mass rewrite). New events use clean `/bookings/{id}` admin links. Opening guest URLs that still carry `dev` / `testing` / control flags **strips those keys** on load (`stripLegacyFromQueryParam`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Q7.4 (partial)**   | **Surprise setup** checkbox: **in scope**. **Placement:** directly **above** the “Special Requests” text area. **Copy:** require an **info/helper label** stating guests should **only check after discussing with the owner**. Further product copy / DB column name / whether it affects transitions stays **open for refinement** — see **Q7.4** in §6.2 (kept intentionally).                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Q7.5**             | **Parking non-refundable + no-reschedule** warning: show on **both** the **guest form** (near parking fields) **and** the relevant **emails** (at minimum anything that confirms parking selection / payment).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Q7.6**             | **Automated tests in v1:** **ship first** — **no blocking** requirement for a full Jest/Playwright/CI suite on day one; ship admin + listener + workflow, then **add tests incrementally**. **Do** leave hooks for a **tiny** smoke test later (e.g. `get-booked-dates` filtering) if time permits. _What this question meant:_ schedule risk — block launch on full coverage vs ship and backfill tests. **Owner confirmed:** **ship first.**                                                                                                                                                                                                                                                                                                                                                                                            |
| **Q7.7**             | **Observability:** **v1 = Supabase-native** — Edge Function logs, Postgres logs, scheduled job history in dashboard. That matches a solo/small project with **no extra vendor** yet. **Optional follow-up:** add **Sentry** (or similar) **for the React UI** if client-side errors in production become opaque; avoid sending guest PII in error breadcrumbs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Q1.2**             | **Superseded by Q1.1** — past bookings land in `COMPLETED` via the check-in rule, not `READY_FOR_CHECKIN`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Q2.1**             | **Total Guest Balance** = `booking_rate - down_payment + security_deposit + pet_fee + parking_rate_guest`. The admin pricing panel shows this as **"Total Guest Balance (paid on or before check-in)"**. `parking_rate_guest` is editable from the same pricing panel and contributes to this computed total.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Q4.1**             | Env var: **`PARKING_OWNER_EMAILS`** (comma-separated, no spaces after commas is fine). Initial seed list: `michaeldmanlulu2@gmail.com,perezarianna0410@gmail.com` — owner will update later in env, not in code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Q4.3**             | **Manual** parking-owner replies for now — **no** Gmail listener for parking threads in v1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Q6.1**             | **Gmail listener reference implementation:** `/Users/michaelmanlulu/Projects/personal-projects/automated-tasks/pay-credit-cards/`. Treat `src/gmail-auth.ts` + `src/gmail.ts` + `src/gmail-history.ts` + `src/gmail-poll-new-soa.ts` + `docs/SETUP.md` as the blueprint: **Desktop OAuth client** (`configs/credentials.json`) → **`npm run gmail-auth`** writes **`configs/token.json`** (refresh token) → poller persists **`historyId`** + dedupes processed message ids → uses **`users.history.list`** for incremental `messageAdded` events → **`users.messages.get(format=full)`** to inspect attachments → **`users.messages.attachments.get`** to download bytes. Port the same _behavior_ to Supabase Edge (`gmail-listener`) using secrets instead of local files + add durable dedupe in Postgres (`processed_emails`, §4.1). |
| **Q6.3 / Q6.4**      | Match Azure approval messages using **the same subject lines we already generate** in `supabase/functions/_shared/emailService.ts` today — i.e. subjects starting with `Monaco 2604 - GAF Request (`…`)` and `Monaco 2604 - Pet Request (`…`)` (with optional `🚨 URGENT -` on same-day check-in for **GAF / Pet / Parking request** subjects only, plus `(Updated)` where applicable). Attachment filename to treat as approved: **`APPROVED GAF.pdf`** (per [[NEW_FLOW]]).                                                                                                                                                                                                                                                                                                                                                              |
| **Q5.5**             | **Guest-field edits when `READY_FOR_CHECKIN`:** only revert `status` → `PENDING_REVIEW` when the update comes from the public `/form` flow or the admin `/bookings/:bookingId` form, **and** at least one workflow-sensitive field changed: Facebook/Airbnb name, primary guest name, email, phone number, additional guest names, check-in/check-out dates or times, parking details, pet details, downpayment receipt, valid ID, pet vaccination, or pet photo. If changes are outside this list, keep the current status. **Dev-control checkboxes still gate every side effect** (DB save, storage, PDF, each email type, calendar, sheet) exactly as today — reverting status does **not** bypass them.                                                                                                                              |
| **Manual overrides** | On `/bookings/:id`, for **every** status, admin must be able to **manually advance** to the next workflow step (or any valid forward jump the UI exposes) — especially to cover cases where **`sd-refund-cron`** (check-out email + settlement-gated `READY_FOR_CHECKIN` → `READY_FOR_CHECKOUT`) or the **Gmail listener** should have fired but didn’t. Manual transitions call the same `transition-booking` → `workflowOrchestrator` path as automation.                                                                                                                                                                                                                                                                                                                                                                               |

### 6.2 Still open (refinement — **Q7.4** only)

Former §6.2 items are **resolved in §6.1** except **surprise-setup** details below.

**Reference — edge case + schedule (both locked in §6.1, owner confirmed)**

- **Q6.5** — Rare case: two rows share the same parsed approval dates; automation must **not** choose. **Owner confirmed:** **manual resolution only** (see §6.1 **Q6.5** for `processed_emails` + UI surfacing).

- **Q7.6** — Tests vs launch: **owner confirmed** **ship first**; optional small smoke tests later (see §6.1 **Q7.6**).

---

## 7. Acceptance criteria (rough)

Turn §6.1 + **Q7.4** (§6.2) into concrete test cases before Phase 0 ships.

- Guest submit on `/form` creates a row with `status = PENDING_REVIEW`, saves **images/receipts** to storage, and does **not** send workflow email, does **not** write calendar/sheet except when guest dev toggles explicitly request it; **no** guest-submit GAF/pet PDF (**Q3.1** — PDFs on admin transition only).
- Admin with allow-listed email can sign in; others are rejected with a clear message.
- `/bookings` lists bookings with search/filter/sort/pagination (**Q5.2**: default **31** rows, sizes **31 | 50 | 100**). Default list behavior matches **Q5.1** (sort by check-in; hide stale **past `COMPLETED`** from the default slice; still show past dates when pipeline not finished, e.g. **`PENDING_SD_REFUND`**).
- Each transition on `/bookings/:id` fans out exactly the side effects described in `NEW_FLOW.md` and updates the Calendar color + title + the Sheet row — **including manual "force advance"** when cron/listener is late, **including admin “run Gmail poll” / “run SD cron” triggers** when automation is stuck (**Q6.6**), and **including the `READY_FOR_CHECKIN → PENDING_REVIEW` revert** when guest fields are edited after ready. Dev-control checkboxes still gate side effects on every save (**Q3.3**); dev controls are **admin-only** (**Q3.2**).
- Gmail listener transitions `PENDING_GAF` → next-state on Azure approval and persists the approved PDF; **ambiguous multi-match** does not pick a winner (**Q6.5**).
- Cron sends check-out email in the pre-check-out lead window and transitions `READY_FOR_CHECKIN` → `READY_FOR_CHECKOUT` when settlement is complete (Asia/Manila).
- Cancel from any state soft-cancels (keeps data), turns calendar event purple with summary **`CANCELED - …`** (no brackets), frees the dates.
- No `?testing=true`, `?dev=true`, or test-booking pipeline; non-prod `/form` checkbox panel uses FormData flags; hosted production forces full side effects.
- Running the backfill script on prod brings all existing bookings in sync with new titles/colors/columns.

---

## 8. Next step

- ✅ **Phase 4 shipped** — `gmail-listener` + `sd-refund-cron` (see §5). Gmail OAuth credentials already in `supabase/.env.local`. Enable scheduling in Supabase Cloud dashboard (`*/5 * * * *`).
- ✅ **Phase 5 shipped** — `submit-form` side-effect cleanup; test-booking pipeline removed (use staging/local Supabase).
- Refine **§6.2 Q7.4** (surprise-setup) when that field ships.
