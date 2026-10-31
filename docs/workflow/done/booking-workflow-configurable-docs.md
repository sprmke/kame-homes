---
title: 'Booking workflow configurable document requirements — Implementation Plan'
status: done
tags: [workflow, done, booking-workflow, multi-tenancy]
updated: 2026-08-03
stage: done
kind: plan
---

# Booking workflow configurable document requirements — Implementation Plan

> **Shipped delta (2026-08-03):** v1 tasks 1–8 complete. Post-ship refinements in the same module: document requirements editor moved to **Super Admin → Developments** (`developments.settings.workflowDefaults.documentRequirements`); property-level override UI and `app-settings` PATCH retired (`document_requirements_override` cleared via migration); property settings section renamed **Workflow sync** (Calendar/Sheets toggles only); transition modal hides/disables sync side effects when toggles off; approval source `"none"` removed; default label **GAF Approval** (not Request). Parking nested step remains hardcoded (v1 scope).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `PENDING_DOCUMENTS` sub-steps (today: GAF + pet, parking left as-is) driven by a per-property / residence-type `documentRequirements[]` list, with Calendar/Sheets sync optional per property — without changing Azure North / Kame Home 2604 behavior.

**Architecture:** Residence-type defaults live in `developments.settings.workflowDefaults`; property overrides + sync toggles live on `app_settings`. Completion state moves to `guest_submissions.document_requirement_completions` JSONB (named columns backfilled, then dual-read during cutover). Server `documentRequirements.ts` + generalized `statusMachine` / `workflowOrchestrator`; client mirror `workflow.ts` kept in lockstep for v1. Admin settings + WorkflowPanel become data-driven (Impeccable Operate mode).

**Tech Stack:** Postgres migrations, Deno edge (`_shared/`), Vite React admin UI, existing `app-settings` / `transition-booking` endpoints.

**Parent audit/design:** [`booking-workflow-multi-tenancy.md`](./booking-workflow-multi-tenancy.md)

## Global Constraints

- Preserve today's Azure North GAF+Pet (+ parking TBD) behavior for the existing seeded property when no override is set.
- Empty `documentRequirements[]` → **skip `PENDING_DOCUMENTS`**: admin Proceed from `PENDING_REVIEW` goes straight to `READY_FOR_CHECKIN` (no GAF/pet PDF/email; still send booking acknowledgement + ready-for-check-in email when their toggles are on). Parking-only stays TBD — late parking at RFCI+ remains available.
- Parking nested step stays **hardcoded** for v1 (out of scope / TBD) — do not put parking into `documentRequirements[]` yet.
- Only `workflowOrchestrator.transition()` mutates workflow `status` (existing invariant).
- Keep client mirror `ui/.../bookings/lib/workflow.ts` in lockstep with `statusMachine.ts` for v1 — do **not** introduce a shared package or server-fetched graph (Task 10 deferred).
- No production Supabase deploy without user unlock word `kamewave`.
- UI: Operate mode, `minimal-ui-copy`, mobile 375+, Impeccable craft floor before shipping settings + WorkflowPanel UI.
- Docs: update `.cursor/rules/booking-workflow.mdc`, route guides, and `docs/PROJECT.md` / architecture docs in the same change as behavior.
- Repo has **no Vitest/Deno test suite yet** — verify with `bun run type-check`, local `db:migrate`, and manual/curl checks named per task.

## Locked decisions (do not re-litigate)

| #   | Decision                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Backfill named completion columns into `document_requirement_completions` JSONB; dual-read during cutover; writers update JSONB (+ keep named columns in sync for Azure until a later cleanup). |
| D2  | Empty requirements → `PENDING_REVIEW` Proceed transitions **directly to `READY_FOR_CHECKIN`** (skip `PENDING_DOCUMENTS`).                                                                       |
| D3  | Keep dual `statusMachine.ts` ↔ `workflow.ts` mirror for v1.                                                                                                                                     |
| D4  | Impeccable + frontend-design on property workflow settings UI **and** WorkflowPanel / stepper rewrite.                                                                                          |
| D5  | Out of scope this plan: Gmail listener multi-mailbox redesign, payment-settlement automation, retiring legacy top-level `PENDING_GAF` / `PENDING_PET_REQUEST` rows, parking redesign.           |

