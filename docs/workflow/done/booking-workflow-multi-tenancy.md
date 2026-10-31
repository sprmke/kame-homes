---
title: 'Booking workflow multi-tenancy: audit, design & backlog'
status: done
tags: [workflow, done, booking-workflow, multi-tenancy]
updated: 2026-09-02
stage: done
kind: plan
---

# Booking workflow multi-tenancy: audit, design & backlog

Back to [completed work](./README.md).

## Closed (2026-09-02)

**Scope closed:** multi-tenant booking workflow **configuration** — per-development document requirements, orchestrator/UI driven by that list, Resend inbound approvals per property (`approval-email-webhook`), Free/Paid automation paths ([`free-tier-manual-booking-workflow.md`](./free-tier-manual-booking-workflow.md)), Google Calendar/Sheets + Gmail API listener removed ([`remove-google-calendar-sheets.md`](./remove-google-calendar-sheets.md)).

**v1 implementation:** [`booking-workflow-configurable-docs.md`](./booking-workflow-configurable-docs.md) — done (2026-08-03). Document requirements editor: Super Admin → Developments; property override retired.

### Deferred (not blockers — track elsewhere if picked up)

| Item                                                                        | Notes                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Payment auto-settlement (`READY_FOR_CHECKIN → READY_FOR_CHECKOUT`)          | Blocked on payment-link/webhook product work (§5 #9)   |
| Retire client `workflow.ts` mirror                                          | Explicit v1 deferral (D3 / §5 #10)                     |
| Retire legacy top-level `PENDING_GAF` / `PENDING_PET_REQUEST`               | Low urgency; old rows only (§5 #11)                    |
| Parking request flow redesign                                               | Explicitly out of scope                                |
| Booking detail UX polish / automation-trigger audit / AI validation display | Scratchpad polish — separate from config multi-tenancy |

§1–§4 below remain as the **historical audit** (some claims superseded — e.g. `gmail-listener`, Calendar/Sheets). Prefer `.cursor/rules/booking-workflow.mdc` + route guides for current behavior.

> **2026-08-11 update:** Google Calendar / Sheets sync and the Gmail API listener were **removed** (see [`remove-google-calendar-sheets.md`](./remove-google-calendar-sheets.md)). Production GAF/pet approvals use Resend inbound (`approval-email-webhook`). Sections below that still describe CalendarService / SheetsService / `gmail-listener` are **historical audit notes**, not current behavior.

## Why this doc exists

Production today serves exactly one property — **Kame Home 2604** at **Azure North Residences** — and the booking status workflow, the booking detail page, and the booking edit form are all written with that single property's rules baked in: the same GAF (Azure gate-access-form) and pet-approval document steps, the same Gmail mailbox, the same calendar/email copy, for every booking, regardless of which org or property it belongs to.

The platform is now expanding to multiple tenants, properties, and residence/property types. This doc is the first pass at making the booking workflow **configurable per property/residence-type** instead of hardcoded to Azure North. There is no prior version of this doc — the codebase's own planning docs (`docs/archive/planning/NEW_FLOW_PLAN.md`, `NEW_FLOW.md`) and the canonical spec (`.cursor/rules/booking-workflow.mdc`) predate multi-tenancy and describe the single-tenant flow only. This doc does not replace `.cursor/rules/booking-workflow.mdc` — it documents the gap between that spec and a multi-property future, and proposes closing it.

**Explicitly out of scope for this round:**

- **Parking request flow** — `PENDING_PARKING_REQUEST` and the parking side of the workflow are called out below where relevant but not redesigned; the whole flow is TBD later, per direction from the product owner.
- **Gmail listener full redesign** — its single-mailbox limitation is documented and added to the backlog (§5) as one task with a proposed direction, not designed in full here.

## 1. Current state audit

### 1.1 Status enum & transition graph — global, not property-scoped

`supabase/functions/_shared/statusMachine.ts` is the single canonical source (mirrored manually in `ui/src/features/dashboard/bookings/lib/workflow.ts`, per `.cursor/rules/booking-workflow.mdc` §1). Today it is entirely **global**:

- `BOOKING_STATUSES` (`statusMachine.ts:17-29`) is one flat list for every booking in the system, including `PENDING_GAF` and `PENDING_PET_REQUEST` — labeled "legacy" in a comment but still fully wired into `TRANSITION_GRAPH` (`:140-152`) and `MANUAL_OVERRIDE_GRAPH` (`:167-185`). These aren't legacy in the sense of being retired — they're active nested sub-statuses under `PENDING_DOCUMENTS` for every booking today (see `.cursor/rules/booking-workflow.mdc` §2.1-2.2).
- `TRANSITION_GRAPH`, `MANUAL_OVERRIDE_GRAPH`, `STATUS_CALENDAR_META` (`:238-249`), and `STATUS_HUMAN_LABEL` (`:388-399`) are all plain `Record<BookingStatus, …>` objects with no `propertyId` or `residenceType` parameter anywhere in `canTransition()`, `availableTransitions()`, or any calendar/label helper. Every property gets the exact same graph and the exact same calendar colors/labels.
- The nested "Pending Documents" sub-steps are hardcoded to exactly three named concepts — GAF, parking, pet — in a fixed order. `buildPendingDocumentsCalendarSummaryPrefix()` (`:307-318`) and `getPendingDocumentsNestedCompletion()` (`:279-299`) branch explicitly on `gaf_completed_at` / `parking_completed_at` / `pet_completed_at` / `approved_gaf_pdf_url` / `approved_pet_pdf_url` — there is no generic "list of required document steps" to iterate over.

### 1.2 Orchestrator — side effects partially configurable, GAF/pet structurally mandatory

`supabase/functions/_shared/workflowOrchestrator.ts` (870 lines) is already **partially** multi-tenant:

- **Already configurable per property:** `propertyAutomationEnabled()` / `PropertyAutomationToggleKey` (imported `:33-36`, read from `app_settings.automation_toggles` via `propertyAutomationToggles.ts`) lets each property turn each outbound email on/off independently — `emailNewBookingRequest`, `emailGafRequest`, `emailBookingAcknowledgement`, `emailPetRequest`, `emailParkingBroadcast`, `emailReadyForCheckin`, `emailSdRefundCheckout` (`propertyAutomationToggles.ts:8-16`, all default `true`). A `DevControlFlags` mechanism (`:114-127`) additionally lets an admin or dev toggle Calendar, Sheets, and each email at call time for testing.
- **Structurally hardcoded:** the toggles above only gate _whether the email fires_ — they don't make GAF/pet _optional as a workflow concept_. `TransitionPayload` types `document_completion_target` to the literal union `'PENDING_GAF' | 'PENDING_PARKING_REQUEST' | 'PENDING_PET_REQUEST'` (`:54-108`), and PDF generation is unconditional in the `PENDING_REVIEW → PENDING_DOCUMENTS`-family transition: `generatePDF(fd, propertyId)` / `generatePetPDF(fd, propertyId)` (`:600, 606`) and the corresponding `sendEmail(...)` / `sendPetEmail(...)` calls (`:662, 691`) always run for that transition (subject to the on/off toggle, not to "does this property even have a GAF requirement"). There is no path for a property that has zero document requirements to skip `PENDING_DOCUMENTS` entirely — the parent status is always visited.
- **Calendar/Sheets sync is not property-optional at all.** `CalendarService.updateCalendarEventStatus()` (`:543`) and `SheetsService.updateSheetWorkflowStatus()` (`:566`) run for every transition unless the `DevControlFlags` (developer/testing override, not a per-property setting) disable them. A property that doesn't use Google Sheets, or doesn't want a shared calendar, has no way to opt out in production.

### 1.3 UI — independent hardcoded mirror, plus property-specific PDF modules

- `ui/src/features/dashboard/bookings/lib/workflow.ts` is a **manually-kept mirror** of `statusMachine.ts` (its own file header says so) and independently duplicates the same hardcoding: GAF/pet transitions, the fixed sub-status order (GAF → PARKING → PET), completion checks, and button copy like `'Mark as Complete - Pending GAF'` / `'Proceed to Pending Pet Request'`. Any future change to make the graph configurable has to be made in **two places** unless this mirror is retired in favor of a shared package or a server-fetched config.
- Dedicated GAF/pet PDF modules exist as their own files — `lib/gafDefaults.ts`, `lib/gafPdfPreview.ts`, `lib/gafPdfSignature.ts`, `lib/petDefaults.ts`, `lib/petPdfPreview.ts`, `lib/petPdfSignature.ts` — these are Azure-specific document flows, not instances of a generic "document requirement" abstraction.
- Azure/Kame Home-specific copy or sample data appears in `components/workflow-panel/WorkflowPendingDocStatusCard.tsx`, `lib/propertyTemplatePlaceholders.ts`, `lib/telegramPreviewSamples.ts`, and `lib/workflowDevControls.ts` — worth a pass at generalization time to confirm which are gating logic vs. preview/sample copy only.

### 1.4 Gmail listener — entirely single-property today

`supabase/functions/gmail-listener/index.ts` is not generalized at all:

- Line 4 (file header) and line 295: the mailbox is hardcoded — `kamehome.azurenorth@gmail.com` is the only inbox ever polled.
- Line 247: `const GAF_RE = /Monaco 2604 - GAF Request \(([^)]+?)\s+to\s+([^)]+?)\)/i;` — this matches exactly one tower/unit subject format. Any other property or unit naming convention would fall through to `subject_no_match` and be silently ignored (per the exploration audit, `:452`).
- Storage bucket names (`approved-gafs`, `approved-pet-forms`) and attachment-filename matching are GAF/pet-specific and non-configurable.
- There is no property-scoping in the matching/parsing path at all — the function assumes exactly one mailbox and one subject format for the entire platform.

### 1.5 Existing config surfaces to build on

Good news: multi-tenancy groundwork already exists that the new config can hang off of, so this isn't starting from zero:

- **`developments` table** (`supabase/migrations/20260719100000_developments.sql`) — generic schema: `slug`, `name`, `type` (`CONDOMINIUM | SUBDIVISION | MIXED_USE | TOWNHOUSE | COMMERCIAL`), and a `settings JSONB NOT NULL DEFAULT '{}'` column (`:3-18`). Today it has exactly one seeded row, `azure-north-residences`, whose `settings` JSONB currently holds only marketing content (images, amenities, towers, parking levels — `:46-73`). This is the natural home for a residence-type-level workflow config, since it already models "one config object per residence type" and is JSONB (no migration needed to add new keys).
- **`app_settings`** — already per-property (keyed by `property_id`), already carries GAF-specific _content_ fields (`gaf_unit_owner`, `gaf_tower_and_unit_number`, etc. from `20260710170000_app_settings_gaf_details.sql` and related migrations) and the `automation_toggles` JSONB consumed by `propertyAutomationToggles.ts`. This is the right home for property-level _overrides_ of a residence-type default, and for the automation on/off switches described in §1.2.
- **`properties.residence_name`** (from `20260629180000_multi_tenancy_foundation.sql`) is free text, not an enum tied to Azure — already generic.
- **`propertyAutomationToggles.ts`** is the best existing pattern to copy for _how_ new config should be shaped and consumed: a typed key list, a `DEFAULT_*` object, and a `merge*(raw: unknown)` function that safely merges partial JSONB against defaults (`:8-30, 32-40`). New config (document requirements, transition-graph overrides, sync toggles) should follow this same shape.

### 1.6 Transition automation matrix

| Transition                                                      | Trigger today                                                                                                                               | Automated?                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `PENDING_REVIEW → PENDING_DOCUMENTS` (or legacy `PENDING_GAF`)  | Admin action via `transition-booking`                                                                                                       | Manual only                         |
| `PENDING_DOCUMENTS` GAF/pet sub-step → complete                 | `gmail-listener` (Azure approval email) or `gmail-backfill-approvals`; also admin "Mark as Complete" override                               | **Both**                            |
| `PENDING_DOCUMENTS` (all sub-steps clear) `→ READY_FOR_CHECKIN` | Orchestrator auto-advances once the last sub-step clears (`workflowOrchestrator.ts:504-520`, recursive call), or admin manual force-advance | **Both**                            |
| `READY_FOR_CHECKIN → READY_FOR_CHECKOUT`                        | Admin enters guest balance settlement and confirms                                                                                          | Manual only                         |
| `READY_FOR_CHECKOUT → PENDING_SD_REFUND`                        | Guest submits the SD refund form (`submit-sd-form`), or admin manual override                                                               | Guest-triggered / manual — not cron |
| `PENDING_SD_REFUND → COMPLETED`                                 | `sd-refund-cron` (scheduled) or admin manual                                                                                                | **Both**                            |
| `* → CANCELLED`                                                 | Admin action (`cancel-booking`)                                                                                                             | Manual only                         |

All of the above funnel through the single chokepoint `WorkflowOrchestrator.transition()` (callers: `transition-booking`, `submit-sd-form`, `gmail-backfill-approvals`, `cancel-booking`, `sd-refund-cron`, `gmail-listener`) — this remains the one place to generalize, per the existing invariant in `.cursor/rules/booking-workflow.mdc` §6 ("Only `workflowOrchestrator.transition()` mutates `status`… never duplicate side-effect logic in callers").

## 2. Target design

### 2.1 Generic document-requirement model

Replace the fixed GAF/parking/pet trio with a **residence-type/property-declared list of document requirements**, each an instance of one generic shape rather than a hardcoded enum branch. Conceptually:

```
DocumentRequirement {
  id: string              // stable key, e.g. "gaf", "pet", or a new property's own key
  label: string            // human label, e.g. "GAF Request", "Pet Approval"
  order: number            // position within PENDING_DOCUMENTS sub-steps
  pdfTemplateId: string | null   // which PDF template to generate/attach, if any
  approvalSource: 'manual' | 'email-listener' | 'none'
  triggerCondition: 'always' | 'has_pets' | 'need_parking' | <future flags>
  calendarIcon: string | null    // e.g. "🐶" — optional, purely cosmetic
}
```

- Today's Azure North config becomes **one instance of this system**, not a parallel one: GAF (`triggerCondition: 'always'`, `approvalSource: 'email-listener'`), Pet (`triggerCondition: 'has_pets'`, `approvalSource: 'email-listener'`), Parking is intentionally left as-is / TBD per scope note above.
- `statusMachine.ts` stops hardcoding `gaf_completed_at`/`pet_completed_at`/`approved_*_pdf_url` field names in its logic and instead iterates the property's/residence-type's `documentRequirements[]` list, checking a generically-named completion marker per requirement (this likely still needs per-requirement DB columns or a JSONB completion map — see schema proposal below).
- A property with an **empty** `documentRequirements[]` list skips `PENDING_DOCUMENTS` entirely: `PENDING_REVIEW → READY_FOR_CHECKIN` (**decided**), with no GAF/pet email sends, no PDF generation, and no nested calendar prefix logic (ack + ready-for-check-in emails still apply when toggled on).
- `PENDING_GAF` / `PENDING_PET_REQUEST` as **standalone top-level statuses** (the "legacy nested" ones per `.cursor/rules/booking-workflow.mdc` §1) should be treated as an artifact of the original single-property rollout, not reproduced for new properties — new properties should only ever see the nested nested-under-`PENDING_DOCUMENTS` representation, never the flat legacy statuses.

### 2.2 Property/residence-type-scoped transition graph & calendar/label config

- `canTransition()` / `availableTransitions()` gain a config parameter (residence-type or property config) instead of reading module-level constants directly. The **shape** of the graph (statuses, allowed edges) stays the same for every property in v1 — what varies is **which document requirements exist** and therefore whether `PENDING_DOCUMENTS` has sub-steps at all. Do not over-engineer a fully custom per-property graph in this pass; the win is making the _document requirement list_ configurable, not re-deriving the whole state machine per property.
- `STATUS_CALENDAR_META` (colors, labels) can stay global — these are UI conventions, not business logic, and there's no clear signal yet that different properties want different calendar colors. Flag this as a "config later if needed" item rather than building it now (YAGNI).
- The nested calendar summary prefix (`buildPendingDocumentsCalendarSummaryPrefix`) becomes a loop over the property's `documentRequirements[]` instead of three hardcoded `if` branches.

### 2.3 Making Calendar/Sheets sync genuinely optional per property

Add two new property-level toggles alongside the existing `automation_toggles` shape (§1.2, §2.4): `syncCalendar: boolean` and `syncSheets: boolean` (default `true` to match today's behavior for the existing property). `workflowOrchestrator.ts` checks these before calling `CalendarService`/`SheetsService`, the same way it already checks `propertyAutomationEnabled()` before sending an email. This directly closes the "always-on, dev-flag-only" gap from §1.2.

### 2.4 Concrete schema proposal

Two places carry the new config, following the existing `developments`/`app_settings` split (residence-type default vs. property-level override) and the existing `propertyAutomationToggles.ts` pattern (typed keys, `DEFAULT_*`, safe merge function):

**`developments.settings` JSONB — residence-type default** (new key, additive, no migration needed since the column already exists and is JSONB):

```jsonc
{
  // ...existing marketing keys (images, amenities, etc.) unchanged...
  "workflowDefaults": {
    "documentRequirements": [
      {
        "id": "gaf",
        "label": "GAF Request",
        "order": 1,
        "approvalSource": "email-listener",
        "triggerCondition": "always",
      },
      {
        "id": "pet",
        "label": "Pet Approval",
        "order": 2,
        "approvalSource": "email-listener",
        "triggerCondition": "has_pets",
      },
    ],
  },
}
```

**`app_settings` — property-level override** (new columns, additive migration):

- `document_requirements_override JSONB NULL` — when set, replaces the residence-type default wholesale for this property (simpler than deep-merging arrays; a property either uses its residence-type's default document set or fully defines its own).
- `sync_calendar BOOLEAN NOT NULL DEFAULT true`
- `sync_sheets BOOLEAN NOT NULL DEFAULT true`

A new shared module `documentRequirements.ts` (sibling to `propertyAutomationToggles.ts`) would own: the `DocumentRequirement` type, `DEFAULT_DOCUMENT_REQUIREMENTS` (today's GAF+Pet, so the existing Azure North property's behavior is unchanged after migration), and a `resolveDocumentRequirements(propertyId)` function that reads `app_settings.document_requirements_override` if present, else falls back to the property's `developments.settings.workflowDefaults`, else the hardcoded default. This mirrors `mergePropertyAutomationToggles()`'s fallback shape (`propertyAutomationToggles.ts:32-40`).

**Per-requirement completion tracking:** rather than one DB column per document type (`gaf_completed_at`, `pet_completed_at`, …, which doesn't scale to arbitrary requirement lists), add a single `document_requirement_completions JSONB NOT NULL DEFAULT '{}'` column to `guest_submissions`, shaped `{ "gaf": { "completedAt": "...", "approvedPdfUrl": "..." }, "pet": {...} }`. Existing named columns (`gaf_completed_at`, `approved_gaf_pdf_url`, etc.) stay as-is for the existing Azure North rows during migration — a follow-up implementation plan should decide whether to backfill into the JSONB shape or keep named columns as a special case indefinitely (the latter is simpler short-term but reintroduces hardcoding; flagged as a decision point, not resolved here).

## 3. Section-by-section review — booking detail, edit, workflow

Reviewed with an eye to what changes once the workflow becomes property-configurable, and what should improve independent of multi-tenancy. Parking-related sections are explicitly skipped (TBD).

- **Workflow panel / stepper (`WorkflowPanel.tsx`, `PendingDocumentsSubTree`)** — currently renders exactly the GAF/parking/pet sub-steps by name. Needs to render `documentRequirements[]` generically (label + order + completion state) once §2.1 lands. Suggestion: while doing this, also surface _which_ approval source (manual vs. email-listener) is active per step, so admins understand why a step isn't auto-clearing for a given property.
- **Booking edit form (`BookingEditForm.tsx`)** — the "workflow-sensitive field" revert list (`.cursor/rules/booking-workflow.mdc` §2.3, `workflowSensitiveGuestDiff.ts`) includes Pet Details and Parking Details unconditionally. Once document requirements are conditional per property, this list should also be conditional — a property with no pet requirement shouldn't revert to `PENDING_REVIEW` on a pet-field edit that doesn't exist for it.
- **Guest document upload (`upload-booking-asset`)** — `assetType`s are currently a fixed enum (`payment_receipt | valid_id | pet_vaccination | pet_image`). If a future property's document requirement needs a different upload type, this enum needs to grow generically rather than per-property special-casing.
- **Admin dev controls (`workflowDevControls.ts`)** — currently exposes GAF/pet-specific email resend controls. Should become data-driven from `documentRequirements[]` so a new property's requirement automatically gets a resend control without new UI code.
- **Calendar/Sheets settings** — today there's no admin-facing UI toggle for "does this property sync to Calendar/Sheets" (§2.3 proposes the DB column; needs a settings-page checkbox to go with it).
- **PDF template management** — GAF/pet PDF templates are property-specific files under Storage bucket `templates` and `ui/public/templates` (per CLAUDE.md's noted sharp edge: two copies must be hand-synced). A generic document-requirement system should store `pdfTemplateId` pointing at a per-property template registry rather than assuming a fixed GAF/pet template pair exists for every property.

## 4. Automation opportunities

Going through the matrix in §1.6:

- **`PENDING_REVIEW → PENDING_DOCUMENTS`** — inherently needs a first human look (fraud/duplicate check, guest data sanity) for a new booking; not a good automation candidate without adding real risk. Leave manual.
- **Document sub-step completion** — already automated for GAF/pet via the Gmail listener where the approver replies by email; the manual "Mark as Complete" path exists purely as a fallback for when automation is late — this is by design, not a gap (`.cursor/rules/booking-workflow.mdc` §3, "Manual force advance"). No change needed beyond generalizing which requirements the listener watches (see gmail-listener backlog item).
- **`READY_FOR_CHECKIN → READY_FOR_CHECKOUT` (balance settlement)** — currently requires an admin to manually confirm the guest's paid amount matches the computed total balance. This is the best automation candidate in the matrix: if payment collection moves through a trackable channel (e.g. a payment-link/receipt-webhook integration), the settlement check itself (`paid === computed total`) is already a pure function today — it could trigger the transition automatically the moment a matching payment is recorded, with the manual path kept as fallback exactly like the GAF/pet pattern. This depends on a payment integration that doesn't exist yet — flag as a backlog item, not a same-doc design.
- **`READY_FOR_CHECKOUT → PENDING_SD_REFUND`** — guest-triggered via the SD form (already automatic from the guest's perspective; the guest, not an admin, causes this transition). No further automation needed.
- **`PENDING_SD_REFUND → COMPLETED`** — already cron-automated (`sd-refund-cron`) with manual override as fallback. No gap.
- **`* → CANCELLED`** — a booking cancellation is a business decision that should stay human-gated; not an automation candidate.

**Net conclusion:** most "manual-only" steps are either intentionally human-gated (review, cancel) or already automated with manual fallback by design (documents, SD refund). The one real automation gap is **balance settlement**, and it's blocked on a payment-tracking integration, not on workflow logic — captured as a backlog item below.

## 5. Task backlog

| #   | Task                                                                                                                                                                                                                                                                                            | Area                 | Notes                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Design & migrate the generic `DocumentRequirement` model (`documentRequirements.ts`, `developments.settings.workflowDefaults`, `app_settings.document_requirements_override`)                                                                                                                   | schema               | **Shipped (v1)** — [`booking-workflow-configurable-docs.md`](./booking-workflow-configurable-docs.md) Tasks 1–2. Override column deprecated; requirements live on development. |
| 2   | Add `document_requirement_completions` JSONB to `guest_submissions`; decide migration path for existing named columns (`gaf_completed_at`, etc.)                                                                                                                                                | schema               | **Decided: backfill** into JSONB; dual-read during cutover. **Shipped (v1)** Task 1.                                                                                           |
| 3   | Generalize `statusMachine.ts` nested-completion + calendar-prefix logic to iterate `documentRequirements[]` instead of GAF/parking/pet `if` branches                                                                                                                                            | orchestrator         | **Shipped (v1)** Task 3; client mirror kept in lockstep (audit task 10 deferred).                                                                                              |
| 4   | Generalize `workflowOrchestrator.ts`'s `PENDING_REVIEW → PENDING_DOCUMENTS` transition to loop over document requirements for PDF generation + email sends, gated by `approvalSource` and the existing `propertyAutomationToggles`; **D2:** empty list → `READY_FOR_CHECKIN`                    | orchestrator         | **Shipped (v1)** Task 4.                                                                                                                                                       |
| 5   | Add `sync_calendar` / `sync_sheets` property-level toggles and check them in the orchestrator before calling `CalendarService`/`SheetsService`                                                                                                                                                  | schema, orchestrator | **Shipped then removed** — Calendar/Sheets deleted ([`remove-google-calendar-sheets.md`](./remove-google-calendar-sheets.md)). Not pending.                                    |
| 6   | Add an admin settings UI for per-property document requirements, and Calendar/Sheets sync toggles                                                                                                                                                                                               | UI                   | **Requirements shipped** (Super Admin → Developments). Calendar/Sheets UI **removed** with Google sync.                                                                        |
| 7   | Update `WorkflowPanel`/`PendingDocumentsSubTree`, `workflowDevControls.ts`, and the workflow-sensitive-field revert list to be data-driven from `documentRequirements[]`                                                                                                                        | UI                   | **Shipped (v1)** Task 7. `workflowDevControls.ts` later replaced by Automation Triggers / free-tier manual sends.                                                              |
| 8   | Generalize `gmail-listener` beyond one mailbox and one subject regex — proposed direction: a per-property (or per-residence-type) config of `{ mailbox, subjectPattern, documentRequirementId }` rows, looked up per poll instead of the current hardcoded constants (`index.ts:4-5, 247, 295`) | gmail-listener       | **Superseded** — `gmail-listener` removed; production = `approval-email-webhook` + `approvals+{propertySlug}@…`.                                                               |
| 9   | Investigate a payment-tracking integration (payment link + webhook, or reconciled receipt upload) to automate `READY_FOR_CHECKIN → READY_FOR_CHECKOUT` balance settlement                                                                                                                       | automation           | **Deferred** — blocked on missing integration (module closed without this).                                                                                                    |
| 10  | Retire or replace the manually-kept client mirror (`ui/src/features/dashboard/bookings/lib/workflow.ts`) so status-machine changes don't require editing two files in lockstep                                                                                                                  | refactor             | **Deferred** — keep editing both files in lockstep (v1 D3).                                                                                                                    |
| 11  | Decide whether `PENDING_GAF`/`PENDING_PET_REQUEST` remain as legacy top-level statuses indefinitely (existing rows) while new properties never produce them, or whether a data migration retires them entirely                                                                                  | schema               | **Deferred** — low urgency.                                                                                                                                                    |

## Verification

- This doc's "current state" claims are traceable to the file:line references cited throughout §1 (verified against the live files as of 2026-08-02, not solely the earlier subagent audit).
- Nothing here contradicts `.cursor/rules/booking-workflow.mdc`'s stated invariants (transition graph, nested-status handling, orchestrator-only mutation rule) — §2 proposes extending that spec, not silently diverging from it. When this design moves to implementation, `.cursor/rules/booking-workflow.mdc` itself must be updated in the same change, per `documentation-maintenance.mdc`.
- Parking and Gmail-listener-full-redesign are intentionally left shallow per explicit scope direction — not omissions.
