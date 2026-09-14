---
title: 'Onboarding — operator guide'
status: active
tags: [guides, routes, onboarding]
updated: 2026-09-14
---

# Onboarding — operator guide

Route: `/onboarding`

> **Status:** Documented

## Progress overview

| Section      | E2E save | Validation | Docs       | Notes                                                                                                    |
| ------------ | -------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| Organization | ✅       | ✅         | Documented | Name + contact phone (no rights on this step)                                                            |
| Hosting      | ✅       | ✅         | Documented | Property and/or Parking + **Property Rights** (Parking Rights if parking-only; contract end when needed) |
| Verify       | ✅       | ✅         | Documented | Host: Valid ID + Facebook Page only. Listing proof uploads are listing Tier 1.                           |
| Get Verified | ✅       | ✅         | Documented | Host CTA on org routes; listing verification CTA on property/parking only                                |

---

## Overview

New hosts land here after Google sign-in when they have no organization. Creates an **organization**, first **property** and/or **parking**, then submits **base host verification** for review.

**Layout (lg+):** 50/50 split — left **`OnboardingFeatureShowcase`** → **`HostWorkspaceSidePanel`** (`variant="onboarding"`): solid **`bg-primary`**, **`MarketingBrandLogo`** inset `p-4` (same top-left as **`MarketingNav`**), setup copy + compact tour card. Tour video has an **expand** control (top-right) that opens a larger preview modal; playback and chapter stay in sync when opening or closing. The tour film is theme-aware and follows the viewer's light/dark choice (see `for-hosts.md` § Dark mode). Right column: wizard on subtle muted canvas + theme toggle. Mobile: form only.

If the user already has an **accessible** organization (owned or assigned, and not hard-rejected), the page redirects to **`/org/:slug/dashboard`** (last-used or first) — same rule as the **`/org`** hub. This is resolved **at host login / register** (`resolvePostSignInPath`) and again when **`/onboarding`** loads — not on Finish setup. A user may own **at most one usable** organization (one Supabase Auth email = one user = one owned org); **`create-organization`** rejects a second owned org with **409**, but owners whose only org was **hard-rejected** may start a **new application**. Hard-rejected hosts land on **`/verification-rejected`** after sign-in.

If Finish setup creates the org and a later verification call fails, retry **resumes** the same org (does not call `create-organization` again). A **409** after a refresh refetches orgs and redirects to the existing workspace.

---

## Host-facing knowledge

First-time hosts complete this wizard right after signing in with Google: organization details, what you host (property and/or parking), and identity verification uploads. On desktop, the left panel plays an interactive product tour of bookings, inbox, finance, and other modules while you complete setup.

**Common host questions**

- Q: How long does verification take after I finish onboarding?
  A: Review usually takes a few hours up to about three business days before listings can go fully live.
- Q: Can I host both a rental unit and a parking slot?
  A: Yes. Select both Property and Parking in the hosting step. You pick one Property Rights option that applies to both.
- Q: I already have access to another host's organization. Why did onboarding skip the setup steps?
  A: If you already have access to an organization, you're sent to that dashboard instead of creating a second one you own.
- Q: I signed in with the same email and saw setup again, then an error that I already own an organization.
  A: That email is already tied to a host workspace. Sign-in should send you to that dashboard. If setup was interrupted after the organization was created, Finish setup continues that same workspace instead of creating another.
- Q: Why did a contract renewal popup appear when I logged in?
  A: One of your property or parking listings has a hosting contract ending soon, in grace, or past grace. The reminder shows the listing name and how many days you have left.
- Q: Can I dismiss the renewal reminder and deal with it later?
  A: Before the contract ends, yes — dismiss snoozes it until tomorrow (Manila time). During grace you can dismiss until you refresh the page. Once access is locked for that listing, submit a renewal from inside that listing's dashboard.
- Q: Where do I upload a renewed hosting contract?
  A: Tap **Submit renewal contract** in the reminder, or open **Verification** from the property or parking sidebar.
- Q: What Facebook screenshot do I need on setup?
  A: A screenshot of your Facebook Page while you are logged in as admin or editor.
- Q: Where do I upload listing ownership documents?
  A: After setup, open **Get Verified** and upload in the **Listings** section, or open **Verification** on the property or parking sidebar. Upload proof of ownership or authorization on listing **Verified**. Additional proof and the Azure Property Management email confirmation go on listing **Recommended**.

---

## Steps