---

## File map

| File                                                                                              | Role                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261002120000_document_requirements_workflow.sql`                           | Schema: completions JSONB + backfill; `app_settings` override + sync columns; seed Azure `developments.settings.workflowDefaults` |
| `supabase/functions/_shared/documentRequirements.ts`                                              | Types, defaults, resolve/merge, trigger evaluation                                                                                |
| `supabase/functions/_shared/propertySyncToggles.ts`                                               | `sync_calendar` / `sync_sheets` resolve helpers                                                                                   |
| `supabase/functions/_shared/statusMachine.ts`                                                     | Iterate requirements for nested completion + calendar prefix; dual-read completions                                               |
| `supabase/functions/_shared/workflowOrchestrator.ts`                                              | PDF/email loop gated by requirements; sync toggles before Calendar/Sheets                                                         |
| `ui/src/features/dashboard/bookings/lib/workflow.ts`                                              | Manual mirror of statusMachine nested-completion changes                                                                          |
| `ui/src/features/dashboard/bookings/lib/documentRequirements.ts`                                  | Client types + helpers (mirror of server defaults for UI)                                                                         |
| `ui/src/features/dashboard/org/components/property-settings/PropertyWorkflowDocumentsSection.tsx` | Settings UI: requirements editor + Calendar/Sheets sync                                                                           |
| `ui/src/features/dashboard/bookings/components/booking-detail/primitives/BookingStepper.tsx`      | Data-driven nested sub-tree                                                                                                       |
| `ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx`                  | Data-driven mark-complete / approval-source hint                                                                                  |
| `ui/src/features/dashboard/bookings/lib/workflowSensitiveGuestDiff.ts`                            | Conditional pet (and future) sensitive fields from requirements                                                                   |
| Docs                                                                                              | `booking-workflow.mdc`, `docs/guides/routes/org/property/settings.md`, `bookings-detail.md`, architecture API notes               |

---

### Task 1: Schema migration + Azure seed + backfill

**Files:**

- Create: `supabase/migrations/20261002120000_document_requirements_workflow.sql`
- Modify: none (seed Azure development row via SQL `UPDATE`)

**Interfaces:**

- Produces DB columns:
  - `guest_submissions.document_requirement_completions JSONB NOT NULL DEFAULT '{}'`
  - `app_settings.document_requirements_override JSONB NULL`
  - `app_settings.sync_calendar BOOLEAN NOT NULL DEFAULT true`
  - `app_settings.sync_sheets BOOLEAN NOT NULL DEFAULT true`
- Completion JSON shape per requirement id:

```jsonc
{
  "gaf": {
    "completedAt": "2026-01-01T00:00:00.000Z", // or null
    "approvedPdfUrl": "https://...", // or null
    "manualIncomplete": false,
  },
  "pet": { "completedAt": null, "approvedPdfUrl": null, "manualIncomplete": false },
}
```

- [x] **Step 1: Write the migration**

```sql
-- document_requirements_workflow.sql

ALTER TABLE guest_submissions
  ADD COLUMN IF NOT EXISTS document_requirement_completions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS document_requirements_override jsonb NULL,
  ADD COLUMN IF NOT EXISTS sync_calendar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_sheets boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN guest_submissions.document_requirement_completions IS
  'Per documentRequirement id: { completedAt, approvedPdfUrl, manualIncomplete }';
COMMENT ON COLUMN app_settings.document_requirements_override IS
  'When set, replaces developments.settings.workflowDefaults.documentRequirements wholesale';
COMMENT ON COLUMN app_settings.sync_calendar IS
  'When false, workflowOrchestrator skips CalendarService updates';
COMMENT ON COLUMN app_settings.sync_sheets IS
  'When false, workflowOrchestrator skips SheetsService updates';

