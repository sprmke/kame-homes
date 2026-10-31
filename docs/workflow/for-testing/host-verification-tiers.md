---
title: 'Host verification tiers'
stage: for-testing
status: for-testing
updated: 2026-09-01
tags: [workflow, for-testing, verification, onboarding]
---

# Host verification tiers

> **Stage:** [`for-testing`](./README.md) — Phases 1–2 + admin queue priority shipped. Remaining: manual QA (§ Phase 3 testing checklist). Explore/search boost **deferred** (not blocking). Move to [`../done/`](../done/) after checklist passes.

**Status: Phase 1–2 shipped (2026-08-04). Phase 3 partial — admin queue priority shipped; browse search boost deferred until public property listings API.**

**Tier naming (2026-08-04):** Tier 1 is **Verified**, Tier 2 is **Recommended**. Two tiers only — a third tier was considered and dropped.

> **Onboarding simplify (2026-08-31):** Host Tier 1 is **Valid ID + Facebook Page screenshot**. Listing **Verified** collects proof of ownership or authorization. Listing **Recommended** collects additional proof + Azure PMO. Listing go-live is still listing Verified approve (onboarding submit is rights-only). Host base submit is **not** plan-gated. See [`onboarding-verification-simplify.md`](./onboarding-verification-simplify.md).

## Current document sets

| Scope      | Tier 1 (base)                                                                                                                 | Tier 2 (Recommended)                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Host / org | Valid ID + Facebook Page screenshot                                                                                           | Selfie with ID; optional other-platform admin screenshot; optional Business permit / BIR |
| Listing    | Property Rights / Parking Rights (+ contract end when Authorized Representative or Sublessee) + ownership/authorization proof | Additional proof + Azure PMO (submit after listing Verified is approved)                 |

Contract **renewal** still requires a proof file.

## Decisions locked

| Decision                | Choice                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| Product scope           | Full arc (UI + better docs + real benefits), shipped in phases       |
| Phase 1 slice           | Modal UI/UX + benefits messaging + public badge/highlight + tooltips |
| Badge personality       | Hybrid — warm host CTA/modal; clean trust on public surfaces         |
| Implementation approach | Polish-in-place (keep `GetVerifiedModal` flow; no wizard rebuild)    |
| Tier names              | Tier 1 **Verified**, Tier 2 **Recommended** — display-only rename    |

## Tier model (existing; unchanged)

| Tier | Name        | Role                                                                                    |
| ---- | ----------- | --------------------------------------------------------------------------------------- |
| 1    | Verified    | Base verification from onboarding — required to host                                    |
| 2    | Recommended | Enhanced — `verifiedBadge` on host page + listings when `enhancedStatus === 'approved'` |

Names are display-only. Server tiers stay `base` / `enhanced`, the org settings keys stay `baseStatus` / `enhancedStatus`, and the public flag stays `verifiedBadge` — renaming those would touch five edge functions and the super-admin review flow for no product gain.

Tier 2 may be submitted anytime; tiers reviewed independently. Forced non-dismissible modal on Tier 1 changes-requested; hard reject → `/verification-rejected`.

## Phase status

| Phase | Focus                                             | Status                                       |
| ----- | ------------------------------------------------- | -------------------------------------------- |
| 1     | Modal polish, benefits copy, public badge/tooltip | **Shipped**                                  |
| 2     | Better Tier 2 document requirements               | **Shipped**                                  |
| 3     | Real product benefits (ranking, queue)            | Partial — admin queue; search boost deferred |

---

## Phase 1 — polish (execute now)

**Goal:** Polish Get Verified modal, host benefit messaging, sidebar CTA warmth, and public Recommended badge/highlight/tooltips — without changing Tier 2 uploads or backend behavior.

**Architecture:** Polish-in-place on existing `GetVerifiedModal` + `ListingRecommendedBadge`. Centralize copy in `verificationCopy.ts`. Hybrid tone: warm host surfaces, clean trust on public listings.

**Tech stack:** React 18, Tailwind, Radix Tooltip (`ui/src/components/ui/tooltip.tsx`), Lucide, existing org verification edge APIs (unchanged).

### Constraints

- No new migrations, asset types, or edge function contract changes.
- Preserve forced Tier 1 changes-requested modal (non-dismissible).
- Minimal UI copy: labels, errors, benefit bullets, tooltip, one _Recommended host_ line.
- Mobile-first: 375px+, 44×44px touch targets.
- Do not implement Phase 2/3 in the same session.

### Design

**Modal**

- Keep structure: header → clickable `VerificationTierProgress` → **one tier panel at a time** (Verified or Recommended) → footer.
- Add **Tier 2 persuasion block** above tier cards when Tier 2 is editable / not yet approved (hide on `hostChangesRequested`):
  1. **Benefit strip** — 3 short bullets
  2. **Badge preview** — compact mock of how guests see Recommended (see below)