1. **Organization** — organization name, contact **Name**, **Contact number**. Organization name availability is checked after typing pauses (reserved-name rules below).
2. **Hosting** — choose **Property** and/or **Parking** (multi-select toggles); fill tower/unit and/or parking slot in the same step. **Property name** is required when Property is selected (tower + unit alone do not enable Continue). Property names follow the same reserved-name rules as org names. At least one host type must be selected. Residence is currently Azure-only (field **?** help). **Property Rights** (or **Parking Rights** when parking-only) lives in that listing card — same `ORG_VERIFICATION_RIGHTS` options. **Contract end date** appears when the rights option is Authorized Representative or Sublessee.
3. **Verify** — trust notice + **Let's get verified**. **Valid ID** and **Facebook Page screenshot** only. Listing files are **not** collected here. Proof of ownership belongs on listing **Verified**; additional proof and Azure PMO belong on listing **Recommended**.

Contact name pre-fills from the Google account display name when available.

### Reserved organization / property names

Hosts cannot use display names that impersonate the development or claim to be “official”, including evasion with extra punctuation or spacing (e.g. `Az.u.r.e North`). Blocked patterns (case-insensitive, punctuation ignored):

- **Azure North** and **Azure North Residence(s)**
- **Azure Official**, **Azure North Official**, **Azure North Residence Official**
- Any name containing the word **Official** as its own token (e.g. `My Official Host` — not `Unofficial`)

Enforced on onboarding, org settings, property settings, and **Add property** (`create-organization`, `update-organization`, `create-property`, `update-property`, `check-organization-name`, `check-property-name`). Shared logic: `reservedDisplayNames.ts` (UI + edge).

### Unit uniqueness (sublease handoff) — planned

**Tower+unit:** new properties are created **`INACTIVE`**. If another org already has an **`ACTIVE`** listing for the same tower+unit, onboarding shows a non-blocking **succession warning** (org name only) — Continue is allowed. Super-admin **Approve** on `/admin/approvals` activates this listing and archives the peer ACTIVE listing. Helpers who only need dashboard access should use **Team invite** instead of creating a second org; marketing-only helpers can forward the managing host’s guest booking link.

**Property name** uniqueness is **per organization** (not a cross-host lock).

Pair with lease/contract end + reverification so the previous listing is archived before (or when) the next host goes live.

### Property Rights / Parking Rights

One rights select on the hosting step — **Property Rights** inside the Property card, or **Parking Rights** inside the Parking card when parking-only. Same value for property and/or parking. Options:

- **Property Owner**
- **Authorized Representative**
- **Sublessee**
- **Property Admin**

**Contract end date** — required when the rights option is **Authorized Representative** or **Sublessee**; calendar picker (defaults to today, Asia/Manila). Saved as org **`contactRole`** on **`create-organization`** and as listing **`relationship`** on **`submit-listing-authorization`**.

### Trust copy (Verify step)

- To create a scam-free platform, every host is verified before listings go live
- Sensitive details may be redacted if verification-relevant info stays visible
- Uploads stored securely; never shown on public listings
- Review: a few hours up to 3 days
- Facebook Page screenshot help: Page name visible and logged in as admin or editor. Other-platform admin screenshots are optional on Recommended.

---

## Save path

1. **Finish setup** → `POST create-organization` (contact + hostModes + property/parking; **`contactRole`** from Step 2 Property Rights / Parking Rights). Skipped on retry if this session already created the org. **409** (already own) → refetch `list-organizations` and redirect to the existing workspace.
2. `POST upload-org-verification-asset` — Host Tier 1: `valid_id` then `social_proof` (Facebook Page screenshot) → bucket **`org-verification-assets`**
3. `POST submit-org-verification` `{ tier: 'base' }` — **`canSubmitBaseVerification` = Valid ID + Facebook Page** (`validIdPath` + `socialProofPath`). Sets `organizations.settings.verification.baseStatus = pending` (not plan-gated).
4. Per created listing: `POST submit-listing-authorization` (relationship + contract end, **no proof file**) → `settings.listingAuthorization.baseStatus = pending`. A listing already **pending** returns success (idempotent retry).
5. Redirect: property settings → parking settings → org dashboard

Host Tier 2 (Get Verified after onboarding): required `selfie_with_id`; optional `platform_admin_proof` and `business_permit_bir`. Facebook Page stays on Tier 1 (not re-uploaded). Plan-gated with **`recommendedBadgeEligible`**.

Listing Tier 2 (listing verification modal): additional proof + Azure PMO. `submit-listing-recommended` still needs listing Verified approved + **`recommendedBadgeEligible`**. Contract **renewal** still requires the primary proof file on the listing Verified tab.

---

## Enhanced verification (after onboarding)

