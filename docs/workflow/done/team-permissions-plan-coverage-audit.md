---
title: 'Team permissions and plan coverage audit'
status: for-testing
stage: done
tags: [team, rbac, plans, entitlements, marketing, analytics]
updated: 2026-09-27
---

# Team permissions and plan coverage audit

## Goal

Make the Team role/permission lists (property, org, parking) cover every host capability shipped recently, and make sure each one respects both the member's permissions and the org's active plan. Today the catalogs lag behind the plan feature keys and new edge functions. The clearest miss is Marketing AI image generation, but the same pattern shows up in other places (below).

## Method used for this review

Compared four sources: `TEAM_PERMISSION_IDS` (edge) vs `propertyTeamConstants.ts` + `propertyPermissionCatalog.ts` (UI) vs `PlanFeatures` keys vs the actual gate calls in `supabase/functions/*/index.ts` (`resolveScopedPropertyAccess`, `requirePropertyPermissionAndFeature`, `requirePropertyFeature`, `requireOrgFeature`). UI/edge id lists are currently identical (85 property leaves), so the gaps are missing leaves and wrong mappings, not drift.

## Findings

### A. Wrong or missing (fix in this plan)

| #   | Area                                | Finding                                                                                                                                                                                                                                                                                                                                                                                                                             | Fix                                                                                                                                                                                                             |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Marketing: image generation         | One leaf `marketing.generate:add` covers captions, template design (plan `aiMarketingGeneration`, Business+) **and** image generation (`aiMarketingImageGeneration`, Pro+). `COARSE_PLAN_FEATURES` maps the leaf to `aiMarketingGeneration`, so the Team UI shows the wrong tier on it, and a role cannot get captions without images (images cost 34-45 credits). Video already has its own leaf (`marketing.generate.video:add`). | Add `marketing.generate.image:add` → `aiMarketingImageGeneration`. Keep `marketing.generate:add` for AI text (captions, templates). Chips: Text / Image / Video.                                                |
| A2  | Analytics AI review                 | `analytics-ai-review` POST spends credits but only needs `analytics:view` + `analyticsInsights`. A view-only role can trigger generation.                                                                                                                                                                                                                                                                                           | Add `analytics.aiReview:add` → `analyticsInsights`. POST requires it; GET stays `analytics:view`.                                                                                                               |
| A3  | Smart Pricing                       | Reuses `pricing.rates:edit`. Anyone who can edit one rate can turn on autopilot that rewrites all rates and calls Gemini. Previous decision was "no new leaf".                                                                                                                                                                                                                                                                      | Add `pricing.smartPricing:edit` → `smartPricing` (settings PATCH, preview, apply). Revisit the earlier N/A decision, see Q1.                                                                                    |
| A4  | Dashboard AI assistant              | No leaf. Plan-gated (`aiDashboardAssistant`, Business+) and per-tool permission checks exist, but any property member sees and can open it. `dashboard-assistant-chat` also hardcodes the owner/admin permission list (bookings, finance, maintenance, pricing only), which is already stale against the catalog.                                                                                                                   | Add `assistant:view` (module "AI Assistant", plan `aiDashboardAssistant`). Keep tool-level checks. Replace the hardcoded list with `allTeamPermissions()` filtered to what tools consume, or a shared constant. |
| A5  | Activity log                        | Property/parking Activity pages are gated by `bookings:view` (see `propertyPermissions.ts` section map). Audit data (who changed what) is exposed to anyone who can see bookings. Org Activity uses `org.dashboard:view`. Export is owner/admin only with plan `activityLogExport`.                                                                                                                                                 | Add `activity:view` (property + parking) and `org.activity:view`. Optionally `activity:export` → `activityLogExport` (see Q2).                                                                                  |
| A6  | Guest reviews / trust               | `list-property-guest-reviews` piggybacks on `marketing:view`. Reviews are a trust surface, not marketing.                                                                                                                                                                                                                                                                                                                           | Decide in Q3: keep under Marketing (rename chip "Reviews") or add `reviews:view`. Default: keep, document.                                                                                                      |
| A7  | Credit-spending actions             | Feature is plan-gated but permission is broad in several places: `booking-ai-review` / `validate-booking-receipts` (`aiValidations`), `social-inbox-ai-suggest`, `import-ai-map-columns`, voice receptionist preview.                                                                                                                                                                                                               | Audit each handler in Phase 0. Confirm it requires a leaf at least as strict as the action (edit/add, not view). Add leaves only where no existing one fits.                                                    |
| A8  | Plan-gated leaves with no plan link | `COARSE_PLAN_FEATURES` has no entry for leaves backed by plan keys `automatedBookingFlow`, `aiValidations`, `verifiedBadgeEligible`, `recommendedBadgeEligible`, `copyPropertySettings`, `searchVisibilityTier`.                                                                                                                                                                                                                    | For each, either map to a leaf or record explicit N/A with reason in the registry (Phase 1).                                                                                                                    |

