---
title: 'Plan tier test suite'
status: done
tags: [workflow, testing, plans]
updated: 2026-09-27
stage: done
kind: plan
---

# Plan: Plan-tier test & verification suite (cards, compare table, gates)

## Shipped (2026-09-27)

Golden tier matrix + literal expectations + `GATE_COVERAGE`, 12 new unit files, Deno gate tests, `bun run check:plan-catalog`, and `@ci` Playwright specs for `/for-hosts/pricing`, org Plans cards and Compare, review dialog, and 12 gated surfaces x 5 tiers. Verified: Vitest 3794, Deno `test:edge` 504, `test:edge:handlers` 106, plans E2E 111, `check:plan-catalog`. Six mutation checks all turned tests red.

**Deviations from the task list below**

- B3 handler tests: covered at the gate layer (`tests/planFeatureGateResolution.test.ts` stubs PostgREST, every boolean key allowed/denied per plan, Free fallback, suspended). Individual handlers are not run; `planGateCoverage.test.ts` only checks each calls its gate.
- D5: org Analytics Export CSV has no E2E (needs org-analytics mocks). D6/D7 are covered by `orgPlanReviewDialog.spec.ts`.
- E4: real gaps are pinned as passing tests plus a known-gaps list in [`plans-feature-matrix.md`](../../architecture/plans-feature-matrix.md) (not `test.fixme`): search placement unenforced, verified badge has no plan check, `activityLogExport` has no row or bullet, Managed card lacks "Unlimited team members", card vs Compare wording, org total drops at volume breakpoints.

## Context

Plans (Free, Starter, Pro=`growth`, Business=`pro`, Managed) drive what hosts see on **plan cards** (`PlanTierCard`/`PlanTierRail`), the **compare table** (`PlanFeatureMatrix`), and what is actually **gated** (client `useFeatureGate`/`FeatureGate`, server `requirePropertyFeature`/`requireOrgFeature`). The same components render on `/for-hosts/pricing` (public, via `list-public-pricing-plans`) and `/org/:orgSlug/plans` (in-app). Today almost nothing verifies that these three layers agree.

Goal: every tier, every card, every compare row and every gate has a unit test and an E2E test, so a change to a seed migration, `planPresentation.ts` or a gate fails CI instead of shipping drift.

### What exists today (verified)

- Unit (Vitest, node env, `ui/src/features/dashboard/plans/lib/`): `planPresentation.test.ts` only covers `isPlanDowngrade` + `resolveDowngradeBlockedReason` (~10 cases). `planFeatures.test.ts` covers `isFeatureEnabled`/team invite math. `planPricing.test.ts`, `planFeaturePermissions.test.ts` (good: key ↔ team-permission coverage) exist. `featureGateCopy.test.ts` and `orgEntitlements.test.ts` are **placeholder tests** (`typeof x === 'function'`).
- Edge (Deno): `_shared/planFeatures_test.ts` (only the image/video inheritance in `parsePlanFeatures`), `tests/orgPlanDowngrade.test.ts`, `tests/planEntitlementsSuspended.test.ts`.
- E2E (Playwright, mocked): only `plans/org/orgPlanCheckout.spec.ts` and `orgPlanDowngrade.spec.ts`. **Nothing** covers `/for-hosts/pricing`, the compare tab, card bullets, or any feature gate/upgrade modal.
- Vitest `include` is `src/**/*Test.ts|*.test.ts`, env `node` (see memory `vitest-cannot-run-component-tests`): **component tests must be Playwright**, and a `.test.tsx` would be silently ignored. This plan does not change that config.

### Drift risks found while exploring (each becomes a test)

