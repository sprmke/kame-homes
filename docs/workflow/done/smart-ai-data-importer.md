---
stage: done
title: 'Smart AI Data Importer — Implementation Plan'
status: done
tags: [planning, planned-modules, ai, import, onboarding, bookings]
updated: 2026-08-06
---

# Smart AI Data Importer — Implementation Plan

> **Task status (2026-08-06):** Tasks 1–7 complete. Wizard is live on property bookings (**Import** beside **New booking**). Preview fix-queue polish and commit review live under [`import-preview-fix-queue.md`](./import-preview-fix-queue.md). Intentional deltas vs original plan are listed under **Shipped variant** in Task 4 (Excel upload, combined Match step, no in-app history/revert UI). Future phases (Sheets live URL, Finance/Maintenance) remain separate.

## Context

Hosts onboarding onto GFM currently keep their existing bookings in ad-hoc Google Sheets/Excel/CSV files, each with a different column layout, naming, and structure per host. Today there is no way to bring that history into GFM except manual re-entry per booking — a real adoption blocker for hosts with months or years of history. The ask (`docs/workflow/intake/_to-plan.md`) is to let a host upload their existing file and have GFM auto-analyze it, auto-match obvious columns to our schema using AI, ask the host to manually resolve anything ambiguous via a field-mapping UI, preview the fully-mapped data, and let the host accept, correct, cancel, or revert the import — maximizing how much of their existing data can be imported with the least manual re-entry.

This is confirmed **greenfield**: a full-repo audit found no CSV/Excel parsing library, no bulk-write operations, no generic staging/draft table, and no soft-delete convention anywhere in the codebase. Nothing to extend — everything below is new. What _does_ exist and should be reused:

