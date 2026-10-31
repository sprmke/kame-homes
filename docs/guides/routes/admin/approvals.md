---
title: 'Super Admin Approvals — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-04
---

# Super Admin Approvals — operator guide

Route: `/admin/approvals`

> **Status:** Documented · filter bar extracted to the shared `SuperAdminApprovalsToolbar`. Queue
> loading + status/type/search predicates now live in `_shared/superAdminApprovalsQueue.ts`
> (`loadApprovalQueue`), which also powers `list-super-admin-approvals?organizationId=` for the
> org hub's Approvals section and `countPendingApprovals()` for the Overview attention queue.

## Progress overview

| Section                     | E2E save | Validation | Docs | Notes                                                                                     |
| --------------------------- | -------- | ---------- | ---- | ----------------------------------------------------------------------------------------- |
| Approvals queue             | Done     | Done       | Done | Host + listing verification; external reviews; Type filter; Succession                    |
| Org review dialog           | Done     | Done       | Done | Host docs only; read-only listing rollup                                                  |
| Listing verification dialog | Done     | Done       | Done | Approve / Request changes / Reject per listing tier                                       |
| External review dialog      | Done     | Done       | Done | Approve / Reject pending property external reviews; shows stay photos (no feedback pills) |
| Reported two-way reviews    | —        | Done       | Done | Type = Reviews also lists `review_reports`; uphold removes the review                     |

---

## Overview

Platform super-admins review **host verification** (org scope), **listing verification** (per property/parking), and **property external reviews** (Airbnb/Facebook screenshots).

- **Org rows:** organizations where host `baseStatus ≠ none` or `enhancedStatus ≠ none`.
- **Listing rows:** one row per property or parking where listing `baseStatus ≠ none` or `recommendedStatus ≠ none` (scope split — listing docs live on the listing, not the org).
- **Review rows:** flattened from `app_settings.external_reviews`, plus **reported** two-way reviews from `review_reports` (uphold removes the published review; reject keeps it).

Default filters: **Type** = All types, **Status** = In review.

