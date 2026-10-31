---
stage: for-testing
title: 'Onboarding verification simplify — design'
status: approved
tags: [onboarding, verification, design]
updated: 2026-09-01
related:
  - docs/workflow/for-testing/onboarding-verification-simplify.md
  - docs/workflow/for-testing/host-verification-tiers.md
  - docs/workflow/done/verification-scope-split.md
---

# Onboarding verification simplify — design

Keep the three-step hosting wizard. Collect **Property Rights** on Step 2 from existing verification-rights values (Parking Rights when parking-only). Require **Valid ID + Facebook Page screenshot** on Step 3. Listing **Verified** collects proof of ownership or authorization. Listing **Recommended** collects additional proof + Azure PMO. Do not delete existing Recommended documents.

## Locked decisions

| Decision                        | Choice                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rights options                  | Reuse `ORG_VERIFICATION_RIGHTS` (Property Owner, Authorized Representative, Sublessee, Property Admin). Label **Property Rights** / **Parking Rights**. No Team RBAC ids, no `PROPERTY_CONTACT_ROLES`.          |
| Save                            | Org `contactRole` on `create-organization`. Same value as listing `relationship` on each created property/parking. One role when both host modes are selected.                                                  |
| Contract end                    | Stays on **Step 2** when the role is Authorized Representative or Sublessee (not a document).                                                                                                                   |
| Host Facebook Page              | Keep on host **base** (onboarding Step 3, below Valid ID). Still required on host Recommended.                                                                                                                  |
| Listing ownership/parking proof | Collect on listing Verified (Tier 1) in the property/parking Verification modal. Additional proof + Azure PMO stay on listing Recommended. Submit listing Recommended still after listing Verified is approved. |
| Listing go-live                 | Super-admin still approves listing **base** (rights + contract end). Primary proof is reviewed on listing Verified but onboarding submit stays rights-only.                                                     |
| Existing Recommended docs       | Keep. Host: selfie, platform-admin screenshot, optional legitimacy/BIR. Listing: additional proof + Azure PMO on listing Recommended.                                                                           |
| Host base vs plan               | Host **base** (Valid ID + Facebook Page) is not plan-gated. Recommended submits stay gated (`recommendedBadgeEligible`).                                                                                        |

## Document matrix

| Surface                        | Required documents / fields                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Onboarding Step 2              | Hosting details + Property Rights / Parking Rights (+ contract end when needed)                    |
| Onboarding Step 3              | Valid ID + Facebook Page screenshot                                                                |
| Host Tier 1 (`base`)           | Valid ID + Facebook Page (`social_proof`)                                                          |
| Host Tier 2 (`enhanced`)       | Existing Recommended docs **plus Facebook Page** (`social_proof`)                                  |
| Listing Tier 1 (`base`)        | Relationship + contract end when needed + ownership/authorization proof (uploads in listing modal) |
| Listing Tier 2 (`recommended`) | Additional proof + Azure PMO (submit after listing Verified approved)                              |
| Listing contract renewal       | Still requires a proof file (unchanged)                                                            |

Host vs listing scopes stay split (Get Verified = org; listing modal = property/parking).

## Go-live

Onboarding still creates `INACTIVE` listings and still submits listing **base** so `/admin/approvals` can activate them. Base submit from onboarding does not upload proof. Hosts upload primary proof on listing Verified, then additional proof + Azure PMO on listing Recommended. `submit-listing-recommended` still requires listing base **approved** first.

## Plan gating (required for Finish setup)

Today `submit-org-verification` `tier: 'base'` calls `requireOrgPropertyFeature(..., 'verifiedBadgeEligible')`. New orgs are Free and listings are `INACTIVE`, so Finish setup fails. Ungate host **base** only. Leave Recommended (host + listing) gated.

## Out of scope

- New role catalogs or Team invite RBAC
- Subscription picker during onboarding
- Changing which plan unlocks Recommended
- Host-verification-tiers Phase 3 search boost
- Onboarding left-panel showcase redesign (separate intake item)

## Success

- New host completes onboarding with Property Rights / Parking Rights + Valid ID + Facebook Page screenshot.
- Super-admin can approve host (ID + Facebook Page) and listing (rights) and set the listing `ACTIVE`. Primary proof is reviewed on listing Verified when uploaded.
- Facebook Page is collected on host base; listing ownership proof appears on listing Verified; additional proof + Azure PMO appear on listing Recommended.
- Free hosts can submit Valid ID + Facebook Page; they still cannot submit Recommended without the matching plan.