-- Backfill from named columns (Azure / existing rows)
UPDATE guest_submissions
SET document_requirement_completions = jsonb_strip_nulls(
  jsonb_build_object(
    'gaf', jsonb_build_object(
      'completedAt', to_jsonb(gaf_completed_at),
      'approvedPdfUrl', to_jsonb(approved_gaf_pdf_url),
      'manualIncomplete', to_jsonb(COALESCE(gaf_manual_incomplete, false))
    ),
    'pet', jsonb_build_object(
      'completedAt', to_jsonb(pet_completed_at),
      'approvedPdfUrl', to_jsonb(approved_pet_pdf_url),
      'manualIncomplete', to_jsonb(COALESCE(pet_manual_incomplete, false))
    )
  )
)
WHERE document_requirement_completions = '{}'::jsonb
  AND (
    gaf_completed_at IS NOT NULL
    OR approved_gaf_pdf_url IS NOT NULL
    OR pet_completed_at IS NOT NULL
    OR approved_pet_pdf_url IS NOT NULL
    OR COALESCE(gaf_manual_incomplete, false)
    OR COALESCE(pet_manual_incomplete, false)
  );

-- Seed Azure North residence-type defaults (slug from existing seed)
UPDATE developments
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{workflowDefaults}',
  '{
    "documentRequirements": [
      {
        "id": "gaf",
        "label": "GAF Request",
        "order": 1,
        "pdfTemplateId": "gaf",
        "approvalSource": "email-listener",
        "triggerCondition": "always",
        "calendarIcon": null
      },
      {
        "id": "pet",
        "label": "Pet Approval",
        "order": 2,
        "pdfTemplateId": "pet",
        "approvalSource": "email-listener",
        "triggerCondition": "has_pets",
        "calendarIcon": "🐶"
      }
    ]
  }'::jsonb,
  true
)
WHERE slug = 'azure-north-residences';
```

- [x] **Step 2: Apply locally and spot-check**

```bash
bun run db:migrate
```

Then in local SQL (Studio or `psql`):

```sql
SELECT id, document_requirement_completions
FROM guest_submissions
WHERE approved_gaf_pdf_url IS NOT NULL
LIMIT 3;

SELECT settings->'workflowDefaults' FROM developments WHERE slug = 'azure-north-residences';

SELECT sync_calendar, sync_sheets, document_requirements_override
FROM app_settings LIMIT 1;
```

Expected: completions object populated for rows with GAF/pet evidence; Azure development has `workflowDefaults.documentRequirements` length 2; sync columns default true.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20261002120000_document_requirements_workflow.sql
git commit -m "$(cat <<'EOF'
feat(db): add document requirement completions and property sync toggles

EOF
)"
```

---

### Task 2: `documentRequirements.ts` + `propertySyncToggles.ts` (edge shared)

**Files:**

- Create: `supabase/functions/_shared/documentRequirements.ts`
- Create: `supabase/functions/_shared/propertySyncToggles.ts`

**Interfaces:**

- Consumes: Supabase service client pattern from `propertyAutomationToggles.ts`
- Produces:

```ts
export type DocumentApprovalSource = 'manual' | 'email-listener' | 'none';
export type DocumentTriggerCondition = 'always' | 'has_pets' | 'need_parking';

export type DocumentRequirement = {
  id: string;
  label: string;
  order: number;
  pdfTemplateId: string | null;
  approvalSource: DocumentApprovalSource;
  triggerCondition: DocumentTriggerCondition;
  calendarIcon: string | null;
};

export type DocumentRequirementCompletion = {
  completedAt: string | null;
  approvedPdfUrl: string | null;
  manualIncomplete: boolean;
};

export const DEFAULT_DOCUMENT_REQUIREMENTS: DocumentRequirement[]; // gaf + pet as Azure today

export function parseDocumentRequirements(raw: unknown): DocumentRequirement[] | null;
export function mergeDocumentRequirements(raw: unknown): DocumentRequirement[]; // null → DEFAULT
export function requirementApplies(
  req: DocumentRequirement,
  booking: { has_pets?: unknown; need_parking?: unknown }
): boolean;
export async function resolveDocumentRequirements(
  propertyId: string
): Promise<DocumentRequirement[]>;

export type PropertySyncToggles = { syncCalendar: boolean; syncSheets: boolean };
export const DEFAULT_PROPERTY_SYNC_TOGGLES: PropertySyncToggles;
export async function resolvePropertySyncToggles(propertyId: string): Promise<PropertySyncToggles>;
```

Resolve order for requirements:

