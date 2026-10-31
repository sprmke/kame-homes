---
stage: done
title: 'Wire up SuperAdmin Approvals (host verification review)'
status: done
tags: [planning, planned-modules]
updated: 2026-08-01
---

# Wire up SuperAdmin Approvals (host verification review)

> **Shipped delta (2026-07-31):** Soft **Request changes** vs hard **Reject**; forced owner-only resubmit modal; `baseChangesRequestedDocs`; hard-reject email + `/verification-rejected`; `create-organization` allows a new app after hard reject. The “out of scope” notes below are historical plan constraints, not current product truth.

## Context

New host accounts complete a 3-step `/onboarding` flow that submits org + property/parking details plus verification documents. This writes `organizations.settings.verification.baseStatus = 'pending'` (Tier 1, "required to host") via the `submit-org-verification` edge function, but **nothing currently reviews it** — the onboarding flow drops the host straight into their dashboard with no gate, and `/admin/approvals` (`SuperAdminApprovalsPage`) is a hard-coded empty-state stub with no backing query, edge function, or data model (confirmed in `docs/guides/routes/admin/approvals.md`, which explicitly lists "define the data source" and "wire up list/detail/approve/reject" as open follow-ups).

We're now making `/admin/approvals` a real queue: super-admins need to see orgs with `baseStatus = 'pending'`, view their submitted documents, and approve or reject them. This plan only wires up **Tier 1 (host) verification** review — Tier 2 ("Verified" badge, `enhancedStatus`) already has no review UI either, but is out of scope here since the ask is specifically about accepting/approving new Host registrations.

Verification state lives entirely in `organizations.settings` JSONB (`OrgVerificationState` — `supabase/functions/_shared/orgVerification.ts`), not a dedicated table, so the read path is a JSONB scan via a new list edge function, and writes are single-column `settings` JSONB updates guarded by the existing status enum (`'none' | 'pending' | 'approved' | 'rejected'`).

## Data model — no migration needed

Reuse the existing `OrgVerificationState` shape (`_shared/orgVerification.ts` / `ui/src/features/dashboard/org/lib/orgVerification.ts`, mirrored in `ui/.../org/lib/orgVerificationTiers.ts`). No new table — extend the JSONB shape with one new field: `baseRejectionReason: string | null` (and `enhancedRejectionReason` for symmetry, unused for now) alongside the existing `baseStatus`/`baseSubmittedAt`. Add it to `OrgVerificationState`, `emptyOrgVerificationState()`, `readOrgVerificationFromSettings()`, and `orgVerificationToSettingsValue()` in `_shared/orgVerification.ts`, and mirror the same edit in the client copy `ui/src/features/dashboard/org/lib/orgVerification.ts` (and `orgVerificationTiers.ts`'s `OrgVerificationDetail`/`readOrgVerificationDetail` if it doesn't already pass through unknown fields).

