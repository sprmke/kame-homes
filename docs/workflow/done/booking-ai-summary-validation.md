---
stage: done
title: 'Remove guest-submit AI validation + admin AI Summary & Validation panel'
status: planned
tags: [planning, planned-modules, ai, bookings]
updated: 2026-08-12
---

# Remove guest-submit AI validation + add admin "AI Summary & Validation" panel

## Context

Today, `submit-form` runs two non-blocking Gemini calls on every public guest submission (downpayment receipt check, valid-ID check) — the user wants this removed entirely from the public path. In its place, they want an **optional, admin-triggered** feature on the booking detail page: a sidebar button that kicks off an AI job producing short, plain-language summaries + flags across 5 sections (Stay Details, Guests, Parking, Pets, Pricing), with a real-time progress UI, shown alongside (not replacing) the existing manual "I reviewed everything" checkbox as an alternate way to unlock the PENDING_REVIEW workflow gate.

Research found the repo already has mature AI infra to build on: Gemini (+Groq fallback) via raw REST, per-document verdict/summary columns on `guest_submissions`, an existing admin-triggered backfill (`validate-booking-receipts`) and an `AiValidationPanel` that displays verdicts — this plan extends that infra rather than inventing a new provider layer. There is currently no vertical sidebar anywhere in the admin UI (only a horizontal tab bar) and no realtime/job-queue infra (only TanStack Query polling), so both are new patterns introduced here, modeled on existing precedents (`_shared/importBatchStatusMachine.ts` style status machine, `useInbox.ts`-style polling).

Key design decisions locked in (defaults chosen given no user pushback was available to confirm them — flagged for the user to redirect if wrong):

1. **Entry point**: new left vertical sidebar/rail on the booking detail page (matches literal ask), collapsing to an entry in the existing mobile action list below 768px.
2. **Progress**: a new `booking_ai_reviews` job-status table, updated section-by-section inside one synchronous edge function call; UI polls it via TanStack Query `refetchInterval` (no realtime channel — none exist in this codebase).
3. **Storage**: new dedicated `booking_ai_reviews` table for section-level narrative summaries + flags; existing per-document verdict columns on `guest_submissions` are reused/extended (not duplicated) for document-level checks.
4. **ID extraction**: the existing valid-ID check is upgraded to extract name/age/nationality and diff against typed guest data, extended to cover guest slots 2–5 (currently unpersisted), not just the primary guest.

Token-minimization is treated as a hard requirement, achieved primarily via **call batching** (3 Gemini calls total per full run instead of one-per-document) and reuse-on-rerun (skip AI calls when nothing relevant changed), not image compression (no image-resize lib is available in the Deno edge runtime today — flagged as a v1.1 follow-up, not blocking).

---

## Part A — Remove AI validation from `submit-form` (do first, small & independent)

In `supabase/functions/submit-form/index.ts`:

- Delete imports (lines ~15–23): `dbPatchForDocumentAiValidation`, `dbPatchForReceiptValidation`, `shouldPersistReceiptValidation`, `validateReceiptFile`, `validateValidIdFile`, `type AiUsageContext` from `../_shared/receiptValidationService.ts`; `resolveOrgIdForProperty` from `../_shared/aiUsageService.ts`.
- Delete `aiOrgId`/`aiUsage` locals (~line 232–233).
- Delete the "AI downpayment receipt check" block (~lines 235–260).
- Delete the "AI valid ID check" block (~lines 262–295, including the `validIdUploads` array and loop).
- Check whether `bookingSource`/`isAirbnbSource`/`paymentReceiptFile` locals become unused after deletion and remove if so.
- Leave `_shared/receiptValidationService.ts`, `_shared/aiGeminiKeys.ts`, `_shared/aiModelRouter.ts`, `_shared/aiUsageService.ts`, `validate-booking-receipts`, `upload-booking-asset` untouched — still used elsewhere and by Part B.

**Known consequence**: `workflowOrchestrator.ts`'s `receiptVerdictBlocksAdminTransition` guards (on `parking_receipt_ai_verdict`/`balance_receipt_ai_verdict`) will simply see `null` until an admin runs Part B or the existing `validate-booking-receipts`/`upload-booking-asset` paths — this only blocks on literal `'invalid'`, so `null` is safe by construction. Call this out in the PR description as an intentional behavior change, not a regression.

**Verify**: grep confirms no leftover references; local guest-form submission still saves/emails/Telegram-notifies correctly with `dp_receipt_ai_verdict`/`valid_id_ai_verdict` staying `null` post-submit.

---

## Part B — Admin "AI Summary & Validation" feature

### B0. Gemini call plan (token minimization)