1. If `app_settings.document_requirements_override` is a non-null JSON array → use it (after parse/validate).
2. Else load property → development → `settings.workflowDefaults.documentRequirements`.
3. Else `DEFAULT_DOCUMENT_REQUIREMENTS`.

- [x] **Step 1: Implement both modules** (copy `mergePropertyAutomationToggles` / `createClient` load pattern from `propertyAutomationToggles.ts`). Validate each requirement object: require `id` (non-empty string), `label`, numeric `order`, `approvalSource` in union, `triggerCondition` in union; drop invalid entries; sort by `order`.

- [x] **Step 2: Sanity-check with a tiny Deno one-liner** (optional) or import from a throwaway local script — at minimum ensure `bun run type-check` still passes after Task 3 wires them (this task alone may not be type-checked by UI). Spot-check by temporary `console.log` in a local functions serve call if needed.

- [x] **Step 3: Commit**

```bash
git add supabase/functions/_shared/documentRequirements.ts supabase/functions/_shared/propertySyncToggles.ts
git commit -m "$(cat <<'EOF'
feat(edge): add documentRequirements and property sync toggle resolvers

EOF
)"
```

---

### Task 3: Generalize `statusMachine.ts` nested completion + calendar prefix

**Files:**

- Modify: `supabase/functions/_shared/statusMachine.ts`
- Modify: `ui/src/features/dashboard/bookings/lib/workflow.ts` (mirror — D3)

**Interfaces:**

- Consumes: `DocumentRequirement`, `requirementApplies`, completion map type from Task 2 (UI gets a parallel `documentRequirements.ts` types file — create thin client copy in this task or Task 5; for server-only helpers, pass requirements as an argument so statusMachine stays pure).
- Produces (signatures):

```ts
export type DocumentCompletionsMap = Record<string, DocumentRequirementCompletion>;

/** Dual-read: prefer JSONB map; fall back to named gaf/pet columns for safety. */
export function readDocumentCompletions(
  booking: PendingDocumentsCalendarBooking & {
    document_requirement_completions?: unknown;
  }
): DocumentCompletionsMap;

export function getPendingDocumentsNestedCompletion(
  booking: PendingDocumentsCalendarBooking & {
    document_requirement_completions?: unknown;
  },
  requirements: DocumentRequirement[]
): {
  needParking: boolean;
  hasPets: boolean;
  /** legacy booleans kept for parking + telegramAdmin callers during cutover */
  gafDone: boolean;
  parkingDone: boolean;
  petDone: boolean;
  /** new: per-requirement completion for applicable reqs only */
  byRequirementId: Record<string, boolean>;
  allConfigurableDocsDone: boolean;
};

export function buildPendingDocumentsCalendarSummaryPrefix(
  booking: ...,
  requirements: DocumentRequirement[]
): string;
```

Behavior rules:

1. For each applicable requirement (`requirementApplies`), done iff `!manualIncomplete && (!!completedAt || !!approvedPdfUrl)` from dual-read map (and for ids `gaf`/`pet`, also OR named-column legacy if JSONB empty).
2. Parking stays outside the list: same `parking_completed_at` rules as today; still contributes `PARKING` segment when `need_parking && !parkingDone`.
3. Calendar prefix segments: incomplete configurable reqs use `id.toUpperCase()` (e.g. `GAF`, `PET`) in `order`, then `PARKING` if needed — preserve today's `PENDING_GAF_PARKING_PET_DOCS` ordering for Azure (gaf order 1, pet order 2, parking inserted after gaf / before pet to match current GAF → PARKING → PET). **Exact order for Azure parity:** iterate requirements sorted by `order`; when inserting parking, keep current product order GAF → PARKING → PET (insert parking after `gaf` id or before first `has_pets` requirement — match existing `buildPendingDocumentsCalendarSummaryPrefix`).
4. Empty applicable configurable list (and parking not required, or parking deferred to RFCI+): calendar helpers are unused for the skip path — status is never `PENDING_DOCUMENTS`. If a row somehow sits on `PENDING_DOCUMENTS` with empty reqs, prefix falls back to `PENDING DOCUMENTS`.
5. Update all call sites of `getPendingDocumentsNestedCompletion` / `buildPendingDocumentsCalendarSummaryPrefix` / `resolveCalendarSummaryStatus` to pass requirements (orchestrator / telegramAdmin will resolve requirements once and pass through).