- The booking status-machine convention (`_shared/statusMachine.ts`, mirrored manually in `ui/.../bookings/lib/workflow.ts`) — model for a new `import_batches` lifecycle.
- The pending/approve-reject JSONB-status pattern from `docs/workflow/done/review-approval-workflow.md` — conceptual precedent for staging-then-committing host data.
- The per-feature Gemini/Groq AI-JSON pipeline in `_shared/receiptValidationService.ts` and `_shared/polishVoiceUtterance.ts` — template for the new column-mapping AI call (categorical `matched | likely_matched | ambiguous | unmatched` status, never a raw numeric confidence score the UI has to interpret — this repo's established convention per the inbox AI safety-guard pattern).
- The onboarding wizard's local `useState<Step>` shell (`OnboardingPage.tsx`) — no dedicated stepper component exists yet; follow this convention rather than introducing one.
- `finance_line_items`/`maintenance_items` migration conventions (RLS enabled, no policies, explicit service-role grants in the same migration) for the new staging tables.

**Decisions confirmed with the user during brainstorming:**

1. **Phase 1 scope**: Bookings (`guest_submissions`) import **with AI auto-mapping included from the start** — not a manual-only v1 followed by AI later. This is the larger, riskier first slice (parsing + AI + staging + commit + revert all together) but ships the actual "smart" differentiator immediately rather than a plain CSV importer.
2. **Commit atomicity**: per-row, partial success allowed. Each row insert is independent; the batch reports `{ inserted, skipped, failed }`. Re-running commit only retries rows without a `committed_row_id` yet. Chosen over a strict all-or-nothing transactional commit because this repo has no existing multi-row-transaction precedent to build on, and partial success is more legible to a host than an opaque full-batch rollback.
3. **Permission scope**: **org owner + admins by default, plus property-scoped team members who are explicitly granted the permission** — not open to all property members automatically. This needs a permission id at _both_ tiers: `org:import:manage` (`_shared/orgTeamPermissions.ts`, granted to `OWNER`/`ADMIN` by default) and `import:manage` (`_shared/propertyTeamPermissions.ts`, property-level id following the `<domain>:<action>` convention used there — e.g. `team:manage`, `inbox:manage` — **not** granted to any built-in role by default, so a property member only gets it if an owner/admin explicitly checks it for them).
4. **Entry point is a modal, not a page, and it's property-scoped** — a new "Import" button sits beside the existing "New booking" button on the bookings list (`ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx`), opening the wizard as a modal rather than navigating to a dedicated route. Because the button only exists on a specific property's bookings page (same `scope === 'org' ? undefined : (...)` gating the existing "New booking" `<Link>` already uses), **the target property is already known from route context at the moment the wizard opens** — this removes the need for a separate "which property does this row belong to" resolution step that a generic org-wide importer would otherwise require. See Phase 4 for the resulting simplified step list.
5. **New `IMPORTED` booking status**: every row this feature commits gets `status = 'IMPORTED'`, a new addition to the canonical status enum — not `PENDING_REVIEW` and not whatever status text a host's spreadsheet happens to contain. Historical bulk-loaded bookings should never silently join the live admin action queue (new-booking emails, "needs review" counts, SD-refund-due cron eligibility, etc.) just because they were backfilled from a spreadsheet. `IMPORTED` is reached only by direct insert from `import-commit` — never via `workflowOrchestrator.ts#transition()` — and its only forward edge is a manual admin override (see Phase 1e). This is a change to `.cursor/rules/booking-workflow.mdc`'s canonical enum, which per `CLAUDE.md`'s "docs are the source of truth" table must be updated in the same change.

Finance, Maintenance, XLSX, and Google Sheets read-import are explicitly **out of scope for this plan** — see "Future phases" at the end. Bookings-only, CSV-only, with AI mapping, is the full scope of what this plan implements.

---

## Task 1: Data model, storage, status machine, permissions, IMPORTED status

### Phase 1 — Data model + storage + status machine

### 1a. New migration: `supabase/migrations/<next-timestamp>_import_batches.sql`

(Check `supabase/migrations/` for the latest existing timestamp and use one after it.)

```sql
CREATE TABLE IF NOT EXISTS import_batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id        UUID NOT NULL REFERENCES properties(id),
  created_by         TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN (
                        'uploaded','mapping','mapped','previewing','previewed',
                        'committing','committed','reverting','reverted','failed'
                      )) DEFAULT 'uploaded',
  original_file_name TEXT,
  storage_path       TEXT,
  column_headers     JSONB,
  column_mapping     JSONB,
  row_count          INTEGER,
  error              TEXT,
  committed_at       TIMESTAMPTZ,
  reverted_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_batch_rows (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_index             INTEGER NOT NULL,
  raw_data              JSONB NOT NULL,
  mapped_data           JSONB,
  resolved_property_id  UUID REFERENCES properties(id),
  validation_status     TEXT NOT NULL CHECK (validation_status IN ('valid','error','skipped')) DEFAULT 'valid',
  validation_errors     JSONB,
  committed_row_id      UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_import_batch_rows_batch ON import_batch_rows (batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_org ON import_batches (organization_id, created_at DESC);

ALTER TABLE guest_submissions ADD COLUMN IF NOT EXISTS imported_from_batch_id UUID REFERENCES import_batches(id);
CREATE INDEX IF NOT EXISTS idx_guest_submissions_imported_batch
  ON guest_submissions (imported_from_batch_id) WHERE imported_from_batch_id IS NOT NULL;

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batch_rows ENABLE ROW LEVEL SECURITY;
-- No policies: service role via edge functions only.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batch_rows TO service_role;
```

No `parking_id`/parking XOR handling in this migration — parking-scoped bookings are out of scope for v1 (bookings import targets `properties` only; a booking whose only unit match is a parking slot is rejected at preview with a clear reason, revisited when Finance/Maintenance phases add parking support).

`property_id` is `NOT NULL` and set once at batch creation from the page's route context (see Context §4/Phase 4) — the wizard never needs to ask "which property" since it's always launched from that property's bookings page. `import_batch_rows.resolved_property_id` is kept, but only as an **informational cross-check**: if a host's file happens to include its own unit/property text column, normalization can compare it against the batch's fixed property and surface a non-blocking preview warning ("this row mentions Bali 1204, but you're importing into Monaco 2604 — continue anyway?") rather than driving the actual insert.

`raw_data`/`mapped_data` as JSONB (not typed columns) mirrors the `external_reviews[]` JSONB-staging-area precedent from `review-approval-workflow.md`, normalized into rows instead of an array for pagination/queryability at preview time.

### 1b. New storage bucket `import-uploads`

Via a second migration or the same file: `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) ...` following `20260821170000_property_media_bucket.sql`'s shape — **private** (not public like image buckets), `file_size_limit` ~15MB, `allowed_mime_types` = `text/csv` only for v1 (no Excel MIME types yet — XLSX is a future phase).

### 1c. `supabase/functions/_shared/importBatchStatusMachine.ts` (new)

Modeled directly on `_shared/statusMachine.ts`: exports `IMPORT_BATCH_STATUSES`, an explicit `TRANSITION_GRAPH` (`uploaded → mapping → mapped → previewing → previewed → committing → committed`, with `previewed`/`mapped`/`uploaded` all able to reach a terminal `failed`, and `committed → reverting → reverted`), and `isImportBatchStatus()`. Mirror manually in `ui/src/features/dashboard/import/lib/importBatchWorkflow.ts` — this repo's status machines are kept in sync by hand, not shared across the Deno/browser boundary.

### 1d. Permission wiring

- `_shared/orgTeamPermissions.ts`: add `'org:import:manage'` to `ORG_PERMISSION_IDS`; add it to `OWNER`'s (already `[...ORG_PERMISSION_IDS]`, automatic) and `ADMIN`'s explicit list in `ORG_ROLE_PERMISSIONS`.
- Mirror the new id in the UI constants file that parallels `orgTeamPermissions.ts` (org team permission list used by the invite/role UI).
- `_shared/propertyTeamPermissions.ts`: add `'import:manage'` to `TEAM_PERMISSION_IDS`, following the `<domain>:<action>` convention (`team:manage`, `inbox:manage`). Do **not** add it to any `BUILTIN_ROLE_PERMISSIONS` default (MANAGER/STAFF/VIEWER) — per the confirmed decision, property members only get it via explicit per-member grant, never by role default.
- Mirror in `ui/src/features/dashboard/team/lib/propertyTeamConstants.ts` (`TEAM_PERMISSIONS` array — id/name/description/category/icon) and `ROLE_PERMISSIONS`.
- Every new `import-*` edge function checks **either** org-level `org:import:manage` (owner/admin) **or** property-level `import:manage` for the resolved `property_id` — combine via the existing dual-scope resolution pattern already used by property-scoped edge functions that also accept org-level access (check `propertyScope.ts#verifyPropertyAccess` for how it already layers org owner/admin access on top of property-member permission checks — reuse that helper directly rather than writing new dual-scope logic).

### 1e. New booking status: `IMPORTED`

Canonical enum, transition graph, and calendar/label maps live in two manually-synced files — `supabase/functions/_shared/statusMachine.ts` (server) and `ui/src/features/dashboard/bookings/lib/workflow.ts` + `ui/src/features/dashboard/bookings/lib/bookingStatus.ts` (client) — per `.cursor/rules/booking-workflow.mdc`. This is a canonical-doc change, not an implementation detail to skip documenting.

- **New migration** `supabase/migrations/<next-timestamp>_add_imported_booking_status.sql`: widen the `guest_submissions.status` CHECK constraint to add `'IMPORTED'`, following the drop/re-add pattern in `supabase/migrations/20260502000000_widen_status_enum.sql` (read that file for the exact constraint name before writing this one — never edit a shipped migration).
- `statusMachine.ts`: add `'IMPORTED'` to `BOOKING_STATUSES`. `IMPORTED` gets **no entry as a target** in any other status's `TRANSITION_GRAPH`/`MANUAL_OVERRIDE_GRAPH` list — a booking only ever arrives at `IMPORTED` via `import-commit`'s direct insert (Phase 6), never through `workflowOrchestrator.ts#transition()`. Its own outgoing edges:
  - `TRANSITION_GRAPH.IMPORTED = []` — no automatic/pipeline progression.
  - `MANUAL_OVERRIDE_GRAPH.IMPORTED = ['CANCELLED', 'PENDING_REVIEW']` — `CANCELLED` is required for `import-revert` (Phase 6) to work through the existing status-machine mechanism rather than a special-cased bypass; `PENDING_REVIEW` gives an admin an explicit, deliberate way to pull a specific imported booking back into the live pipeline (e.g. it turns out to still need action) without touching the rest of the batch. Both are admin-manual-only (`ctx.manual === true`), matching how every other recovery edge in this graph already works.
  - `STATUS_CALENDAR_META.IMPORTED` — add an entry for type completeness (an unused Google Calendar `colorId`, e.g. `'8'`/Graphite — verify it's not already claimed) with label `'IMPORTED'`. In practice this map entry won't be exercised for most imported bookings, since `import-commit` skips calendar sync by default (Phase 6) — it only becomes relevant if an admin later manually overrides an imported booking into `PENDING_REVIEW` and calendar sync starts applying normally from there.
  - `STATUS_HUMAN_LABEL.IMPORTED = 'Imported'`.
- Client mirrors: same `TRANSITION_GRAPH`/`MANUAL_OVERRIDE_GRAPH` entries in `workflow.ts`, matching label in `bookingStatus.ts`, and a `TRANSITION_ACTION_LABEL` entry in `workflow.ts` for the manual-override button text (e.g. "Cancel" / "Move to Pending Review"). Exclude `IMPORTED` from `PIPELINE_ORDER` — it's not a pipeline stage, render it as an out-of-band badge the same way `CANCELLED` is handled today (verify exact treatment at implementation time).
- Bookings list status filter: add `IMPORTED` as a filterable option. Verify at implementation time that `IMPORTED` is excluded from whatever "needs attention" default-view logic and the SD-refund-due cron's eligibility query use to select active bookings — this is very likely an explicit status whitelist already (not derived from `TERMINAL_STATUSES`, which stays `{'COMPLETED', 'CANCELLED'}` unchanged — `IMPORTED` is deliberately **not** added to that set, since it needs to remain reachable via manual override, unlike true terminal states whose graphs both return `[]`).
- `.cursor/rules/booking-workflow.mdc`: add `IMPORTED` to the §1 canonical enum list with a note that it's reached only by direct import-insert (not the normal transition graph); add its manual-override-only edges to §2; add its calendar color row to §4; add a §5 "where do I edit this" pointer to the new `import-*` edge functions.

---

## Task 2: Upload & parse (CSV only)

### Phase 2 — Upload & parse (CSV only)

- Add `papaparse` — actually parsing happens **server-side** in the edge function (see below), so add it as a pinned `esm.sh` import in the new edge function, not as a UI dependency. Do not hand-roll a CSV parser — untrusted host-uploaded files need real quoted-field/encoding handling that `_shared/financeExport.ts`'s hand-rolled _export_ escaper was never designed for.
- New edge function **`import-parse-file`** (`serveAuthenticated`, POST, multipart): resolves org + property via the dual-scope check from 1d, uploads the raw file to `import-uploads/{orgId}/{batchId}/{filename}` (reuse `_shared/storageUpload.ts` conventions for the actual `upload` call), parses headers + all rows via `papaparse`, creates the `import_batches` row (`status='uploaded'`), inserts one `import_batch_rows` row per data row (`raw_data` only), and returns `{ batchId, headers, sampleRows (first 5), rowCount }`.
- Hard caps enforced server-side: **2,000 rows**, **15MB**. Reject with a clear message before parsing completes; surface both limits in the UI before upload starts.
- New frontend component `ImportFileDropzone.tsx` (new, not a prop-variant of `ImageUploadDropzone.tsx`/`DocumentUploadDropzone.tsx` — accept-type, preview, and post-upload behavior all differ meaningfully for a tabular file vs. a single image/doc) — drag-drop, calls `import-parse-file`, shows upload progress.
- Downloadable CSV template: generated **client-side** (no new edge function needed — it's a static export), pulling the host's existing properties via the already-existing `list-properties` endpoint so the template can include a reference list of exact unit labels to copy from, raising auto-match rate for property resolution in Phase 4/5.

---

## Task 3: AI column-mapping engine

### Phase 3 — AI column-mapping engine

- New `supabase/functions/_shared/importTargetSchemas.ts`: single source of truth for the canonical bookings field list offered as mapping targets — name, type, required/optional, short description per field (e.g. `"check_in_date: guest's arrival date"`). Explicitly **excludes** system-only columns: all `*_ai_verdict`/`*_ai_summary`, `*_completed_at`/`*_manual_incomplete`, `document_requirement_completions`, all `*_url` file columns, `stay_guide_token`, `next_stay_voucher_*`, `status_updated_at`/`settled_at`, **and now also `status`** — every imported row gets the new `IMPORTED` status unconditionally (Phase 1e), so a host's own status/booking-state column (if their file has one) is never offered as a mapping target and is never used to set the DB `status` column. Both the AI prompt and the manual-mapping dropdown (Phase 4) read from this one file so they can never drift apart.
- New `supabase/functions/_shared/importColumnMappingAi.ts`, following the `receiptValidationService.ts` + `polishVoiceUtterance.ts` template: `gemini-2.5-flash` primary via raw REST `generateContent` (no SDK), `GEMINI_API_KEYS` round-robin (`getGeminiApiKeys()`), Groq `meta-llama/llama-4-scout-17b-16e-instruct` fallback on `shouldTryNextProvider(status)` (429/403/5xx), `generationConfig.responseMimeType: 'application/json'`, `AbortController` ~15-20s timeout, and a **graceful degraded path when no API key is configured** — batch still reaches `mapped` status with every column `unmatched`, so the feature works with zero AI configured rather than hard-failing.
  - Request: column headers + up to 5 sample rows per column (not the full dataset — bounds token cost; the real ceiling on AI cost is header count, naturally bounded to ~60 spreadsheet columns) + the field list from `importTargetSchemas.ts`.
  - Response, one entry per raw header: `{ rawHeader, suggestedTarget: string | null, status: 'matched' | 'likely_matched' | 'ambiguous' | 'unmatched', reason }`. `suggestedTarget` is validated server-side against `importTargetSchemas.ts`'s field list — anything not on that list is coerced to `null`/`unmatched`. `status` is a fixed 4-value enum only, never a numeric confidence score, per this repo's established categorical-not-numeric AI-output convention.
- New edge function **`import-ai-map-columns`** (`serveAuthenticated`, POST, `{ batchId }`): loads headers + 5 sample rows per column from `import_batch_rows`, calls `importColumnMappingAi.ts`, writes the result to `import_batches.column_mapping`, transitions `uploaded → mapping → mapped`. Idempotent — re-callable if the host edits headers and wants AI to re-run.
- New `supabase/functions/_shared/importNormalization.ts`: free-text date → `MM-DD-YYYY` (bookings' text-date convention) via a lenient multi-format parser (add a Deno-side date library via `esm.sh`, e.g. `dayjs` or `date-fns` — do not hand-roll date parsing), light phone-number normalization (strip non-digits only, no strict E.164 — matches this repo not enforcing that elsewhere), and best-effort matching for `booking_source` (else pass through as free text since it isn't a strict DB enum). No `status` enum coercion — that column isn't offered as a mapping target at all (see above), so there's nothing to normalize.

---

## Task 4: Manual mapping & wizard UI (modal)

### Phase 4 — Manual mapping & wizard UI (modal, launched from Bookings)

Frontend module `ui/src/features/dashboard/import/` with the standard `components/ hooks/ lib/ pages/ routes/` split matching `finance/`/`maintenance/`.

**Entry point**: a new "Import" button added to `ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx`'s `bookingActions` toolbar block (lines ~351-369), right beside the existing "New booking" `<Link>`, using the same `.native-cta` sizing but a secondary/outline visual treatment so "New booking" stays the primary CTA. Also add a compact icon-only counterpart next to `heroNewBooking` (~line 375-383) for the mobile collapsing hero, following `MobileHeroActionLink`'s existing pattern. Both are gated by the same `scope === 'org' ? undefined : (...)` check already wrapping "New booking" — Import is property-scoped only, never shown at org scope, consistent with Phase 1d's permission model. Clicking it opens `ImportWizardModal.tsx` (new) built on `ui/src/components/ui/responsive-modal.tsx` (full-height sheet on mobile, dialog on desktop — matches this repo's mobile-responsive convention better than a plain `Dialog` for a multi-step flow), **not a route navigation**. Because the button only renders on a specific property's bookings page, `propertySlug`/`property_id` is already available from route context and is passed straight into the first `import-parse-file` call — no property-picker step in the wizard at all.

Wizard shell inside the modal: local `useState<Step>`, per the `OnboardingPage.tsx` convention (no shared stepper component exists — don't introduce one for this feature alone).

1. **Upload** — `ImportFileDropzone.tsx` (Phase 2), calls `import-parse-file` with the property already fixed.
2. **Match** — calls `import-ai-map-columns` and keeps automatic results plus manual review in one step. Preview-style clickable summary cards, ordered **Matched** / **Need input**, separate confirmed source → target pairs from unresolved mapping controls; Need input is auto-selected whenever it has items, otherwise Matched is selected. `ImportManualMappingRow.tsx` renders each `likely_matched`/`ambiguous`/`unmatched` raw column with 2-3 sample values and a canonical-field `<Select>`; Continue validates required targets and persists the complete mapping with one `import-save-mapping` request.
3. **Preview** — see Phase 5.
4. **Commit** — explicit confirm dialog inside the modal, calls `import-commit` (Phase 6), then closes and refreshes the bookings list so the newly imported rows appear immediately.

Every step keeps an explicit **Cancel** (deletes the batch + rows + storage object; only possible before `status='committed'`) that simply closes the modal.

New hooks (TanStack Query, mirroring `useFinanceLineItems.ts`'s shape): `useImportBatch.ts`, `useImportBatchRows.ts`, `useCommitImportBatch.ts`, `useRevertImportBatch.ts`.

**Shipped variant:** single four-step `ImportWizardModal` on the property bookings list (no route). Modal chrome lives in `components/ImportModalChrome.tsx`; Match combines automatic and manual column review in clickable summary cards rather than adding a conditional Columns step. Accepts **CSV and Excel** (`.csv`, `.xlsx`, `.xls`; Excel = first sheet). Google Sheets live URL import remains future work — hosts download as Excel/CSV. Past-import history UI was removed; edge endpoints `import-list-batches` / `import-revert` remain for potential future use. Preview step ships **error filters**, **bad-value display** (`validationErrors[].value`), and an in-app **Fix sheet** (`import-update-row` `fieldValues`) so hosts can correct flagged fields without re-uploading.

---

## Task 5: Preview & validation

### Phase 5 — Preview & validation

New edge function **`import-preview`** (`serveAuthenticated`, POST/GET, called whenever mapping changes): for each `import_batch_rows` row, apply `column_mapping` + `importNormalization.ts` to build `mapped_data`, set `resolved_property_id = import_batches.property_id` (always the fixed batch property, per Phase 4 — no per-row resolution), then validate: required-field presence (per `importTargetSchemas.ts`), enum validity, and import-specific checks (duplicate `row_index` — not cross-batch duplicate-booking detection, which is explicitly deferred, see Open Questions). If a raw unit/property-text column was mapped, compare it against the batch's fixed property and attach a **non-blocking** `validation_errors` entry of severity `warning` (not `error`) when they don't match — the row still commits, the host just gets a heads-up. Writes `validation_status`/`validation_errors` per row, batch → `previewed`.

Frontend `ImportPreviewTable.tsx`: shadcn `Table` (per `bookings-table`/`tanstack-table` skill conventions), paginated (50/page, TanStack Table pagination — never render 2,000 rows in one DOM tree), error rows visually flagged with inline reason, row-level "exclude this row" toggle, top summary ("48 of 50 rows valid, 2 need fixing") computed server-side by `import-preview`, not client-side.

---

## Task 6: Commit & revert

### Phase 6 — Commit & revert

New edge function **`import-commit`** (`serveAuthenticated`, POST, `{ batchId }`):

- Iterates `import_batch_rows` where `validation_status='valid'` and `committed_row_id IS NULL` (idempotent — safe to re-run after a partial failure).
- Inserts each into `guest_submissions` with `imported_from_batch_id = batch.id` set **and `status = 'IMPORTED'`** (Phase 1e) — never `PENDING_REVIEW`, never a value derived from any status text in the host's file (that column isn't even mapped, per Phase 3).
- **Must explicitly bypass side effects** — no "New Booking Request" emails, no calendar sync, no GAF PDF generation for guests who may have already checked out months ago. This is the single highest-risk correctness point in the whole feature: a bulk historical import must never spam past guests. Insert directly, do not route through the parts of `workflowOrchestrator.ts` that fire email/calendar/PDF side effects — the new `IMPORTED` status having no side-effect wiring anywhere in `workflowOrchestrator.ts` reinforces this at the data-model level, not just by convention in this function.
- Not a single DB transaction across all rows (no cheap multi-row-transaction primitive available to edge functions here). Each row is independent; batch ends `committed` with `{ inserted, skipped, failed: [{ rowIndex, reason }] }` (per the confirmed partial-success decision). Rows that fail at actual insert time (e.g. a DB constraint the preview validator didn't anticipate) are recorded in `validation_errors`, not rolled back.

New edge function **`import-revert`** (`serveAuthenticated`, POST, `{ batchId }`):

- Loads every `guest_submissions` row where `imported_from_batch_id = batchId`.
- Transitions each to `CANCELLED` via `statusMachine.ts`'s `IMPORTED → CANCELLED` **manual override** edge (Phase 1e) — passes `ctx.manual = true` since this is a deliberate system/admin action, not a normal pipeline click. Does **not** hard-delete, since an imported booking may already have been manually pulled into the live pipeline (`IMPORTED → PENDING_REVIEW`, Phase 1e) and edited before revert runs. `imported_from_batch_id` is left in place (not cleared) so a reverted-then-re-viewed booking is still traceable to its batch; "was this reverted" is answered by joining to `import_batches.status='reverted'`, no extra column needed.
- A row whose status is no longer `IMPORTED` at revert time (an admin already manually moved it into the pipeline) needs its own confirmation: surface it separately in the revert dialog as "already moved out of Imported — cancel anyway?" rather than silently including it.
- Batch → `reverted`.
- If a booking was manually edited after commit (`updated_at > batch.committed_at`), still revert it, but surface a "this row was modified since import" warning in the revert confirmation dialog before the host confirms.

---

## Task 7: Docs sync + verification

### Verification

1. `cd ui && bun run lint && bun run type-check && bun run build`.
2. Apply the migration locally (`bun run db:migrate`), confirm `import_batches`/`import_batch_rows` tables, RLS, grants, and the `guest_submissions.imported_from_batch_id` column all exist.
3. Click the new "Import" button beside "New booking" on a property's bookings page, upload a real multi-row CSV (mix of obviously-matchable headers like "Guest Name"/"Check In" and ambiguous ones) through the modal wizard: confirm AI auto-map correctly categorizes columns, manual mapping UI lets you resolve the rest, and confirm the batch's property is silently fixed to the page's property with no picker shown.
4. Preview: confirm row-level validation errors render correctly for a deliberately broken row (missing required field), and confirm a row whose own unit-text column disagrees with the fixed property shows as a non-blocking warning, not a hard error.
5. Commit: confirm rows land in `guest_submissions` with `imported_from_batch_id` set and **`status='IMPORTED'`** (not `PENDING_REVIEW`), and **confirm no email/calendar/PDF side effects fired** (check Resend/calendar logs — this is the critical regression to catch). Confirm the modal closes and the bookings list refreshes to show the new `Imported`-status rows.
6. Manual override: from a committed imported booking's detail page, confirm an admin can move it `IMPORTED → PENDING_REVIEW` or `IMPORTED → CANCELLED` and that both are gated as manual-only actions.
7. Revert: confirm all rows from that batch move to `CANCELLED` (including the "already moved out of Imported" confirmation path if one row was manually overridden first), batch shows `reverted` in the history page.
8. Test the zero-AI-configured path (temporarily unset `GEMINI_API_KEYS`/`GROQ_API_KEY` locally) — confirm the wizard still completes end-to-end via 100% manual mapping, no hard failure.
9. Test permission gating: an org member without `org:import:manage` and without a property-level `import:manage` grant should not see the Import button or be able to call any `import-*` endpoint; a property member explicitly granted `import:manage` should be able to import for that property only.
10. Confirm the bookings list status filter includes `Imported` as an option, and that imported rows do **not** appear in the dashboard's "needs attention" queue or get picked up by the SD-refund-due cron.
11. Use Playwright MCP for the browser-driven wizard steps.

### Critical files

- `supabase/functions/_shared/statusMachine.ts` — pattern for `importBatchStatusMachine.ts`, and where `IMPORTED` and its manual-override edges get added (Phase 1e).
- `ui/src/features/dashboard/bookings/lib/workflow.ts` and `ui/src/features/dashboard/bookings/lib/bookingStatus.ts` — client mirror of the status machine; must stay in sync with the `IMPORTED` additions above.
- `ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx` (lines ~351-383) — where the "New booking" button lives today (`bookingActions`/`heroNewBooking`) and where the new "Import" button/modal trigger gets added.
- `supabase/functions/_shared/receiptValidationService.ts` and `supabase/functions/_shared/polishVoiceUtterance.ts` — template for `importColumnMappingAi.ts`.
- `supabase/migrations/20260527120000_finance_line_items.sql` and `supabase/migrations/20260502000000_widen_status_enum.sql` — migration/RLS pattern for `import_batches`/`import_batch_rows`, and the CHECK-constraint-widening pattern for adding `IMPORTED`.
- `supabase/functions/_shared/orgTeamPermissions.ts`, `supabase/functions/_shared/propertyTeamPermissions.ts`, `supabase/functions/_shared/propertyScope.ts` — dual-scope permission wiring.
- `supabase/functions/_shared/workflowOrchestrator.ts` — reference for what side effects `import-commit` must explicitly bypass.
- `ui/src/components/ui/responsive-modal.tsx` — base component for `ImportWizardModal.tsx`.
- `ui/src/features/dashboard/finance/` (whole folder) and `ui/src/features/dashboard/org/pages/OnboardingPage.tsx` — feature-folder layout and wizard-step pattern to follow for `ui/src/features/dashboard/import/`.
- `.cursor/rules/booking-workflow.mdc` — canonical status doc; must be updated in the same change per `CLAUDE.md`'s "docs are the source of truth" table.

---

## Open questions / risks (flagged, not blocking Phase 1 start)

1. **Duplicate-detection** for re-imports (same booking uploaded twice): no dedup in this plan. Flag a heuristic check (`guest_email` + `check_in_date` + resolved property, surfaced as a preview-time warning, not a hard block) as an explicit fast-follow.
2. **Mid-batch re-upload**: if a host re-uploads a corrected file for an already-`mapped`/`previewed` batch, this plan always creates a **new** batch rather than replacing rows in place (simpler, avoids partial-state confusion); the old batch auto-cancels on supersession. Needs product sign-off since it affects the wizard's "Back" behavior.

---

## Future phases (separate plans, not built here)

- **XLSX support** — add `xlsx`/SheetJS (verify current licensing/distribution terms first), extend `import-parse-file` to handle `.xlsx`/`.xls`.
- **Finance & Maintenance import** — extend `import_batches.target_table`/the schema/normalization/commit logic to `finance_line_items` and `maintenance_items` (adds a hard-delete revert path for those tables, since they have no downstream side effects unlike bookings).
- **Google Sheets read integration** — `sheetsService.ts#readSheetValues` (values.get via existing `propertyGoogleApiAuth.ts` OAuth), "paste sheet link" upload variant reusing the same batch pipeline from Phase 3 onward.