**Consideration (Unit handoff Phase B):** when a sublessee / Auth Rep listing is in the post-contract grace window and the owner submitted **Request consideration** (note + date + proof file upload), the queue shows a **Consideration** badge. The review dialog offers **Grant** / **Deny** per property or parking leg (`decide-contract-consideration`). Grant is blocked if Phase A ACTIVE tower+unit peers exist. Daily lifecycle automation: **`contract-expiry-cron`** (see `supabase/snippets/contract-expiry-cron.sql`). **Manual E2E:** [`docs/guides/testing/contract-expiry-lifecycle-manual.md`](../../testing/contract-expiry-lifecycle-manual.md).

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`).

---

## Host-facing knowledge

The platform team uses this page to approve host identity documents, **request changes** (host can fix and resubmit), or **reject** (hard decline).

**Reject** closes dashboard access for that organization, emails the owner a formal notice, and asks them to start a **new application** with proper documents. **Request changes** keeps shell access but **forces a non-dismissible resubmit modal** on next login until the host uploads the requested documents.

**Common host questions**

- Q: Who reviews my onboarding documents?
  A: The Kame Homes platform team. You’ll see “In review” until they approve, request changes, or decline.
- Q: What if changes are requested?
  A: When you sign in you’ll see a **Changes requested** popup you can’t close. Fix or replace the docs listed, then tap **Resubmit**.
- Q: What if my verification was declined?
  A: You’ll see a **Verification declined** screen when you sign in. Start a **new application** with clear, complete documents. You’ll also receive an email with the decision.
- Q: Does approval unlock my dashboard?
  A: You can use the dashboard after onboarding while verification is pending or approved. Changes requested blocks the UI behind a required resubmit modal. A hard reject blocks access for that organization.

---

## Behavior / edge cases

- Desktop defaults to a table with a table/grid toggle (same control as Hosts, Developments, Support tickets). Phone/tablet layouts force the card grid — phone rows are dense (title + type badge; org/owner meta; kind · date + status on one line; succession/consideration badges stay on `sm+`).
- **Pagination:** standard admin-list pagination (same pattern as the bookings list) — `page`/`limit` persisted in the URL (`?page=`, `?limit=`), default page size 31 (`ADMIN_DEFAULT_PAGE_SIZE`). `GET list-super-admin-approvals` accepts `page`/`limit`/`type`/`status`/`search`, combines org + listing + review rows, filters, and paginates the combined queue, returning `{ approvals, total, page, limit }`. `AdminListPagination` renders once at the page level below whichever view (table or grid) is active, so page/limit state is shared and does not reset when only the view toggles. Type/Status/search filter state lives in the URL (`?type=`, `?status=`, `?search=`), and changing any of them resets to page 1.
  - **Server-side filtering approach (chosen over a full-table-fetch-then-slice):** the queue unions three heterogeneous sources (organizations, properties+parkings, `app_settings.external_reviews`) with different schemas and no shared sort key, so it can't be expressed as one PostgREST `.range()` call without a dedicated SQL view/RPC. Instead: **Type is pushed all the way down** — `type=reviews`/`listing_verification` skip the other two source queries entirely, and `type=property`/`parking` skip the listing + review queries and filter the org query with `.contains('host_modes', [...])`. **Status and search stay in-memory**, applied to the now much-smaller, type-narrowed row set before the final sort + `.slice()` pagination: statuses are derived from nested `settings` JSONB (listing verification also falls back to reading the _org's_ settings when a listing has no `listingAuthorization` block of its own — see `resolveListingAuthorization` — so a plain JSON-path DB predicate on the listing table would silently miss legacy-fallback rows), and search spans fields that aren't queryable columns on these tables (owner name/email come from the Supabase Auth Admin API, review text lives inside a JSONB array).
  - **Known scale limitation:** with `type=all` (the common case together with the default `status=pending`), the org/listing/review queries still each pull their full "submitted" row set from the DB before the in-memory status/search filter runs — there's no DB-level cap on that yet. This is fine at current org/property/parking counts, but if any of those tables grow into the thousands, revisit with a dedicated Postgres function that unions + filters + orders + paginates in one query (see `CREATE OR REPLACE FUNCTION` conventions in existing migrations) — flagged here as the follow-up, not implemented.
- Search filters org rows by organization name, owner name, and owner email; review rows by property name, organization name, review text, reviewer name, and source.
- **Type filter:** All types / Property / Parking / **Listing verification** / Reviews. Property and Parking filter **org** rows by `hostModes`. Listing verification shows listing-scoped rows only. Reviews shows external review rows only.
- Status filter: All / In review / Approved / Changes requested / Rejected. Default: In review. Review rows use pending / approved / rejected only (no changes-requested).
- Queue order: orgs with **Recommended in review** (`enhancedStatus === pending`) appear first; within each group, newest submit first (Tier 2 submit time when set, else Tier 1).
- Dialog title shows tier under review: **Verified** (Tier 1) or **Recommended** (Tier 2). When both tiers were submitted, a **Verified / Recommended** tab switcher shows both statuses; admins can review either tier independently (including Recommended while Verified is still pending).
- Org dialog documents are **host-only:** Tier 1 = Valid ID + Facebook Page screenshot; Tier 2 = selfie with ID, optional other-platform admin screenshot, optional Business permit / BIR. Listing ownership / Azure PMO docs are **not** shown here — they are reviewed on listing queue rows. A read-only **Listings** rollup at the bottom summarizes per-listing status (`list-org-listing-verifications`).
- Listing dialog: **Verified** (Tier 1) = rights, contract end when needed, and proof of ownership or authorization. Hosts upload that file in the listing modal, not onboarding. Go-live on listing Verified approve still does not require the file on the server (onboarding submits listing Verified as pending with rights only). **Recommended** (Tier 2) = additional proof + Azure PMO. Request-changes can flag proof on Verified and the other two files on Recommended. Property Tier 1 **Approve** with an ACTIVE tower+unit peer shows succession confirm (same handoff as before, now per listing).
- Rows with `hasActiveUnitConflict` show a **Succession** badge (listing property rows; legacy org rows when applicable).
- Each document has **Full view** (nested lightbox dialog) and **Open in new tab**. Images show inline thumbnails; PDFs show a first-page thumbnail (via pdf.js).
- Dialog loads signed preview URLs for stored verification assets (1-hour expiry) on the Supabase project origin.
- Pending actions (order): **Request changes**, **Reject**, **Approve**.
- **Approve** org Tier 1 runs immediately (no listing succession — that is per listing row).
- **Request changes** switches the same modal into a focused step (orange header): required **multi-select** reasons (document-quality checklist), optional documents to fix, optional additional notes, preview **Host will see**, then confirm — **Back** returns to review. Host keeps shell access; on next login a **non-dismissible Changes requested** modal (no X/Close) forces **Resubmit** before using the dashboard. Resubmit shows **Valid ID** and **Facebook Page screenshot** (stored as `baseChangesRequestedDocs`); other submitted docs are kept.
- **Reject** switches the same modal into a focused step (destructive header): required reason from a **5-option hard-decline dropdown** (fraud, identity mismatch, ownership, fraud history, duplicate/suspicious account), optional additional notes, **Host will see** preview — **Back** returns to review. Sets `baseRejectionKind: 'rejected'`, **emails the owner**, and **blocks** org/property/parking dashboard access. On next login the host sees `/verification-rejected` and may **Start a new application** (`/onboarding`). In-app resubmit is not allowed for hard reject.
- Notes/reason are stored in `baseRejectionReason` with `baseRejectionKind` (`changes` \| `rejected`).
- **Approve** / decide actions only when status is pending; otherwise show badge + Close (and any prior notes/reason).
- Host resubmit after **changes** (`submit-org-verification` `tier: 'base'`) sets status back to pending and clears the rejection reason/kind; the org reappears in the In review queue. Hard-rejected orgs cannot resubmit; owners may create a new organization.
- **External reviews:** one queue row per submitted review. Dialog shows property + org, source, reviewer, rating, review text with **0–3 guest photos**, and platform **Proof screenshot** under **Proof of guest's review**. **Approve** publishes review text + guest photos on the public property page (screenshot stays internal proof). **Reject** sets `rejected` (hidden from public; host sees Rejected badge + dashboard attention chip). Any host edit to an **approved** or **rejected** review (including proof/stay photo uploads on a saved review) resets **`moderationStatus` to `pending`**, bumps `createdAt`, and re-queues the row for super-admin review; approved content is hidden from the public listing while pending.

---

## API reference

| Function                           | Method | Auth                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list-super-admin-approvals`       | GET    | super admin JWT              | `?page=&limit=&type=&status=&search=` — unified queue: org + **listing_verification** + external review rows (`type` discriminator). `type` skips unneeded source queries and pushes `host_modes` down via `.contains()`; `status`/`search` filter in-memory on the type-narrowed set (see route guide for why). Primary data source for **`/admin/approvals`**. Returns `{ approvals, total, page, limit }`. |
| `list-org-listing-verifications`   | GET    | super admin or org owner     | `?orgId=` — read-only rollup for org dialog                                                                                                                                                                                                                                                                                                                                                                   |
| `get-listing-authorization-assets` | GET    | super admin or listing owner | `?listingKind=&listingId=` — listing authorization state + signed asset URLs                                                                                                                                                                                                                                                                                                                                  |
| `approve-listing-authorization`    | POST   | super admin JWT              | `{ listingKind, listingId }` — listing Tier 1 pending only; activates listing (+ property succession when needed)                                                                                                                                                                                                                                                                                             |
| `approve-listing-recommended`      | POST   | super admin JWT              | `{ listingKind, listingId }` — listing Tier 2 pending only                                                                                                                                                                                                                                                                                                                                                    |
| `reject-listing-authorization`     | POST   | super admin JWT              | `{ listingKind, listingId, tier: 'base' \| 'recommended', kind, reason }`                                                                                                                                                                                                                                                                                                                                     |
| `list-org-verifications`           | GET    | super admin JWT              | Org verifications only (legacy; same row shape without `type`).                                                                                                                                                                                                                                                                                                                                               |
| `moderate-external-review`         | POST   | super admin JWT              | `{ propertyId, reviewId, decision: 'approved' \| 'rejected' }` — pending review only. Updates `app_settings.external_reviews` JSONB.                                                                                                                                                                                                                                                                          |
| `get-external-review-assets`       | GET    | super admin JWT              | `?propertyId=&reviewId=` — signed/public screenshot URL + stay photo URLs for review dialog.                                                                                                                                                                                                                                                                                                                  |
| `get-org-verification-assets`      | GET    | super admin JWT or org owner | `?orgId=` — verification state + signed asset URLs (`azurePmoConfirmationUrl` for Tier 2 PMO doc; legacy `pmoEmailUrls` / `opsProofUrl` aliases)                                                                                                                                                                                                                                                              |
| `approve-org-verification`         | POST   | super admin JWT              | `{ orgId, tier: 'base' \| 'enhanced' }` — only when that tier is pending; clears rejection reason/kind for that tier                                                                                                                                                                                                                                                                                          |
| `reject-org-verification`          | POST   | super admin JWT              | `{ orgId, tier: 'base' \| 'enhanced', kind: 'changes' \| 'rejected', reason, changesRequestedDocs? }` — Tier 1 `changes` supports per-doc picker; Tier 2 `changes` is notes-only (host re-uploads all Recommended docs)                                                                                                                                                                                       |