Two-tier model (see **Get Verified** sidebar modal):

| Tier | Name            | Unlock                                  | Documents                                                                                |
| ---- | --------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | **Verified**    | Required to host (onboarding)           | Valid ID; Facebook Page screenshot                                                       |
| 2    | **Recommended** | Org-wide Recommended badge on host page | Selfie with ID; optional other-platform admin screenshot; optional Business permit / BIR |

**Listing verification** (separate scope, per property/parking): Tier 1 = Property Rights / Parking Rights (+ contract end when needed) **and** proof of ownership or authorization. Hosts upload that file in the listing **Verification** modal **or** in the **Listings** section of org **Get Verified** (the rollup does not label an absent proof as missing). After Finish setup the listing modal does **not** mark proof as missing — the upload field is the next step. Go-live still happens when super-admin approves listing Verified (onboarding submit is rights-only so Finish setup can succeed). Tier 2 = additional proof + Azure PMO. **Submit** still requires listing Verified **approved** plus **`recommendedBadgeEligible`**. Property/parking sidebars show a **Verification** CTA (not the org **Get Verified** modal). See [`onboarding-verification-simplify`](../../workflow/for-testing/onboarding-verification-simplify.md).

**Plan gating:** Host **Verified** (`base`) is **not** plan-gated so Free onboarding can Finish setup. **Get Recommended** (host `enhanced` and listing Recommended) requires **`recommendedBadgeEligible`** — client opens the upgrade modal; server enforces on **`submit-org-verification`** `tier: 'enhanced'` and **`submit-listing-recommended`**. Viewing flows and uploading drafts stay free; only Recommended submit is gated.

Tier names are display-only. Server tiers stay **`base`** (Tier 1) and **`enhanced`** (Tier 2), and the public flag stays **`verifiedBadge`**.

### Listing contract renewal

When a property or parking listing's hosting contract nears expiry, is in grace, or is locked, an org-wide **renewal reminder modal** appears on admin login (one listing at a time, highest urgency first). It replaces the old full-page strip/lock gate.

| Phase               | When                                | Dismiss?                                           |
| ------------------- | ----------------------------------- | -------------------------------------------------- |
| Pre-expiry          | T−15 days → day before contract end | Yes — daily snooze (Manila date, per listing)      |
| Grace               | Contract end → T+4                  | Yes until page refresh (no daily snooze write)     |
| Locked              | After grace                         | Non-dismissible on that listing's admin shell only |
| Consideration grant | Super-admin temporary access        | Dismissible once per day                           |

**Submit renewal contract** opens **Listing Verification** in renew mode → `submit-listing-authorization` renew path. Mutual exclusion: renewal modal never stacks with an open Listing Verification modal.

---

- Modal persuasion when Tier 2 is editable: benefit bullets + compact **Recommended badge preview** live **inside** the Tier 2 card, not above Tier 1. Hidden on Tier 1 changes-requested and when Tier 2 is pending/approved.
- **Tier rank cards** in the modal header: clickable Verified / Recommended cards with status badges; one tier panel visible at a time. Opens on the most relevant step (e.g. Recommended when Tier 1 is approved).
- Modal title follows the active step: **Get Verified** / **Get Recommended**; **Changes requested** in forced resubmit (stepper hidden).
- On phone/tablet the modal is a **bottom sheet** (`ResponsiveModal` `sheetLayout="split"`): sticky header + footer, middle section scrolls so long Verified uploads are not clipped.
- Sidebar CTA uses a soft primary wash and “Earn your Recommended badge.” when Tier 2 is not yet approved. Stays visible as **Verification** when both tiers are approved (status view; contract renewals / reverification later). Shown on **org** admin routes only — property/parking sidebars use the listing verification CTA instead.
- Public **Recommended** badge (`ListingRecommendedBadge`) has tooltip: identity, ownership, and Azure records checked by Kame Homes; shown on host page hero and **`ListingHostCard`** on property/parking detail (not duplicated next to the type badge).
- Copy constants: `ui/.../lib/verificationCopy.ts`.

### Phase 2–3 roadmap

- **Phase 2 (shipped in branch):** listing proof docs — **Proof of ownership or authorization** on listing **Verified**; **Additional proof** and **Azure Property Management email confirmation** on listing **Recommended** (help toggles with examples). Super-admin reviews them on the matching listing tab at `/admin/approvals`. Asset key: **`azurePmoConfirmationPath`**; upload type **`azure_pmo_confirmation`**.
- **Phase 3 (partial):** `/admin/approvals` prioritizes Recommended pending rows. Browse/search rank boost deferred until public property listings API. Trust strip dropped. No skip Tier 1 / instant go-live.