1. **E2E fixture disagrees with the canonical matrix.** `ui/e2e/features/plans/shared/orgPlanHarnessShared.ts` seeds Pro credits 1000 (matrix: 5,000), Business 10,000 (matrix: 25,000), no Managed, no `aiMarketingVideoGeneration`/`analyticsInsights`/`activityLogExport`, Free has team disabled (matrix: enabled, max 1), Business sets `customPages` differently. Any test built on it proves nothing about real tiers.
2. **Card bullets are hand-written** (`PLAN_TIER_CARD_GAINS` in `planPresentation.ts`: "Up to 3 team members", "5,000 AI credits per month", "Top 30 search placement") and separate from `PLAN_FEATURE_ROWS`, which derives from real `features`. Nothing checks they agree.
3. **`activityLogExport` (Starter+) has no compare row and no card bullet**, unlike every other shipped key. Either intentional (needs an explicit exemption + reason) or a gap to fix.
4. **Legacy `top20`/`top10` search tiers** are remapped in labels/ranks; only a test pins this.
5. `ui/.../planFeatures.ts` is a hand-mirror of `supabase/functions/_shared/planFeatures.ts` (no drift check on keys/defaults/labels).
6. Tier assignments live in SQL seed migrations; the TS side has no golden copy to compare against.

## Approach

One **golden tier matrix** as single source of truth for tests, consumed by unit tests, the E2E harness and a DB-check script:

- New `ui/src/features/dashboard/plans/lib/planTierGolden.ts` (test-only data, imported by tests only): per tier `code`, display name, per-property price, discount, effective price, volume curve, sort order, active flag, and the full `PlanFeatures` object. Values transcribed from `docs/architecture/plans-feature-matrix.md` and the seed migrations, with the migration filename cited per value. `commission`/`business_plus` marked retired.
- E2E `PLANS_E2E_CATALOG` is rebuilt from the golden data (replaces hand-built `starterFeatures()`/`growthFeatures()`), adding a Managed plan. Existing checkout/downgrade specs must keep passing (they reference `PLAN_STARTER`, `PLAN_GROWTH`, etc.; adjust credit assertions only if they rely on the old numbers).
- New `scripts/check-plan-catalog.ts` (run via a `bun run check:plan-catalog` script): reads `pricing_plans` from the linked local (or dev) Supabase and diffs against the golden data. This is the only check that catches "migration changed but golden/UI not updated" and vice versa. Local/dev only, never prod.

## Task list

### A. Unit tests (Vitest, node) — `ui/src/features/dashboard/plans/lib/`

A1. **Golden vs. catalog (`planTierGolden.test.ts`)**: golden keys == `Object.keys(DEFAULT_PLAN_FEATURES)`; each tier's features parse via a TS mirror of `parsePlanFeatures`; tier ladder is monotonic (each higher tier ⊇ lower tier for boolean features, non-decreasing numeric ones, except documented exceptions).

A2. **Per-tier entitlement tests (`planTierEntitlements.test.ts`)**: `describe.each` over Free / Starter / Pro / Business / Managed; for every `PlanFeatureKey`, `isFeatureEnabled(features, key)` equals the golden expectation. Explicit boundary cases: team caps (1/3/5/10/unlimited via `canInviteTeamMember`), `searchVisibilityTier` (none/none/top30/top15/top15), `marketingPublishLimitPerGroup` (0/0/0/unlimited/unlimited), credit allowance (0/0/5000/25000/60000).

A3. **Compare-table rows (`planFeatureRows.test.ts`)**: for each `PLAN_FEATURE_ROWS` row × each tier assert `value()` (`on`/`off`/`text`) and `rank()` monotonic; text formats ("Up to 3", "Unlimited", "5,000 / mo", "Top 30", legacy `top20`→"Top 30", `top10`→"Top 15", "N / channel"); every `PlanFeatureKey` has a row **or** an entry in an explicit `MATRIX_EXEMPT` map with a reason (`customPages`, `activityLogExport` decision from risk 3, others). Fails when a new key is added without a decision (same pattern as `planFeaturePermissions.test.ts`).

A4. **Matrix grouping (`planFeatureMatrixGroups`)**: group order equals `PLAN_FEATURE_GROUP_ORDER`; baseline rows land in the right module; Starter row `starter-pricing` shown from `minSortOrder` 2; Managed-only rows appear only when a Managed plan is in the list; rows whose every tier is `off` are dropped; empty groups removed.

A5. **Card bullets vs. entitlements (`planTierCardGains.test.ts`)**: for each tier, every `PLAN_TIER_CARD_GAINS[tier]` bullet that maps to a feature row is true for that tier and false for the tier below (numbers parsed and compared with the golden: "Up to N team members", "N AI credits per month", "Top N search placement"); no bullet promises a feature the tier lacks; every feature gained vs. the previous tier appears as a bullet (or is exempt with a reason); `buildPlanTiers` returns tiers in `sortOrder`, marks current/upgrade/downgrade, hides inactive `business_plus`/`commission`.