### B. Needs verification before deciding (Phase 0)

- **Org scope**: no org leaves for Activity, Inbox, Setup Guide, Verification/Superhost, Copy property settings. `copy-property-settings` real copy must be checked for an org permission (only `listLogs` visibly calls `verifyOrgAccess`); if it only checks the plan, an org member with `org.properties:view` may copy settings. Likely fix: require `org.properties:manage`.
- **Verification/badge submissions** (`submit-listing-*`, `settings-verification` uses `settings.payment:edit` for property). Confirm the leaf matches intent and that `verifiedBadgeEligible` / `recommendedBadgeEligible` are enforced on server for submit.
- **Parking scope** (`parkingTeamPermissions.ts` is coarse: bookings/finance/pricing/notifications/settings/team/inbox). Missing candidates: Activity, AI assistant, broadcast/endorsement actions, media (uses `org.parkings:manage`). Claim/decline share `bookings:edit`.
- **Downgrade behavior**: when a plan drops (`apply-org-plan-downgrade`), members keep stored leaves. Confirm server rechecks plan on every write (it does for the listed handlers) and that Team UI shows the leaf as locked, not silently editable. Also confirm custom-role save behavior when it includes leaves the plan doesn't cover.
- **Full-surface sweep**: list every new route in `docs/guides/routes/org/**` added since the last catalog change and confirm each has a `:view` gate. Suspects: Announcements, Help and Support, Setup Guide, Custom Pages, Page Editor, Import, Notifications center, Analytics.

### C. Confirmed fine (no change)

Bookings, Finance, Maintenance, Inbox (channels / quick replies / automation), Templates, Public Pages (property, stay guide, showcase), Pricing Channel sync, Voice receptionist settings, AI overrides, Telegram notifications, Team + custom roles, Booking import, Announcements and Help (general content, `N/A` with reason).

## Scope

**In:** property, org, and parking permission catalogs; seeded templates; edge gates; plan mappings; Team UI chips and locked-state; migration backfill; tests; docs.
**Out:** new plan tiers or pricing changes; new features; guest/portal identity; super-admin `/admin/*`.

## Approach

1. **Registry first.** Add one typed table (shared shape, mirrored client/server like `planFeatures.ts`) mapping each `PlanFeatureKey` to `{ leaves: string[] } | { na: reason }`. A test fails when a plan key is neither mapped nor explicitly N/A. This stops the same drift recurring.
2. **New leaves follow the `module.leaf:action` shape**, added to all four places: edge `TEAM_PERMISSION_IDS`, UI `TEAM_PERMISSIONS`, catalog (`sectionParent`, `chipLabelFromPermission`, `COARSE_PLAN_FEATURES`, group node), and seeded templates.
3. **Backward compatibility**: a backfill migration (`20261316125000_team_permissions_plan_coverage_leaves.sql`) grants each new leaf to holders of its source leaf across members, custom roles, and invitations (property, parking, org). Read-time expansion was rejected: it would re-add the new leaf on every read and make it impossible to revoke.
4. **Seeded templates**: Full Access gets all new leaves. Operations keeps text generation but gets no image, video, AI review, or smart pricing leaves (Q4). Read Only gets only `:view` leaves (`activity:view` optional).
5. **Server**: every mutating handler uses `resolveScopedPropertyAccess('<leaf>')` then `requirePropertyPermissionAndFeature(..., leaf, planKey)` with the correct plan key per action, not the coarse one.
6. **Client**: hide entries without `:view`; disable mutations without leaf; keep preview-open plan UX (`TierBadge`, `openUpgradeModal`).

## Implementation tasks

### Phase 0: Verify (no code)