- [x] **Step 1: Implement server changes + fix compile errors in edge shared importers**

- [x] **Step 2: Mirror the same nested-completion / calendar-prefix logic in `workflow.ts`** (and add `ui/.../lib/documentRequirements.ts` with the same types + `DEFAULT_DOCUMENT_REQUIREMENTS` + `requirementApplies` — no async resolve yet; UI will receive resolved list from booking/settings payload in Task 5–6).

- [x] **Step 3: Verify**

```bash
bun run type-check
```

Expected: PASS (or only pre-existing unrelated errors).

- [x] **Step 4: Commit**

```bash
git add supabase/functions/_shared/statusMachine.ts \
  ui/src/features/dashboard/bookings/lib/workflow.ts \
  ui/src/features/dashboard/bookings/lib/documentRequirements.ts
git commit -m "$(cat <<'EOF'
feat(workflow): drive pending-docs completion from documentRequirements

EOF
)"
```

---

### Task 4: Orchestrator — requirement-gated PDF/email + sync toggles + JSONB writes

**Files:**

- Modify: `supabase/functions/_shared/workflowOrchestrator.ts`
- Modify: any helper that sets `gaf_completed_at` / `pet_completed_at` / manual incomplete flags so they also patch `document_requirement_completions`

**Interfaces:**

- Consumes: `resolveDocumentRequirements`, `resolvePropertySyncToggles`, generalized completion helpers
- `document_completion_target` / `document_completion_clear_target`: extend to accept requirement id string **or** keep legacy union and map `PENDING_GAF`→`gaf`, `PENDING_PET_REQUEST`→`pet`, `PENDING_PARKING_REQUEST`→parking special-case. Prefer accepting both during cutover:

```ts
document_completion_target?:
  | 'PENDING_GAF'
  | 'PENDING_PARKING_REQUEST'
  | 'PENDING_PET_REQUEST'
  | string; // requirement id e.g. "gaf"
```

Behavior:

1. Resolve requirements once at the start of a `PENDING_REVIEW` Proceed:
   - `const reqs = await resolveDocumentRequirements(propertyId)`
   - **Empty list (D2):** treat Proceed as `PENDING_REVIEW → READY_FOR_CHECKIN` (orchestrator may accept client `toStatus: 'PENDING_DOCUMENTS'` and rewrite, or UI sends `READY_FOR_CHECKIN` when resolved list is empty — pick one path and keep UI+server consistent; prefer **server rewrite** so old clients still work). Side effects: no GAF/pet PDF/email; send **acknowledgement** + **ready-for-check-in** when their automation toggles / dev flags allow; Calendar/Sheets use RFCI meta.
   - **Non-empty list:** existing `PENDING_REVIEW → PENDING_DOCUMENTS` (and legacy `PENDING_GAF`) path:
     - For each applicable req with `pdfTemplateId` and known generator (`gaf` → `generatePDF`, `pet` → `generatePetPDF`): run only if req present.
     - Emails: GAF/pet/ack/parking still gated by existing `propertyAutomationEnabled` keys; **additionally** skip GAF/pet email+PDF when that requirement id is absent from resolved list.
2. Before `CalendarService.updateCalendarEventStatus` / `SheetsService.updateSheetWorkflowStatus`: if `!(await resolvePropertySyncToggles(propertyId)).syncCalendar` skip calendar; same for sheets. DevControlFlags still can force-off; property toggle is an additional gate (`enabled = flag && propertyToggle`).
3. When marking GAF/pet complete or incomplete: update JSONB map **and** named columns for `gaf`/`pet` ids.
4. Auto-advance to `READY_FOR_CHECKIN` when `allConfigurableDocsDone && parkingDone` (same recursive path as today) for properties that did enter `PENDING_DOCUMENTS`.
5. Graph UX: when resolved requirements are empty, WorkflowPanel primary Proceed label/target should be Ready for Check-in (not Pending Documents).

- [x] **Step 1: Implement orchestrator changes**

- [x] **Step 2: Local smoke** (with `./dev.sh` or `bun run dev:api`):

