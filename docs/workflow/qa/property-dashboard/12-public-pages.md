---
title: 'QA — Property Public Pages'
status: active
updated: 2026-09-21
---

# 12 — Public Pages

Route: `/org/:orgSlug/property/:propertySlug/public-pages`

## Looks good

- Explore-open on Free; save `publicPagesAutosave` Pro+; live Showcase `propertyShowcase` Pro+.
- Editors for Property / Stay Guide / Showcase with live preview.
- Permissions per page type.

## Issues

| Sev | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Evidence       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| P1  | ~~`get-public-showcase?preview=1` returned **400** during walk — preview broken until edge healthy~~ — **Not a code bug (re-triaged 2026-09-21)**: the handler only returns 400 for a missing `property`/`property_id` query param; both frontend call sites (`PublicPageCard.tsx`, `useShowcaseData.ts`) guard against an empty slug before ever constructing the request. Matches that day's session log (`./dev.sh` logged a missing edge secret at startup); graceful fallback already exists (`PublicPageLivePreview`'s 12s load-timeout falls back to a static thumbnail on any failure to load, 400 included)                                                                                                                                                                                                                                                                                                                                                | Console        |
| P2  | ~~Dual edit surfaces (Settings vs Public Pages) for same listing fields~~ — **Fixed**: `PublicPagesCrossLink` on the shared Settings section cards (Photos & Videos, Amenities, House Rules, Cancellation, Socials) links to Public Pages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Settings guide |
| P2  | ~~Free hosts can explore editors then hit Save upgrade — expected, still frustrating mid-edit~~ — **Already mitigated (re-triaged 2026-09-21)**: `PageEditorHeader` shows a `TierBadge` (e.g. "Pro") next to the page title on every render, unconditionally, before any edit happens — confirmed with a Free-plan E2E test (`dashboardModulesSmoke.spec.ts` "free host sees upgrade badge before editing listing page"). Verifying this exposed and fixed 4 stacked E2E-harness gaps that had left the whole Page Editor route untested: missing `public-page-configs` / `get-public-property` mocks (crashed / silently failed to load), `entitlementsPayload`'s `publicPagesAutosave` hardcoded `true` under `freePlan`, and `PLANS_E2E_CATALOG`'s `growthFeatures()` never granting `publicPagesAutosave` at all — all fixed in `propertyTeamRbacHarness.ts` / `orgPlanHarnessShared.ts`. No app code changed; the upfront signal already worked in production. | Matrix         |

## Improvements

- ~~Health check banner when public preview APIs fail.~~ Covered by the existing silent-fallback-to-static-thumbnail behavior; a banner would be redundant chrome for a background gallery preview.
- “Listing completeness” shared between Settings dots and Public Pages cards.

## Doc gaps

- Guide current on explore-open / save gates.

## Evidence

Console 400 on showcase; guide `public-pages.md`.