A6. **Feature changes (`planFeatureGains`/`planFeatureLosses`/`resolveUpgradeCelebrationGains`/`planCapabilityCount`)**: Free→Starter, Starter→Pro, Pro→Business, Business→Starter (losses), Managed→Free; counts monotonic; no gain/loss for equal features.

A7. **Upgrade routing**: `resolveMinimumPlanForFeature`, `resolveUpgradePlanForFeature`, `resolveGateBadgePlan`, `nextUpgradePlan` return the golden minimum tier for **every** feature key (table-driven, so a Pro+ feature never routes to Starter); `upgradeBannerActionLabel`, `planActionLabel`, `planSelectButtonVariant`, `isManagedSalesPlan`, `RECOMMENDED_PLAN_CODE`.

A8. **Pricing (`planPricing.test.ts` extension)**: `planPrice` and `computeOrgSubscriptionTotalPhp` for each tier at property counts 1, 9, 10, 20, 50, 100, 300 against golden volume curves; promo discount 20% then volume; `planDiscountLabel`; PHP formatting; Free = 0; Managed shows quoted/contact price, not a computed total.

A9. **Display copy**: `planDisplayName`, `PLAN_CODE_DISPLAY_NAME` (code `growth` shows "Pro", `pro` shows "Business"), `PLAN_PROMO_BADGE`, `planTierPitch`, `planQuickFacts`, `PLAN_FAQ_ITEMS` non-empty and free of em dashes (repo copy rule).

A10. **Replace placeholder tests**: real `featureGateCopy.test.ts` (every `PlanFeatureKey` has copy with title + body, no em dash) and `orgEntitlements.test.ts` (`deriveOrgEntitlementsFromPlan` per tier).

A11. **Client↔server catalog parity (`planFeaturesParity.test.ts`)**: read `supabase/functions/_shared/planFeatures.ts` as text (same technique as `planFeaturePermissions.test.ts`) and assert the key list and default values match the UI mirror and `PLAN_FEATURE_LABELS` covers all keys.

A12. **Gate coverage audit (`planGateCoverage.test.ts`)**: scan `ui/src` and `supabase/functions/**/index.ts` for `useFeatureGate`/`feature=`/`openUpgradeModal`/`require*Feature` usages; every `PlanFeatureKey` must appear in a `GATE_COVERAGE` map as `{ client: [...paths], server: [...functions] }` **or** `{ na: reason }` (e.g. `verifiedBadgeEligible` is display-only). Catches a new key with no gate and a gate on an unknown key. Seed the map from the audit results below.

### B. Edge tests (Deno) — `supabase/functions/_shared/` and `functions/tests/`

B1. Extend `planFeatures_test.ts`: `parsePlanFeatures` for each golden tier's JSON (round-trip equals golden), missing/garbage keys fall back to `DEFAULT_PLAN_FEATURES`, unknown `searchVisibilityTier` handling, `teamManagement` null max = unlimited.

B2. `planEntitlements` / `requirePropertyFeature` / `requireOrgFeature`: allowed and denied outcome for every gated key on the lowest entitled tier and the tier just below (table-driven with a stub supabase client); error shape from `catchPlanFeatureError` (status 402/403 and `feature` code the UI expects); suspended/past-due behaviour (extend existing suspended test to all tiers); enrolled vs. non-enrolled property resolves to Free.

B3. Handler-level gate tests for the most valuable server gates (use `test:edge:handlers` pattern): `calendar-sync-settings` write (Starter denied, Pro allowed, GET ungated), `smart-pricing-settings/preview/apply`, `analytics-ai-review` POST, `activity-log-export`, `generate-marketing-media` (image vs. video keys), `copy-property-settings` real copy vs. dryRun, `dashboard-assistant-chat`, `meta-*` channel, team invite cap on Free/Starter/Pro/Business.

B4. `list-public-pricing-plans` serializer: returns only active subscription plans, excludes `commission` and `business_plus`, ordered by `sort_order`, features parsed.