- Upgrade Tier 2 benefit line via `buildVerificationTiers`.
- Preserve forced-resubmit behavior and existing upload slots (selfie, ownership, PMO ×1–2).
- Centralize copy in `ui/src/features/dashboard/org/lib/verificationCopy.ts`.

**Host benefit bullets** (honest to badge-only today)

1. Stand out on your host page and listings
2. Guests see a clear Recommended badge
3. Access more host features in the app

Tier subtitle: _Earn a Recommended badge guests notice on your listings._

**Recommended badge preview** (host modal — seduce before apply)

- Small non-interactive mock beside/under the benefit bullets — not a full listing card.
- Layout: avatar placeholder + host name (use org display name when available, else “Your host name”) + real `ListingRecommendedBadge`.
- Optional muted caption under the mock: _Guests see this on your listings._
- Same clean public badge style (not a separate cute design).
- Hide when Tier 2 already approved/pending, and when forced Tier 1 resubmit.
- Component: `ui/.../verification/RecommendedBadgePreview.tsx` (keeps modal thinner).

**Public badge & highlight**

- Enhance `ListingRecommendedBadge` (contrast, `BadgeCheck` + Recommended).
- Tooltip: _Identity, ownership, and Azure records checked by Kame Homes._
- Radix Tooltip; touch-friendly trigger (≥44px where interactive).
- When `verifiedBadge`: badge by host name + minimal _Recommended host_ line (property, parking, host card/hero). No new marketing cards.
- Replace duplicate inline badge in `HostPublicHero` with shared `ListingRecommendedBadge`.

**Sidebar CTA**

- Soft primary wash; Shield/BadgeCheck.
- Optional expanded sublabel: _Earn your Recommended badge._
- Status labels from `verificationSidebarLabel` stay status-aware.

**Files**

| Area          | Path                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| Modal / CTA   | `ui/.../verification/GetVerifiedModal.tsx`                                 |
| Badge preview | `ui/.../verification/RecommendedBadgePreview.tsx` (new)                    |
| Copy          | `ui/.../lib/verificationCopy.ts` (new)                                     |
| Tier strings  | `ui/.../lib/orgVerificationTiers.ts`                                       |
| Public badge  | `ui/.../ListingRecommendedBadge.tsx`                                       |
| Host surfaces | `HostPublicHero`, `PropertyOverview`, `ParkingOverview`, `ListingHostCard` |
| Docs          | `docs/guides/routes/onboarding.md`                                         |

**Success criteria**

- Host opens Get Verified and understands why Tier 2 is worth it in under 5 seconds (bullets + badge preview).
- Preview matches the public badge look so the payoff feels real before upload.
- Public Recommended badge has a clear tooltip; highlight is visible but sparse.
- Forced Tier 1 resubmit still works (no dismiss, correct docs; no preview distraction).
- No backend / migration changes.

### Implementation tasks

#### Task 1: Centralize verification copy

**Files:** Create `ui/src/features/dashboard/org/lib/verificationCopy.ts`; modify `orgVerificationTiers.ts`.

- [x] Add `verificationCopy.ts` with benefit bullets, guest tooltip, sidebar sub, Tier 2 subtitle, upload help tips, approved/pending messages.
- [x] Point `buildVerificationTiers` Tier 2 benefit at the new Tier 2 subtitle.
- [x] `bun run type-check` for these files.
- [ ] Commit when asked: `feat(org): add verification copy constants for tier messaging`

#### Task 2: Modal persuasion block + warmer CTA

**Files:** Modify `GetVerifiedModal.tsx`; create `RecommendedBadgePreview.tsx` (optional small progress/card tweaks).

- [x] Insert persuasion block (benefit strip + `RecommendedBadgePreview`) inside the Tier 2 card when Tier 2 not approved; hide on `hostChangesRequested`.
- [x] Preview uses org name when available; reuse `ListingRecommendedBadge`; caption _Guests see this on your listings._
- [x] Wire upload help + approved/pending messages from copy (same asset fields).
- [x] Warm `GetVerifiedSidebarCta` — soft primary wash, optional expanded sublabel.
- [x] Verify at 375px — persuasion block readable, no overflow; forced modal still non-dismissible.
- [ ] Commit when asked: `feat(org): polish Get Verified modal benefits and badge preview`

#### Task 3: Public badge + tooltip + highlight

**Files:** `ListingRecommendedBadge.tsx`, `HostPublicHero.tsx`, `PropertyOverview.tsx`, `ParkingOverview.tsx`, `ListingHostCard.tsx`.