```bash
# After admin JWT + a PENDING_REVIEW booking on Azure property:
curl -sS -X POST "$SUPABASE_URL/functions/v1/transition-booking" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"<id>","toStatus":"PENDING_DOCUMENTS"}'
```

Expected: Azure property still generates GAF (+ pet if pets) and emails per toggles.

Then set `document_requirements_override` to `[]` on a non-prod property (or local), Proceed again: no GAF/pet PDF/email; status becomes **`READY_FOR_CHECKIN`** (server rewrite from `PENDING_DOCUMENTS` if client still sends that).

- [x] **Step 3: Commit**

```bash
git add supabase/functions/_shared/workflowOrchestrator.ts
git commit -m "$(cat <<'EOF'
feat(orchestrator): gate docs side-effects and Calendar/Sheets by property config

EOF
)"
```

---

### Task 5: Expose resolved requirements + sync toggles via `app-settings` / booking payloads

**Files:**

- Modify: `supabase/functions/app-settings/index.ts` (GET/PATCH for override + sync columns)
- Modify: UI `useAppSettings` / `AppSettingsFormValues` types
- Modify: booking list/detail select lists so `document_requirement_completions` is returned
- Optionally: include `resolvedDocumentRequirements` on booking detail response if already assembled server-side; otherwise UI resolves from app-settings + defaults (prefer: PATCH/GET app-settings returns override; UI calls a small helper `resolveDocumentRequirementsClient(override, developmentDefaults)` — development defaults can be fetched via existing property→development join if present, else fall back to `DEFAULT_DOCUMENT_REQUIREMENTS`)

**Interfaces:**

- PATCH body adds:

```ts
{
  document_requirements_override?: DocumentRequirement[] | null; // null clears override
  sync_calendar?: boolean;
  sync_sheets?: boolean;
}
```

- [x] **Step 1: Wire edge `app-settings` read/write + UI form values**

- [x] **Step 2: Ensure booking queries select `document_requirement_completions`**

- [x] **Step 3: `bun run type-check`**

- [x] **Step 4: Commit**

```bash
git add supabase/functions/app-settings ui/src/features/dashboard/bookings/hooks/useAppSettings.ts \
  ui/src/features/dashboard/org/lib/propertyEmailAutomation.ts \
  # + any other touched settings/booking type files
git commit -m "$(cat <<'EOF'
feat(settings): expose document requirements override and sync toggles

EOF
)"
```

---

### Task 6: Property Settings UI — workflow documents + Calendar/Sheets sync (Impeccable)

**Files:**

- Create: `ui/src/features/dashboard/org/components/property-settings/PropertyWorkflowDocumentsSection.tsx`
- Modify: `PropertySettingsCard.tsx` / `PropertyOperationalSettingsSections.tsx` to mount section
- Modify: `propertySettingsCompletion.ts` / save planner if a new section id is required
- Modify: `docs/guides/routes/org/property/settings.md`

**Design (Operate mode — Impeccable):**

- Place section near **Email automations** / **Building Forms** (operational cluster).
- Controls: Sync Calendar, Sync Sheets toggles (same visual language as `PropertyEmailAutomationTogglePanel`).
- Document requirements: ordered list showing label, trigger, approval source; allow “Use residence-type default” (null override) vs “Custom list” (edit array). Empty custom list is valid (D2 — Proceed skips to Ready for Check-in).
- No marketing fluff; labels only. Mobile: single column, 44px toggles.

Before coding UI: run Impeccable `context.mjs` with `--target` this section path; load `reference/operate.md` + `craft-floor.md`.

Competitive UX: short brief vs Guesty/Hostaway “property document checklist” patterns — adopt ordered checklist + sync toggles; skip marketplace-style onboarding.

- [x] **Step 1: Competitive UX brief (3 bullets) in the PR/commit body or route guide Host Q&A**

- [x] **Step 2: Implement section + wire save**

- [x] **Step 3: Manual UI check at 375 / 768 / 1024**

- [x] **Step 4: Update settings route guide**

- [x] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ui): property settings for document requirements and sync toggles