B5. `apply-org-plan-downgrade` / `orgPlanDowngrade.test.ts`: extend to every downgrade edge (Managed blocked, Business→Pro, Pro→Starter, →Free) verifying what gets deactivated (team seats over cap, gated settings).

### C. DB / migration consistency

C1. `scripts/check-plan-catalog.ts` + `bun run check:plan-catalog`: query `pricing_plans` (local `db:reset` state or hosted dev) and compare code/name/price/discount/volume tiers/sort_order/is_active/features against `planTierGolden.ts`; non-zero exit on any difference with a readable diff. Documented in `scripts/README.md`.

C2. Optional CI step (later): run C1 against a fresh local Supabase in a separate job; not added to `ci.yml` in this pass because CI has no DB service.

### D. E2E (Playwright, mocked, `ui/e2e/features/plans/`)

Harness: rebuild `orgPlanHarnessShared.ts` catalog from the golden data (D0), add `installPublicPricingMocks(page)` for `list-public-pricing-plans`, and `installPropertyEntitlementsMock(page, tierCode)` returning entitlements for a chosen tier so gate specs can run on each tier.

D0. Harness rewrite + a sanity spec asserting the mocked catalog equals golden (guards risk 1). Existing checkout/downgrade specs re-run green.

D1. **`plans/public/forHostsPricing.spec.ts`** (`@ci`): `/for-hosts/pricing` renders Free, Starter, Pro, Business, Managed cards in order; each card shows display name, price ("Free", ₱399, ₱799, ₱1,439, contact for Managed), promo badge, "Recommended" on Pro; every golden bullet visible on its card; Managed CTA goes to contact with the inquiry subject, other CTAs go to `/for-hosts/login`; commission and Business Plus are absent; loading skeleton and error/retry state; 375/768/1024 layout (no horizontal scroll, use `layoutAssertions.ts`).

D2. **`plans/org/orgPlansCards.spec.ts`**: for each current tier (Free, Starter, Pro, Business, Managed) the Plans tab marks "Current plan" on the right card, other cards show Upgrade/Downgrade/Contact correctly, Managed current plan blocks downgrade, past-due and suspended states.

D3. **`plans/shared/planCompareTable.spec.ts`** (runs on both `/for-hosts/pricing` and `/org/:slug/plans?tab=compare`): iterate the golden matrix; for every group header and every row assert the cell for each tier (check icon, dash, or exact text such as "Up to 5", "Unlimited", "5,000 / mo", "Top 15", "10 / channel" where applicable); group order matches `PLAN_FEATURE_GROUP_ORDER`; baseline rows are checks on all tiers; managed-only rows only in the Managed column; mobile layout at 375px (horizontal scroll container or stacked view, sticky tier header) usable.

D4. **`plans/org/planCardsMatchCompare.spec.ts`**: read the bullets from each card and the check/text cells from the compare table on the same page; assert every card bullet has a matching compare cell that is "on" for that tier (cross-check for risk 2).

D5. **`plans/gates/featureGates.spec.ts`** (table-driven over the gate map from A12): for each client-gated feature, load the relevant dashboard route on the tier just below the minimum and assert the upgrade modal opens (or the `TierBadge` shows) naming the correct minimum tier; on the minimum tier assert the action proceeds with no modal. Covers, at minimum: Team invite cap and custom roles, quick replies, advanced templates, finance/maintenance export, booking import, Telegram, calendar sync, Smart Pricing, copy property settings, analytics export, activity-log CSV export, Content Studio, AI image/content/video generation, Meta publishing, Meta chat channel, AI auto-reply, AI assistant, AI receptionist, public pages autosave and showcase, recommended badge.

D6. **`plans/org/upgradeFlowPerTier.spec.ts`**: Free→Starter, Starter→Pro, Pro→Business review dialog lists exactly the gained features from `planFeatureGains` (compare against golden), the celebration modal after a successful upgrade lists the new features, downgrade dialog lists losses and the Business→Starter case; volume-discount pricing line changes with the enrolled property count (1, 10, 50).

D7. **`plans/org/planUpgradeCta.spec.ts`**: `SubscriptionUpgradeModal` copy per feature (from `featureGateCopy`), "Upgrade" navigates to the org Plans tab with the right plan preselected.