Guest tooltip stays file-local on `ListingRecommendedBadge` (avoid dashboard→guest import); host copy stays in `verificationCopy.ts`. Prefer implementing badge polish **before or with** Task 2 so the preview uses the final badge look.

- [x] Upgrade badge with Tooltip + `aria-label`; tighten styles; min touch size.
- [x] `HostPublicHero` — shared badge `size="md"` + _Recommended host_ line.
- [x] Property/Parking overview — shared badge + one-line _Recommended host_ when true.
- [x] Visual check light + dark; keyboard focus on tooltip.
- [ ] Commit when asked: `feat(marketing): improve Recommended badge tooltip and host highlight`

#### Task 4: Docs

- [x] Update `docs/guides/routes/onboarding.md` — Phase 1 UX + Phase 2/3 roadmap bullets.
- [ ] Commit when asked: `docs(guides): document verification tier Phase 1 UX`

#### Task 5: Verification gate

- [x] `bun run type-check` and `bun run lint`.
- [x] Manual QA against Phase 1 success criteria.
- [x] Mark Phase 1 status **shipped** in the phase table above; stop (do not start Phase 2 in the same session).

### Phase 1 testing checklist

- Modal at 375 / 768 / 1024: persuasion block (bullets + badge preview), tiers, submit/resubmit.
- Badge preview matches public badge styling; caption visible.
- Forced modal: no X / Escape / outside dismiss; no Tier 2 preview.
- Public property + parking + host page: badge + tooltip.
- Sidebar CTA labels for none / pending / rejected / approved Tier 2.

---

## Phase 2 — better Tier 2 requirements (shipped)

| Action                       | Requirement                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Keep                         | Selfie with ID (+ readable-ID tips in help toggle)                                             |
| Clarify                      | **Additional Proof of Ownership/Authorization** (examples in help toggle)                      |
| Replace dual PMO screenshots | **Azure Property Management email confirmation** (examples in help toggle)                     |
| Admin                        | `/admin/approvals` — dual tier status in queue + Verified/Recommended tabs when both submitted |

**Asset model:** `azure_pmo_confirmation` → `assets.azurePmoConfirmationPath` (legacy `opsProofPath`, `pmoEmailPaths[0]`, `pmo_email_1` still read for in-flight submissions).

### Phase 2 tasks

- [x] Shared schema: `azurePmoConfirmationPath`, `azure_pmo_confirmation` upload type, legacy read fallback
- [x] Host modal: 3 docs (selfie, ownership/authorization proof, Azure PMO confirmation) + labels/help toggles
- [x] Super-admin: Tier 2 doc previews + approve/reject with `tier: 'enhanced'`
- [x] Queue: list/filter orgs with enhanced pending; Verified queue row when both tiers pending
- [x] Docs: onboarding, approvals guide, `docs/architecture/edge-functions.md`
- [x] Manual QA (see checklist below)

### Phase 2 testing checklist

- Host: upload 3 Recommended docs with help toggles; submit Recommended tier.
- Admin: org in **In review**; dialog shows **Recommended** + 3 doc previews; approve → public badge.
- Admin: when **both** tiers pending, row + dialog default to the most recently submitted tier; switch tabs to review the other tier.
- Host: Tier 2 changes-requested → feedback on Recommended tab; resubmit without dashboard block.
- Legacy: org with `opsProofPath` or `pmoEmailPaths[0]` still loads and previews.

---

## Phase 3 — real product benefits (partial)

Do not start browse ranking until public property listings are live (see `smart-search-bar` / list-public-properties backlog).

1. ~~Trust strip near Reserve~~ — **dropped** (host card badge is enough).
2. Explore/search boost for Recommended hosts (same tower/dev) — **deferred** (mock browse only today; ship with public list API + `verifiedBadge` per row).
3. Priority in `/admin/approvals` for Recommended orgs — **shipped**.

Do **not** promise skipping Tier 1 or instant go-live.

### Phase 3 tasks

- [ ] ~~Trust strip~~ — dropped.
- [ ] Explore/search boost — deferred until public property catalog API.
- [x] `/admin/approvals` queue priority: Recommended (`enhancedStatus === pending`) rows sort before other pending orgs (newest submit within each group).
- [ ] Manual QA: admin queue ordering when both Verified-only and Recommended-pending orgs are in review.

### Phase 3 testing checklist (admin queue)

- `/admin/approvals` (**In review**): org with Recommended pending appears above Verified-only pending rows (same filter).

---

## Error handling / edge cases (all phases)

- Changes-requested / hard-reject flows unchanged unless a later phase explicitly revises them.
- Tooltip must not block listing CTAs; keyboard accessible.
- Dark mode contrast for badge.