**Resubmission (host side)** — a rejected host must be able to fix and resend docs, not hit a dead end. Good news: `submit-org-verification` (`supabase/functions/submit-org-verification/index.ts:141-149`) already permits resubmitting the base tier any time `baseStatus !== 'approved'` — a `'rejected'` org can call it again with no backend change needed there beyond one addition: when it sets `baseStatus: 'pending'` on resubmit, also clear `baseRejectionReason: null` (stale reason shouldn't survive a new submission) — same for the enhanced branch/`enhancedRejectionReason` for consistency.

The actual gap is **frontend**: `GetVerifiedModal.tsx`'s `HostTierSummary` (lines 110-185) only renders a read-only checklist + a static "Contact support to resubmit onboarding documents" line for `rejectedNote` — there's no editable form for tier 1, unlike tier 2 which already has a full upload-and-resubmit flow inline in the modal (lines 359-402). Build the equivalent for tier 1:

- When `detail.baseStatus === 'rejected'`, replace the static note with `detail.baseRejectionReason` (if present) plus a resubmit form, reusing the same field set as onboarding step 3 (`OnboardingPage.tsx`, `step === 3` block ~lines 938-1074): `OnboardingHostVerificationSection` (valid ID), `OnboardingHostAccessVerificationSection` / inline `SocialPlatformSelect` + relationship `Select` + contract-end-date input for property, `OnboardingParkingVerificationSection` for parking — scoped by the org's `host_modes`, same as onboarding does.
- Local state in `GetVerifiedModal` mirrors the existing `selfie`/`ownership`/`pmo1`/`pmo2` slot pattern (lines 195-199) for the base-tier assets (`validId`, `socialProof`, `propertyOwnershipProof`, `parkingSocialProof`) plus form fields (platform, relationship, contract end dates), pre-filled from `detail` on open.
- Submit uploads changed files via the existing `uploadVerificationAsset` helper (lines 78-104), then calls `submit-org-verification` with `tier: 'base'` and the full field payload — same shape `OnboardingPage.tsx` already sends. On success, invalidate `ORGANIZATIONS_QUERY_KEY` and close/collapse back to the read-only checklist.
- This is the largest single piece of new UI in this plan — budget for it accordingly; everything else is closer to "wire existing pieces together."

## Edge functions (new, all `serveAuthenticated` + `verifySuperAdminJwt`, following `list-hosts`/`create-development` conventions)

1. **`list-org-verifications`** (GET) — `supabase/functions/list-org-verifications/index.ts`
   - `verifySuperAdminJwt(req)`, `createServiceClient()`.
   - `SELECT id, name, slug, owner_id, host_modes, settings, created_at FROM organizations` (no dedicated index needed at current scale — same pattern as `list-hosts` doing a full scan).
   - For each row, `readOrgVerificationFromSettings(row.settings)`; keep only rows where `baseStatus !== 'none'` (queue = anything submitted, not just pending, so approved/rejected stay visible for history/filtering — table UI defaults to filtering `pending` first, mirroring `SuperAdminHostsToolbar`'s search-filter pattern).
   - Join owner profile via `loadAuthUserProfile` (`_shared/authUserProfile.ts`, already used by `hostSerialize.ts`) for `ownerName`/`ownerEmail`.
   - Return `{ approvals: OrgApprovalSummary[] }` — one row per org, not per tier, with `baseStatus`, `baseSubmittedAt`, `hostModes`, org name/slug, owner name/email.

2. **`get-org-verification-assets`** (GET, `?orgId=`) — `supabase/functions/get-org-verification-assets/index.ts`
   - `verifySuperAdminJwt(req)`; loads the org, re-signs every non-null asset path in `settings.verification.assets` via `supabase.storage.from(ORG_VERIFICATION_BUCKET).createSignedUrl(path, 3600)` (same bucket/expiry as `upload-org-verification-asset`).
   - Needed because signed URLs are only returned at upload time today — the review UI has no other way to preview stored docs.
   - Return `{ organization, verification: OrgVerificationState, assetUrls: Record<assetKey, string | null> }`.

3. **`approve-org-verification`** (POST `{ orgId, tier: 'base' }`) and **`reject-org-verification`** (POST `{ orgId, tier: 'base', reason: string }`) — `supabase/functions/approve-org-verification/index.ts`, `supabase/functions/reject-org-verification/index.ts`
   - `verifySuperAdminJwt(req)`; load org, `readOrgVerificationFromSettings`, guard `baseStatus === 'pending'` (400 otherwise — no-op on already-decided rows), set `baseStatus` to `'approved'`/`'rejected'`.
   - `reject-org-verification` requires a non-empty `reason` (400 if missing/blank) and sets `baseRejectionReason = reason`; `approve-org-verification` clears `baseRejectionReason` to `null` (covers re-review after a prior rejection).
   - Write back via `orgVerificationToSettingsValue` merged into `settings`, `UPDATE organizations SET settings = ... WHERE id = orgId`.
   - Keep `tier` param even though only `'base'` is used today, so `'enhanced'` can be added later without a new endpoint shape — mirrors `submit-org-verification`'s existing `tier` param.
   - Return `{ organization }` (updated row) for the mutation to patch the query cache, same as `useUpdateDevelopment`.

Register all four in `supabase/config.toml` if per-function JWT policy entries are required there (check existing entries for `list-hosts`/`create-development` as the template).

## Frontend

**Types** — `ui/src/features/dashboard/super-admin/types/approval.ts` (new, mirrors `types/host.ts`): `OrgApprovalSummary` matching the list endpoint shape.

**Hooks** — `ui/src/features/dashboard/super-admin/hooks/useApprovals.ts` (new, mirrors `useDevelopments.ts`):

- `useApprovals()` → `useQuery(['super-admin','approvals'], () => callEdgeFunction('list-org-verifications'))`.
- `useOrgVerificationAssets(orgId)` → `useQuery(['super-admin','approval-assets', orgId], ...)`, `enabled: Boolean(orgId)` (lazy, only fetched when a review panel opens).
- `useApproveOrgVerification()` → `useMutation` calling `approve-org-verification`, payload `{ orgId, tier: 'base' }`.
- `useRejectOrgVerification()` → `useMutation` calling `reject-org-verification`, payload `{ orgId, tier: 'base', reason }`.
- Both `onSuccess` invalidate `['super-admin','approvals']`.

**Filter/lib** — `ui/src/features/dashboard/super-admin/lib/superAdminApprovalsFilters.ts` (new, mirrors `superAdminHostsFilters.ts`): search by org/owner name+email, status filter defaulting to `pending`.

**Table** — replace the stub `ui/src/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalsTable.tsx` with a real `AdminDataTable` (same primitives as `SuperAdminHostsTable.tsx`): columns for org name, owner, hosting mode (property/parking/both), submitted date, status badge (reuse `VerificationStatusBadge` from `ui/.../org/components/verification/VerificationStatusBadge.tsx`), row click opens a review panel/dialog rather than navigating away (approvals aren't a drill-down entity like hosts).

**Review dialog** — new `SuperAdminApprovalReviewDialog.tsx` in the same folder: fetches `useOrgVerificationAssets(orgId)`, renders submitted fields (relationship/rights, platform, contract end date) and document thumbnails/links using the signed `assetUrls`, reuses `VerificationChecklist` styling patterns from `GetVerifiedModal.tsx` for the "what was submitted" layout, with **Approve** / **Reject** actions wired to the two mutations (disable both once `baseStatus !== 'pending'`, show the decided badge instead). Reject opens an inline reason `Textarea` (required, submit disabled until non-empty) rather than a plain confirm — this is the one piece of new form UI in the feature.

**Page** — update `SuperAdminApprovalsPage.tsx` to follow the `SuperAdminHostsPage.tsx` shape: loading skeleton, `useApprovals()`, wire the existing (currently `disabled`) search `Input` to the new filter lib, keep `SuperAdminListViewToggle` only if a grid view is worth building — otherwise simplify to table-only (grid adds no value for a review queue; flag this as a possible scope cut when implementing, default to keeping table+toggle for consistency with the Hosts page unless it's clearly unnecessary work).

**Docs** — per `.cursor/rules/documentation-maintenance.mdc`, update `docs/guides/routes/admin/approvals.md` to reflect the real data source, API reference table (new edge functions), and remove the "Pending / follow-ups" checklist items once implemented.

## Explicitly out of scope

- No new dashboard-access gate based on `baseStatus` (confirmed with the user) — today hosts get full dashboard access immediately after onboarding regardless of verification state, and this plan doesn't change that behavior.
- No Tier 2 (`enhanced`/"Verified" badge) review UI or resubmission — separate CTA/flow (`GetVerifiedModal`'s existing tier-2 form), not part of "accepting new Host registrations." Tier 1 resubmission is in scope (see above); tier 2 keeps its current behavior untouched.
- No email/notification to hosts on approve/reject — nothing in the existing verification flow sends transactional email for status changes; adding one would be a scope expansion beyond "wire up the approvals page." The in-app rejection reason (shown in `GetVerifiedModal` when the host returns to resubmit) covers the "why" without needing a new notification channel.

## Verification

- `bun run type-check` / `lint` / `build`.
- Local Supabase: seed an org with `submit-org-verification` (`baseStatus: 'pending'`) via the real onboarding flow, then confirm it appears in `/admin/approvals`, documents preview via signed URLs, and Approve/Reject correctly flips `baseStatus` and disables further action — drive this with the Playwright MCP as a super-admin session, per the `verify` skill.
- Reject a submission with a reason, then sign in as that host and confirm `GetVerifiedModal` shows the reason and lets them edit/re-upload docs and resubmit; confirm the org reappears in `/admin/approvals` as `pending` with `baseRejectionReason` cleared.
- Confirm `verifySuperAdminJwt` truly blocks non-super-admin callers on all four new edge functions (curl with a non-super-admin JWT → expect 403).