### E. Verification audit before writing tests (read-only checks, output = fixes list)

E1. Diff golden vs. seed migrations vs. `plans-feature-matrix.md` and note any conflicting values (the doc itself has internal inconsistencies, e.g. `commission` rows, `20261212120000` autosave move).
E2. Decide risk 3 (`activityLogExport` row/bullet) and the `customPages` exemption; if a row is added, follow `.cursor/rules/documentation-maintenance.mdc` (`for-hosts` guide + `org/plans.md`).
E3. Build the `GATE_COVERAGE` map: for each of the 32 `PlanFeatureKey`s list client gate, server gate, or N/A. Known server-gate counts from grep show several keys with **no** `require*Feature` call (e.g. `marketingStudio`, `aiMarketingImageGeneration` goes through `requirePropertyPermissionAndFeature`); confirm each is protected or record it as a real gap to fix.
E4. Any real bug found (a gate missing server-side, a card bullet lying) is fixed in the same change or filed as a GitHub issue; the test asserting it stays `test.fixme` with the issue number rather than being weakened.

### F. Docs and hygiene (required by CLAUDE.md)

- `docs/architecture/plans-feature-matrix.md`: add a "Tests" section (golden file, how to update it when a tier changes, the new `check:plan-catalog` command).
- `docs/guides/routes/for-hosts.md`, `docs/guides/routes/org/plans.md`: only if E2 changes visible rows.
- `.cursor/rules/plans-and-permissions.mdc` + `.agent/skills/plans-and-permissions/SKILL.md`: add "update `planTierGolden.ts` and let A3/A12 fail you" to the new-feature checklist.
- `.cursor/rules/testing.mdc` / `testing` skill: mention the plan suite.
- Persist this plan to `docs/workflow/planned/plan-tier-test-suite.md` and add a row to `docs/workflow/planned/README.md` as the first step after approval (plan mode blocks writing it now).
- No audit-log or Plans/RBAC entitlement change (test-only), so `activity-log: N/A — tests and docs only`; plans-and-permissions: N/A (no new gated capability).

## Suggested order

1. E1-E3 audit → fixes list. 2. Golden file (A1). 3. Pure-logic unit tests A2-A12 (fast, biggest safety win). 4. Deno tests B1-B5. 5. `check:plan-catalog` (C1). 6. Harness rewrite (D0). 7. E2E D1-D7. 8. Docs (F).

## Critical files

- Modify: `ui/e2e/features/plans/shared/orgPlanHarnessShared.ts`, `ui/src/features/dashboard/plans/lib/planPresentation.test.ts`, `planPricing.test.ts`, `featureGateCopy.test.ts`, `orgEntitlements.test.ts`, `supabase/functions/_shared/planFeatures_test.ts`, `supabase/functions/tests/orgPlanDowngrade.test.ts`, `package.json` (script).
- Create: `ui/src/features/dashboard/plans/lib/planTierGolden.ts` and the new `*.test.ts` files above, `ui/e2e/features/plans/public/`, `plans/gates/`, `plans/shared/planCompareTable.spec.ts`, `scripts/check-plan-catalog.ts`.
- Reuse: `planPresentation.ts` exports (`PLAN_FEATURE_ROWS`, `planFeatureMatrixGroups`, `buildPlanTiers`, `planFeatureGains`), `planFeaturePermissions.test.ts` source-scan pattern, existing checkout harness helpers (`installPlansE2eSession`, `fulfillJson`, `organizationList`, `orgAccessPayload`), `ui/e2e/shared/layoutAssertions.ts`.

## Verification

- `bun run test` (new unit files run under the node project; confirm none are `.test.tsx`).
- `bun run test:edge` and `bun run test:edge:handlers`.
- `bun run test:e2e:ci` plus targeted `cd ui && bunx playwright test features/plans`.
- `bun run check:plan-catalog` against local Supabase after `bun run db:reset`.
- Mutation check, to prove the tests bite: flip one Pro feature in a seed value, one bullet in `PLAN_TIER_CARD_GAINS`, and remove one `requirePropertyFeature` call; each must turn a specific test red. Revert afterwards.
- `bun run lint`, `type-check`, `check:filenames`, `bun run ci:quality`.