EOF
)"
```

---

### Task 7: WorkflowPanel + BookingStepper data-driven nested docs (Impeccable)

**Files:**

- Modify: `ui/src/features/dashboard/bookings/components/booking-detail/primitives/BookingStepper.tsx` (`PendingDocumentsSubTree`)
- Modify: `ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx`
- Modify: `ui/src/features/dashboard/bookings/lib/workflowDevControls.ts` (resend controls from requirements)
- Modify: `ui/src/features/dashboard/bookings/lib/workflowSensitiveGuestDiff.ts` — only treat Pet Details as workflow-sensitive when resolved requirements include a `has_pets` trigger (or id `pet`); parking unchanged
- Modify: `docs/guides/routes/org/property/bookings-detail.md`
- Modify: `.cursor/rules/booking-workflow.mdc` (§ nested docs + config pointers)

**Behavior:**

- Nested tree renders `requirements.filter(requirementApplies).sort(order)` plus parking subtree when `need_parking` (unchanged).
- Each step shows completion state from JSONB dual-read; subtle approval-source hint (e.g. muted “Email” vs “Manual”) — one short word, not a paragraph.
- Empty requirements: primary Proceed goes to Ready for Check-in; Pending Documents step is skipped / not shown as the next action in the pipeline for that property.
- Mark complete / mark incomplete actions pass requirement id (and legacy enum for parking).

- [x] **Step 1: Implement stepper + panel + sensitive-diff gating**

- [x] **Step 2: Manual walkthrough on Azure booking (GAF+pet+parking) and on empty-override property**

- [x] **Step 3: Docs + booking-workflow.mdc update**

- [x] **Step 4: `bun run type-check && bun run lint`**

- [x] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ui): data-driven pending-documents stepper and workflow panel

EOF
)"
```

---

### Task 8: Docs sweep + parent audit cross-links

**Files:**

- Modify: `docs/workflow/in-progress/booking-workflow-multi-tenancy.md` — mark tasks 1–7 as planned-for-implementation via this plan; leave 8–11 backlog
- Modify: `docs/PROJECT.md` or architecture edge-functions/settings sections if columns/API surface documented there
- Modify: `docs/workflow/planned/README.md` (index row)

- [x] **Step 1: Update parent audit backlog table with links to this plan for items covered**

- [x] **Step 2: Confirm architecture docs mention new columns / resolve helpers**

- [x] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: link configurable-docs implementation plan and update workflow refs

EOF
)"
```

---

## Explicit non-goals (this plan)

- Gmail listener multi-mailbox / subject-pattern config (audit task 8)
- Payment-tracking auto settlement (audit task 9)
- Shared package / delete client mirror (audit task 10) — deferred; see D3
- Retiring legacy top-level `PENDING_GAF` / `PENDING_PET_REQUEST` statuses (audit task 11)
- Parking request flow redesign
- Fully custom per-property transition graphs (graph shape stays global)

## Verification plan (end-to-end)

1. Local migrate + Azure property: Proceed to Pending Documents still sends GAF (+ pet if pets); calendar prefix still `PENDING_GAF_…_DOCS`.
2. Property with `document_requirements_override = []`: Proceed → **`READY_FOR_CHECKIN`** (skips `PENDING_DOCUMENTS`); no GAF/pet PDF/email; acknowledgement + ready-for-check-in emails when toggles on; calendar uses Ready for Check-in meta.
3. `sync_calendar = false`: transitions update DB but Calendar event title/color unchanged.
4. `sync_sheets = false`: sheet status column unchanged.
5. Edit pet fields on a property with no pet requirement: no revert to `PENDING_REVIEW` from pet-only edits.
6. `bun run type-check`, `bun run lint`, `bun run build`.
7. Settings + booking detail usable at 375px.

## Graph note (D2)

Today `TRANSITION_GRAPH.PENDING_REVIEW` is only `PENDING_DOCUMENTS | CANCELLED`. For empty requirements:

- **Preferred:** orchestrator rewrites `toStatus` from `PENDING_DOCUMENTS` → `READY_FOR_CHECKIN` when resolved list is empty, **and** allow `PENDING_REVIEW → READY_FOR_CHECKIN` in the primary graph (or config-aware `canTransition`) so validation accepts it.
- Mirror the Proceed target in `workflow.ts` / WorkflowPanel when resolved requirements are empty.

## Open questions

_None — decisions D1–D5 locked with product owner 2026-08-02 (D2 revised: empty docs → `READY_FOR_CHECKIN`)._