- [x] Run a script over `supabase/functions/*/index.ts` listing every gate (leaf, plan key) and diff against catalog and registry. Save output to scratchpad, attach summary to this plan.
- [x] Resolve every item in section B (record verdict + evidence).
- [x] Confirm `copy-property-settings` org permission behavior.

### Phase 1: Registry + drift test

- [x] `supabase/functions/_shared/planFeaturePermissions.ts` and UI mirror `ui/src/features/dashboard/plans/lib/planFeaturePermissions.ts`.
- [x] Vitest drift test (plan keys covered; mapped leaves exist; UI/edge identical). Extend `propertyTeamCatalogDrift.test.ts` / `orgTeamCatalogDrift.test.ts`.
- [x] Derive `COARSE_PLAN_FEATURES` from the registry instead of a hand-kept object.

### Phase 2: Property leaves

- [x] `marketing.generate.image:add` (A1): edge ids, UI constants, catalog + chips ("Text", "Image", "Video"), plan map, `generate-marketing-media` (image branch), `upload-marketing-generation-reference`, `marketing-generations` (DELETE by job type).
- [x] `analytics.aiReview:add` (A2): `analytics-ai-review` POST; UI button on Analytics page.
- [x] `pricing.smartPricing:edit` (A3): `smart-pricing-settings` PATCH, `smart-pricing-preview`, `smart-pricing-apply`, `SmartPricingDialog` disable state.
- [x] `assistant:view` (A4): `dashboard-assistant-chat` / `confirm`, `useAiAssistantAccess`, launcher visibility; replace hardcoded permission list.
- [x] `activity:view` (A5): `list-activity-log` scoping for property/parking members, sidebar/route gate, `propertyPermissions.ts` section map (`activity` no longer `bookings:view`).
- [x] Legacy expansion + migration backfill + seeded templates + `propertyTeamTemplates.test.ts`.

### Phase 3: Org and parking

- [x] Org: `org.activity:view` (and export leaf if Q2 = yes), any leaves proven necessary in Phase 0 (`org.properties:manage` on real copy). Update `orgTeamPermissions.ts`, `orgTeamConstants.ts`, `orgPermissionCatalog.ts`, `orgLegacyPermissionExpansion.ts`, tests.
- [x] Parking: add leaves proven necessary in Phase 0 (Activity, assistant). Update `parkingTeamPermissions.ts`, `parkingTeamConstants.ts`, `parkingPermissions.ts`, tests.

### Phase 4: Team UI

- [x] New group nodes and chips render in the role editor (desktop + mobile bottom sheet; invoke `mobile-responsive`).
- [x] Locked state shows plan pill on every plan-linked leaf; downgrade case verified.
- [x] Copy via `human-copy` (short chip labels, no em dashes).

### Phase 5: Tests

- [x] Vitest: catalog, templates, expansion, drift, registry.
- [x] Deno: `_shared/*_test.ts` for new leaves; handler tests for 403 (missing leaf) and 402 (missing plan) on each changed function.
- [x] Playwright mocked E2E: role editor shows new chips; a role without image leaf cannot generate.
- [x] Note: component tests (`.test.tsx`) are silently ignored by Vitest, so do not rely on them.

## Docs to update

- `docs/architecture/plans-feature-matrix.md` (permission column per key; note `smartPricing` decision change)
- `docs/architecture/overview.md`, `docs/PROJECT.md` (permission ids, API gates)
- Route guides Permissions tables + Host Q&A: `org/property/team.md`, `marketing.md`, `analytics.md`, `pricing.md`, `activity.md`, `org/team.md`, `org/parking/team.md`, `org/analytics.md`, `org/activity.md`
- `.cursor/rules/plans-and-permissions.mdc` and `.claude/skills/plans-and-permissions/SKILL.md`: add the registry as a required step
- `docs/archive/operations/migration-runbook.md` (backfill migration)
- Audit logging: role/permission changes already emit events; `activity-log: N/A` for catalog-only changes, confirm backfill migration needs no event

## Open questions (resolved)