Data lives in **`organizations.settings.verification`** JSONB (org tiers) and **`app_settings.external_reviews`** JSONB (property external reviews). No dedicated approvals table.

---

## Implementation map

| Concern               | Path                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page                  | `ui/src/features/dashboard/super-admin/pages/SuperAdminApprovalsPage.tsx`                                                                                                                              |
| Table / cards         | `ui/.../super-admin-approvals/SuperAdminApprovalsTable.tsx`, `SuperAdminApprovalsCardGrid.tsx`                                                                                                         |
| Org review dialog     | `ui/.../super-admin-approvals/SuperAdminApprovalReviewDialog.tsx`                                                                                                                                      |
| Listing review dialog | `ui/.../super-admin-approvals/SuperAdminListingVerificationDialog.tsx`                                                                                                                                 |
| Review dialog         | `ui/.../super-admin-approvals/SuperAdminExternalReviewDialog.tsx`                                                                                                                                      |
| Hooks / filters       | `ui/.../hooks/useApprovals.ts`, `lib/superAdminApprovalsFilters.ts`, `lib/listingApprovalReviewTier.ts`, `lib/listingRequestChangesMessage.ts`, `types/approval.ts`                                    |
| Edge (listing)        | `list-super-admin-approvals`, `list-org-listing-verifications`, `get-listing-authorization-assets`, `approve-listing-authorization`, `approve-listing-recommended`, `reject-listing-authorization`     |
| Shared (listing)      | `supabase/functions/_shared/superAdminListingVerifications.ts`, `_shared/listingAuthorization.ts`                                                                                                      |
| Host resubmit UI      | `GetVerifiedModal.tsx` + `HostVerificationChangesGate` in `AdminLayout`                                                                                                                                |
| Edge                  | `list-super-admin-approvals`, `moderate-external-review`, `get-external-review-assets`, `list-org-verifications`, `get-org-verification-assets`, `approve-org-verification`, `reject-org-verification` |
| Shared shape          | `supabase/functions/_shared/orgVerification.ts`, `_shared/propertyExternalReviews.ts` (+ UI mirrors)                                                                                                   |

---

## Testing

| Layer  | Path / spec                                                                                                                             | Manual                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change                                                                                 | —                                                           |
| E2E    | `ui/e2e/features/admin/adminApprovalsSmoke.spec.ts` (`@ci`) — queue shell + mocked pending row; `adminShellSmoke` for `/admin` overview | —                                                           |
| Manual | OTP step-up, approve/reject dialogs                                                                                                     | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Route index](../README.md)
- [Onboarding](../onboarding.md) — base verification submit + Get Verified
- [`docs/PROJECT.md`](../../PROJECT.md) — API inventory
- Plan: [[2026-07-31-host-approvals|Wire up SuperAdmin Approvals (host verification review)]]

---

## Pending / follow-ups

- [x] Tier 2 (`enhanced`) review UI on this page (approve/reject badge submissions).
- [x] External review moderation (approve/reject) on this page with Type = Reviews filter.
- [ ] Optional email/Telegram notify on approve/reject.
