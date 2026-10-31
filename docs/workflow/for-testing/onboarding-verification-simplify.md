---
stage: for-testing
title: 'Onboarding verification simplify'
status: for-testing
tags: [workflow, for-testing, onboarding, verification]
updated: 2026-09-01
---

# Onboarding verification simplify

> **Stage:** [`for-testing`](./README.md) — implementation complete. Remaining: manual verification (§ Verify below). Move to [`../done/`](../done/) after checklist passes.

**Goal:** Step 2 collects Property Rights (Parking Rights when parking-only) from existing `ORG_VERIFICATION_RIGHTS`; Step 3 requires **Valid ID + Facebook Page screenshot** only. Listing **Verified** collects proof of ownership or authorization. Listing **Recommended** collects additional proof + Azure PMO. None of those listing files are on onboarding. Listing go-live stays on listing base approve (rights-only submit from onboarding). Listing Recommended **submit** still waits for listing Verified approve + plan.

**Spec:** [`onboarding-verification-simplify-design.md`](./onboarding-verification-simplify-design.md)

**Architecture:** Polish in place on `/onboarding`, `GetVerifiedModal`, `ListingVerificationModal`, and the shared `canSubmit*` helpers. Host vs listing scopes stay split. No new tables.

**Constraints:** No new role ids. Do not delete existing Recommended documents. Host base is not plan-gated; Recommended stays gated. Minimal UI copy. Update route guides in the same change.

## File map

| Area                  | Paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding UI         | [`OnboardingPage.tsx`](../../../ui/src/features/dashboard/org/pages/OnboardingPage.tsx), [`OnboardingVerificationRightsFields.tsx`](../../../ui/src/features/dashboard/org/components/onboarding/OnboardingVerificationRightsFields.tsx), [`OnboardingHostVerificationSection.tsx`](../../../ui/src/features/dashboard/org/components/onboarding/OnboardingHostVerificationSection.tsx)                                                                                   |
| Host rules + modal    | [`supabase/functions/_shared/orgVerification.ts`](../../../supabase/functions/_shared/orgVerification.ts), [`GetVerifiedModal.tsx`](../../../ui/src/features/dashboard/org/components/verification/GetVerifiedModal.tsx), [`orgVerificationTiers.ts`](../../../ui/src/features/dashboard/org/lib/orgVerificationTiers.ts)                                                                                                                                                 |
| Listing rules + modal | [`supabase/functions/_shared/listingAuthorization.ts`](../../../supabase/functions/_shared/listingAuthorization.ts), [`submit-listing-authorization`](../../../supabase/functions/submit-listing-authorization/index.ts), [`ListingVerificationModal.tsx`](../../../ui/src/features/dashboard/org/components/listing-authorization/ListingVerificationModal.tsx), [`listingVerificationTiers.ts`](../../../ui/src/features/dashboard/org/lib/listingVerificationTiers.ts) |
| Plan gate             | [`submit-org-verification`](../../../supabase/functions/submit-org-verification/index.ts)                                                                                                                                                                                                                                                                                                                                                                                 |
| Admin review          | Super-admin host/listing verification dialogs under `ui/src/features/dashboard/super-admin/`                                                                                                                                                                                                                                                                                                                                                                              |
| Docs                  | [`docs/guides/routes/onboarding.md`](../../guides/routes/onboarding.md), [`docs/guides/routes/admin/approvals.md`](../../guides/routes/admin/approvals.md), property/parking settings guides, [`host-verification-tiers.md`](./host-verification-tiers.md)                                                                                                                                                                                                                |

## Tasks

1. **Step 2 Property Rights** — Required select using `ORG_VERIFICATION_RIGHTS` inside the Property card (Parking Rights inside the Parking card when parking-only). One value for property and/or parking. Show contract end on Step 2 when the rights option needs it. Pass `contactRole` into `create-organization`. Continue to require hosting details unchanged.

2. **Step 3 Valid ID + Facebook Page** — Finish setup: upload `valid_id` and `social_proof`, `submit-org-verification` `{ tier: 'base' }`, `submit-listing-authorization` with relationship + contract end. Do **not** upload listing proof files or call `submit-listing-recommended` here.

3. **Host base / Recommended rules** — `canSubmitBaseVerification` = Valid ID + Facebook Page. `canSubmitEnhancedVerification` = selfie with ID. Facebook stays on onboarding / host Tier 1. Forced host changes-requested shows Valid ID + Facebook Page.

4. **Listing base / Recommended rules** — `canSubmitBaseListingAuthorization` = rights (+ contract end), no proof files (so Finish setup can succeed). Listing modal **Verified** collects `proof` (including while pending). Do **not** treat an absent proof file as **Missing** after onboarding — the upload field is the next step. `canSubmitRecommendedListingAuthorization` requires listing Verified approved plus `additional_proof` and `azure_pmo_confirmation`. **Renewal** still requires the primary proof file on listing Verified.

5. **Ungate host base** — Remove `verifiedBadgeEligible` from `submit-org-verification` `tier: 'base'` (and matching Get Verified base submit). Keep `recommendedBadgeEligible` on host enhanced and `submit-listing-recommended`.

6. **Super-admin queue** — Host base preview = Valid ID + Facebook Page. Host Recommended still includes Facebook Page. Listing Verified shows rights plus primary proof. Listing Recommended shows additional proof + Azure PMO.

7. **Docs** — Update onboarding save path and document tables; approvals; property/parking verification Q&A; host-verification-tiers document-set table.

## Verify

- New onboarding: Step 2 Property Rights / Parking Rights required; Step 3 Valid ID + Facebook Page screenshot only; Finish setup succeeds on Free.
- After Finish setup, listing **Verification** does not show proof of ownership as missing.
- `/admin/approvals`: approve host ID + Facebook Page + listing rights → listing `ACTIVE`. Listing Verified review shows proof of ownership when uploaded.
- Get Verified Recommended: selfie with ID required; other-platform admin screenshot and Business permit / BIR optional
- Listing Verification **Verified**: ownership proof. Listing Recommended: additional proof + Azure PMO after listing Verified is approved.
- Contract renewal still requires the primary proof file on listing Verified.
- Recommended submits still open the upgrade modal on Free.

## Out of scope

Subscription picker, new role catalogs, Recommended plan-eligibility changes, onboarding showcase redesign, search-boost Phase 3.