1. **Smart Pricing leaf (A3)**: new `pricing.smartPricing:edit`, or keep sharing `pricing.rates:edit`? Recommend new leaf (autopilot rewrites every rate and spends credits).
2. **Activity export (A5)**: keep owner/admin-only, or expose as a grantable leaf? Recommend keep owner/admin-only and skip the export leaf.
3. **Guest reviews (A6)**: keep under Marketing or a separate `reviews:view`? Recommend keep under Marketing.
4. **Operations template and AI spend**: should Operations get the AI generation/review/smart-pricing leaves by default? Recommend no (Full Access only; Operations gets text generation as today).

## Outcome (implemented)

Decisions taken (recommended defaults): Q1 new `pricing.smartPricing:edit`; Q2 no activity export leaf (stays owner/org-admin); Q3 guest reviews stay under Marketing; Q4 Operations gets no AI-spend leaves.

Shipped: `marketing.generate.image:add`, `pricing.smartPricing:edit`, `analytics.aiReview:add`, `assistant:view`, `activity:view` (property + parking), `org.activity:view`; plan registry `PLAN_FEATURE_PERMISSION_COVERAGE` + drift tests; backfill migration; server gates; UI gates; Playwright mock updates; docs.

Phase 0 verdicts: `copy-property-settings` verifies per-group property leaves in the clone run (no change). `booking-ai-review`, `validate-booking-receipts`, `social-inbox-ai-suggest`, `voice-receptionist-voice-preview` already need edit/reply-level leaves (no change). Listing badge/verification submits are owner-only (no change). Fixed a bug found on the way: the org role editor never rendered `org.analytics:*` because the org catalog had no `analytics` module.

Phase 0 sweeps (closed):

- **Newer pages**: Property routes (Bookings, Notifications, Templates, Public Pages + Page Editor under `public-pages/:pageId/edit`, Settings, Team, Inbox, Analytics, Activity) are all wrapped by `propertyRoute(section, ...)`, which checks the section's view leaf. Org routes use `orgRoute(section, ...)`. Announcements and Help are intentionally baseline for any active member. Booking import needs `bookings.import:add` (`importAccess.ts`) plus `bookingImport` on match/preview/commit. Org Setup Guide state (`setup-guide-state`) is per-org progress with no data mutation beyond dismissing steps: N/A, any org member.
- **Downgrade behavior**: `apply-org-plan-downgrade` does not rewrite member permissions. Stored leaves stay, the Team editor shows the plan pill via `TierBadge`, and every gated handler rechecks the plan on write (`requirePropertyFeature`), so a downgraded org cannot spend credits or save gated pages even if the leaf is still granted. Custom role saves are not blocked by plan for individual leaves (only `customRoles` gates role CRUD), which is the intended split.
- **Analytics AI review button**: `PropertyAnalyticsPage` already shows a refresh action guarded by `analytics.aiReview:add`.

Fixes made to reach a clean tree: removed two unused `useMemo` imports in `ParkingTeamPage.tsx` / `PropertyTeamPage.tsx` (left from earlier Team work) so `tsc` is clean, and updated three stale `marketingAiGenerate.spec.ts` tests to the current composer behavior (Video stays selectable below Business and Generate is intercepted by the plan gate; free plan keeps the composer open and Generate opens the upgrade dialog; the prompt field is addressed by `#ai-studio-prompt`).

Added tests: `teamPermissionGates.test.ts` (per-handler gate contract, 33 cases), `teamPermissionGatesLocal.integration_test.ts` (live local run: seeds a throwaway member, asserts 403 without each new leaf and non-403 with it, and Activity scoping; run with `LOCAL_GATES_LIVE=1`; `activity_log` is append-only so it reads existing rows instead of seeding), `propertyTeamPermissionCatalog.spec.ts` (Playwright: Permissions tab lists the new items), catalog reachability unit test, and a Playwright case for a role without image/video leaves.

Left as-is on purpose: `dashboard-assistant-confirm` (each confirmed tool re-verifies its own leaf); parking has no assistant leaf (assistant gives parking-only members no permissions today); the seeded Operations change applies to new properties, existing Operations rows were backfilled to preserve access.

Verification: Vitest full suite, `tsc` clean, lint 0 errors, Deno (`teamPermissionLeaves_test.ts`, `teamPermissionGates.test.ts`, existing permission tests), live local gate test, Playwright `@ci` marketing/team/org/analytics/assistant/pricing/dashboard green. Audit logging: `activity-log: N/A` for the catalog and read-gating changes (role and permission edits are already logged by the team handlers; no new mutation was added).