| Section                   | AI call                                                                                                                                                         | Notes                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Stay Details              | **none** — pure SQL/date-math via `DatabaseService.checkOverlappingBookings`-style query + flag passthrough (`guest_requests_surprise_decor`, special requests) | clash check, early/late check-in/out vs adjacent bookings' actual times, cleaning-window duration |
| Guests                    | 1 batched vision call — all present guest ID images (slots 1–5) as multiple `inline_data` parts in one request                                                  | extracts name/age/nationality per ID, diffs vs typed fields, flags minors/non-Filipino/mismatches |
| Parking                   | **none** — reuses Pricing's extracted receipt amount, pure arithmetic against `parking_fee_included_in_downpayment`                                             |                                                                                                   |
| Pets (only if `has_pets`) | 1 batched vision call — pet image + vaccination doc together, `gemini-2.5-flash-lite`                                                                           | coarse classification                                                                             |
| Pricing                   | 1 vision call, extended to extract a numeric `amount` field so Parking can reuse it                                                                             | receipt genuineness + total-vs-required-downpayment check                                         |

Total: **3 Gemini calls per full run** (fewer than `validate-booking-receipts` already does today). Each section's inputs get a fingerprint (SHA-256 via `crypto.subtle.digest` over canonical JSON); reruns skip AI calls when the fingerprint is unchanged and copy forward the prior result with `reused: true`.

### B1. New migration `supabase/migrations/<next-timestamp>_booking_ai_reviews.sql`

- New table `booking_ai_reviews`: one row per booking (`booking_id UNIQUE`), `job_status` (`pending|processing|completed|failed`), five per-section `*_status` columns (`pending|processing|completed|failed|skipped`) and five `*_result JSONB` columns (`{summary, flags[], fingerprint, reused, updated_at}`), plus `flag_count`/`has_blocking_flag` rollups, `triggered_by`, timestamps. `ENABLE ROW LEVEL SECURITY` + `service_role`-only grant — consistent with this repo's real access control living in edge-function checks (`resolveScopedPropertyAccess`), not RLS. Index on `booking_id` and `property_id`.
- Extend `guest_submissions` with `guest2_valid_id_ai_verdict/_ai_summary` … `guest5_valid_id_ai_verdict/_ai_summary` (today only the primary guest's ID verdict is persisted).

### B2. `_shared/aiModelRouter.ts`

Add three new `AiFeature` entries: `booking_ai_summary_guests` (`gemini-2.5-flash`), `booking_ai_summary_pets` (`gemini-2.5-flash-lite`), `booking_ai_summary_pricing` (`gemini-2.5-flash`) — separate features (not one) so `ai_platform_usage_events` cost/usage reporting can break down by section, matching existing per-call-site granularity.

### B3. New `_shared/bookingAiReviewService.ts`

Section runner functions, following the existing `receiptValidationService.ts` conventions (hand-written JSON-instructed prompts, regex-extract-then-parse, manual normalization/clamping — no zod):

- `computeStayDetailsSection(booking, propertyId)` — no AI; reuses/extends `DatabaseService.checkOverlappingBookings` (add a lightweight adjacent-bookings query if its current signature doesn't fit) to find clashes and compute cleaning-window minutes; produces a terse templated (non-AI) sentence.
- `runGuestsSection(booking, usageContext)` — downloads present ID images via existing `parseStorageUrl` + storage `.download()`, one batched Gemini call returning a JSON array per guest slot (`verdict`, `extracted_name/age/nationality`, `mismatch_name/age`, `is_minor`, `non_filipino`, `summary`); persists per-slot verdict/summary to `guest_submissions` (slot 1 uses existing columns, slots 2–5 use the new B1 columns); writes section rollup to `booking_ai_reviews.guests_result`.
- `runPetsSection(booking, usageContext)` — skipped entirely when `!has_pets`; one batched call for pet image + vaccination doc.
- `runPricingSection(booking, usageContext)` — extends receipt validation with a new `extracted_amount` field (implemented as a new function here, not a mutation of the shared `receiptValidationService.ts` contract, to avoid touching `submit-form`/`upload-booking-asset` call sites); persists `dp_receipt_ai_verdict/_summary` if stale, writes `pricing_result` + (after this runs) `parking_result`.
- `computeSectionFingerprint(inputs)` and `buildBookingAiSummaryRollup(row)` helpers.
- Exported `AI_SUMMARY_STYLE_GUIDE` prompt-style block, interpolated into every AI prompt in this file, instructing: terse ops-note tone, ≤100 chars, no hedging ("It appears", "It seems", "I can see"), no AI self-reference, state facts directly (e.g. "Receipt shows ₱3,500 GCash transfer." not "It appears this may be valid."). This is the mechanism for the "not AI-sounding" requirement — treat as a prompt-engineering deliverable, not just UI copy.

### B4. New edge function `supabase/functions/booking-ai-review/index.ts`

`serveAuthenticated` + `resolveScopedPropertyAccess(req, 'bookings:edit')`, `POST { bookingId }` — same shape as `validate-booking-receipts`. Runs all applicable sections **synchronously in one invocation**, upserting the `booking_ai_reviews` row after each section completes (this is how "real progress" is achieved without streaming — the poller sees each upsert). Order of execution: Stay Details → Guests → Pricing → Parking (derived from Pricing) → Pets — note this differs from the UI's declared display order (Stay→Guests→Parking→Pets→Pricing); the UI only needs per-section status, not call order, so this is not user-visible. On error mid-run: mark `job_status='failed'`, preserve already-completed sections, still return HTTP 200 with the row (matches this repo's "AI failures are non-blocking, surface in payload" convention). Justification for staying synchronous/single-invocation: 3 sequential Gemini calls (~2–5s each) + a few storage downloads is well within typical edge function wall-clock limits and is fewer calls than `validate-booking-receipts` already makes today; if this proves too slow in practice, the documented fallback (not built in v1) is splitting into per-section endpoints — the schema already supports it.

New small edge function `supabase/functions/get-booking-ai-review/index.ts` for polling reads (same auth pattern).

### B5. Telegram — `_shared/telegramStaff.ts`

Add an optional second param to `buildBookingPlaceholders(booking, aiReview?)`, register `{{ai_stay_summary}}` → `aiReview?.stay_details_result?.summary?.trim() || 'Not yet reviewed'`. Fetch the `booking_ai_reviews` row at each of the ~3 call sites (single or batched select by `booking_id`). No cron/send mechanics change. Add the new placeholder to wherever the admin template-editor UI documents available tokens (grep for `dp_receipt_ai_verdict` in `ui/src/features/dashboard` to find it).

### B6. UI — new sidebar rail

New `ui/src/features/dashboard/bookings/components/booking-detail/BookingDetailSideNav.tsx`: a slim vertical rail added as a new flex sibling in `BookingDetailPage.tsx`'s layout (alongside the existing tabs+panels column and the sticky `WorkflowPanel` column — does not affect `WorkflowPanel`'s `lg:sticky`). Built as a generic `items: {id, icon, label, onClick, badge?}[]` list (only one item — "AI Summary" — in v1, but structured for future items). Badge sourced from `booking_ai_reviews.flag_count`/`has_blocking_flag`. Icon-only under `md`, full sidebar ≥`lg`. **Below 768px**: no vertical sidebar (touch-target/thumb-reach) — instead add "AI Summary" as an entry in the existing mobile action list (`buildBookingDetailActions`), reusing that pattern instead of inventing separate mobile chrome. Icon buttons ≥44×44px per this repo's mobile-responsive rules. Clicking the item opens `BookingAiSummaryPanel` as a modal (reuse existing dialog primitives from `BookingDetailAssetPreviewModal`).