### Behavior

- Modal shows **Tier 1 status** from onboarding as a document checklist (uploads only — not property/parking rights or contract dates); each row has a **View** button that opens a full preview (signed URLs via `get-org-verification-assets`). **Recommended (Tier 2)** uses the same submitted-docs list + **View** when `enhancedStatus ≠ none`.
- The **Listings** rollup at the bottom of both Get Verified steps does **not** say “missing” for documents that are not uploaded yet. Hosts can upload listing proof of ownership or authorization in that section, or **Open** the listing Verification modal.
- When **Tier 1 has changes requested**, a **non-dismissible** modal opens on dashboard login (no X / Close / Escape / outside click). Resubmit shows **Valid ID** and **Facebook Page screenshot**; previously submitted files remain visible below the upload fields. The host must replace the flagged docs and tap **Resubmit**. After resubmit, status returns to pending and the modal closes. Tier 2 persuasion is hidden in this mode.
- When **Tier 1 is hard-rejected**, the host is blocked from the dashboard (`/verification-rejected`) and must **Start a new application** (new org). In-app resubmit is not allowed.
- **Tier 2 can be submitted anytime** — does not require Tier 1 approval first; each tier is reviewed independently.
- Platform review queue: **`/admin/approvals`** (super admin) — see [admin/approvals.md](./admin/approvals.md).
- `submit-org-verification` `{ tier: 'enhanced' }` → `enhancedStatus = pending`
- When **Tier 2 approved**: public **`/hosts/:orgSlug`**, property detail, and parking detail show **Recommended** badge (`verifiedBadge` from org enhanced verification)

---

## API reference

| Endpoint                        | Method | Auth            |
| ------------------------------- | ------ | --------------- |
| `create-organization`           | POST   | JWT             |
| `upload-org-verification-asset` | POST   | JWT (org owner) |
| `submit-org-verification`       | POST   | JWT (org owner) |
| `submit-listing-authorization`  | POST   | JWT (org owner) |

---

## Implementation map

| Concern           | Path                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Page              | `ui/src/features/dashboard/org/pages/OnboardingPage.tsx`                                                                     |
| Feature showcase  | `ui/.../components/onboarding/OnboardingFeatureShowcase.tsx` — thin wrapper over **`HostWorkspaceSidePanel`** (`onboarding`) |
| Shared side panel | `ui/src/features/guest/marketing/shared/components/HostWorkspaceSidePanel.tsx` — also **`AuthLayout`** host routes (`auth`)  |
| Product tour      | `ui/src/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer.tsx` (shared w/ marketing)                     |
| Rights fields     | `ui/.../components/onboarding/OnboardingVerificationRightsFields.tsx`                                                        |
| Step header       | `ui/.../components/onboarding/OnboardingStepHeader.tsx`                                                                      |
| Account menu      | `ui/.../components/onboarding/OnboardingProfileHeader.tsx` — Switch account · Sign out                                       |
| Proof upload UI   | `ui/.../components/onboarding/OnboardingProofUpload.tsx`                                                                     |
| Host verify       | `ui/.../components/onboarding/OnboardingHostVerificationSection.tsx`                                                         |
| Listing verify    | `ui/.../components/listing-authorization/ListingVerificationModal.tsx` — listing Tier 1 proof uploads (not onboarding)       |
| Get Verified      | `ui/.../components/verification/GetVerifiedModal.tsx` (`HostVerificationChangesGate` in `AdminLayout`)                       |
| Badge preview     | `ui/.../components/verification/RecommendedBadgePreview.tsx`                                                                 |
| Verification copy | `ui/.../lib/verificationCopy.ts`                                                                                             |
| Shared types      | `ui/.../lib/orgVerification.ts` + `supabase/functions/_shared/orgVerification.ts`                                            |
| Edge              | `create-organization`, `upload-org-verification-asset`, `submit-org-verification`                                            |
| Storage           | migration `20260922120000_org_verification_assets.sql`                                                                       |

## Post-registration Setup Guide

After onboarding finishes, hosts land on the listing dashboard. The **Setup Guide** overlay covers initial settings. See [org/setup-guide.md](./org/setup-guide.md).
---

## Testing

| Layer  | Path / spec                                                                                                         | Manual                   |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Unit   | setup guide / org creation validators when pure                                                                     | —                        |
| E2E    | `ui/e2e/features/onboarding/onboardingSmoke.spec.ts` (`@ci`) — org step + property listing selection → verify intro | —                        |
| Manual | Full verification upload + review                                                                                   | Manual host verification |