### B7. UI — `BookingAiSummaryPanel` + hooks

- `hooks/useBookingAiReview.ts` — `useQuery` against `get-booking-ai-review`, `refetchInterval` active only while `job_status === 'processing'` (mirrors `useInbox.ts`'s conditional-polling pattern).
- `hooks/useBookingAiReviewTrigger.ts` — `useMutation` POSTing to `booking-ai-review`, modeled on `useReceiptAiBackfill.ts` but **explicitly user-triggered by a button**, not an auto-firing `useEffect`.
- `components/booking-detail/BookingAiSummaryPanel.tsx` — modal with: a 5-step progress stepper (Stay Details/Guests/Parking/Pets*/Pricing) reflecting polled per-section status; result cards per completed section with short summary text + severity-colored flag chips (reuse tone helpers from `WorkflowPendingReviewAck.tsx`); "Run AI Summary" / "Re-run" button; a "Mark as reviewed" action that calls the same `confirmReview()` used by the manual checkbox (see B8); empty state before first run.

### B8. Coexistence with the manual review checkbox

No changes needed to `usePendingReviewAck.ts` itself (`confirmReview()` stays a plain callback). In `WorkflowPendingReviewAck.tsx`, add a secondary, visually lighter option below the existing checkbox: "Or open AI Summary & Validation," opening `BookingAiSummaryPanel` (callback threaded down from `WorkflowPanel.tsx`, which already owns `confirmReview`). Clicking "Mark as reviewed" inside the AI panel calls the same `confirmReview()`, unlocking the same downstream actions bar the checkbox would. `requiredSubForm('PENDING_REVIEW', ...)` in `lib/workflow.ts` stays untouched — still fires afterward regardless of which ack path was used.

### B9. Relationship to existing `AiValidationPanel`/`DocumentsPanel`

Not superseded — they remain the durable, always-visible per-document verdict display; the new panel is the on-demand, narrative, cross-cutting summary. Extend `lib/bookingAiValidations.ts#collectBookingAiValidations` to also surface guest 2–5 ID verdicts once B1/B3 populate those columns, so the existing panels pick them up automatically.

### B10. File/performance scope note

A single booking has 3–8 documents, not hundreds — the "hundreds of files" requirement most likely refers to a different, unnamed surface (e.g. an admin document library), not this per-booking feature. This plan adds sane byte-size guards (skip/flag oversized files before sending to Gemini) but does not build a new bulk-file pipeline, since no such surface was named. Flag this to the user if they meant something more specific.

---

## Files to touch (in sequence)

**Part A:** `supabase/functions/submit-form/index.ts`

**Part B backend:**

1. `supabase/migrations/<next-timestamp>_booking_ai_reviews.sql`
2. `supabase/functions/_shared/aiModelRouter.ts`
3. `supabase/functions/_shared/bookingAiReviewService.ts` (new)
4. `supabase/functions/booking-ai-review/index.ts` (new)
5. `supabase/functions/get-booking-ai-review/index.ts` (new)
6. `supabase/functions/_shared/telegramStaff.ts`
7. `supabase/functions/_shared/databaseService.ts` (only if an adjacent-bookings helper is needed beyond `checkOverlappingBookings`)

**Part B UI:**

8. `ui/src/features/dashboard/bookings/lib/types.ts` — new `BookingRow` fields + a `BookingAiReview` type
9. `ui/src/features/dashboard/bookings/lib/bookingAiValidations.ts`
10. `ui/src/features/dashboard/bookings/hooks/useBookingAiReview.ts` (new)
11. `ui/src/features/dashboard/bookings/hooks/useBookingAiReviewTrigger.ts` (new)
12. `ui/src/features/dashboard/bookings/components/booking-detail/BookingDetailSideNav.tsx` (new)
13. `ui/src/features/dashboard/bookings/components/booking-detail/BookingAiSummaryPanel.tsx` (new)
14. `ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPendingReviewAck.tsx`
15. `ui/src/features/dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx`
16. `ui/src/features/dashboard/bookings/pages/BookingDetailPage.tsx`
17. `ui/src/features/dashboard/bookings/lib/bookingDetailActions.ts` (`buildBookingDetailActions`)
18. Telegram admin settings placeholder-picker UI (locate via grep for `dp_receipt_ai_verdict`)

## Critical files to reuse as templates

- `supabase/functions/_shared/receiptValidationService.ts` — prompt/JSON-parsing conventions
- `supabase/functions/validate-booking-receipts/index.ts` — edge function structure template
- `ui/src/features/dashboard/bookings/hooks/useReceiptAiBackfill.ts` — hook template (convert auto-trigger to user-triggered)
- `supabase/functions/_shared/importBatchStatusMachine.ts` — job-status-machine style reference

## Verification

1. Apply the new migration locally (`bun run db:migrate` after adding the file, per repo convention).
2. Ensure `GEMINI_API_KEYS`/`GROQ_API_KEY` are set in local edge secrets.
3. Part A: submit the public guest form locally with a receipt + valid ID; confirm `dp_receipt_ai_verdict`/`valid_id_ai_verdict` stay `null` post-submit; confirm no broken imports (`lint`/`type-check`); confirm email/Telegram notify still fire.
4. Part B: seed 2–3 bookings on the same property with staggered/adjacent dates and varied documents (multi-guest IDs, pets, Airbnb source with no receipt). Manually `curl` `booking-ai-review` with an admin JWT; inspect the `booking_ai_reviews` row and updated `guest_submissions` columns via `mcp__supabase__execute_sql`.
5. Re-run the same endpoint immediately; confirm no new Gemini calls (check `ai_platform_usage_events` row count) and `reused: true` in the JSONB.
6. UI: open the booking detail page, click the new sidebar item, run the job, watch the stepper progress via polling, confirm result-card copy avoids hedging phrases. Use Playwright MCP to drive this.
7. Confirm both ack paths (manual checkbox vs "Mark as reviewed" in the AI panel) unlock the same actions bar.
8. Resize to 375px and confirm the sidebar collapses into the mobile action list with 44px touch targets.
9. Confirm `{{ai_stay_summary}}` resolves correctly (and falls back to `'Not yet reviewed'`) in a Telegram staff daily-summary test send.
10. Run `mcp__supabase__get_advisors` after the migration for RLS/index lint issues.
