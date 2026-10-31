---
title: 'Org-level billing & per-property volume-discount pricing'
status: done
tags: [workflow, billing, pricing, plans, org]
updated: 2026-08-25
stage: done
kind: plan
---

# Org-level billing & per-property volume-discount pricing

## Context

Billing moved from per-property (`property_subscriptions`, one plan per property) to **org-level only** — a single `org_subscriptions` row per org, priced per enrolled property with a volume-discount curve, replacing both the primary per-property plan system and the [org portfolio bundling](./pricing-portfolio-bundling.md) add-on that briefly sat alongside it (flat capped-tier bundles, ≤3/≤5/≤10 properties). The host explicitly wanted this: "we should not have a Plans & Billing module tied to per property."

Before planning, competitive research (Guesty, Hostaway, Lodgify, Hospitable, OwnerRez) found a consistent pattern: every one of them prices **per-property/per-listing, with the per-unit rate dropping at volume breakpoints** — the plan tier sets the feature set and base rate, not the property count, and none of them uses a hard "up to X properties" cap. That's the model this migration implements, replacing the org-bundle add-on's flat-cap approach.

Three decisions were confirmed with the host up front:

1. **Pricing**: per-property rate × selected property count, discounted by a volume curve (not a hard cap).
2. **Quantity-limited features pool org-wide**: team seats and marketing publish limits are shared across all of an org's _enrolled_ properties, not separate per-property allotments. (AI credits turned out to already be correctly pooled — see Decisions.)
3. **Clean cutover**: no live paying customers, so the old per-property billing tables/code were dropped outright — no data migration or dual-write period.

A fourth decision, made during planning: **Business Plus is retired**, deactivated (not deleted) and folded into Pro's own volume curve rather than kept as a separate "many properties" tier — it existed only to approximate what a real volume curve now does natively.

Full design reasoning lives in the approved plan (session-local at the time, not committed as a separate doc) — this doc is the shipped record.

## Decisions made during planning

- **Business Plus retired**, folded into Pro's volume curve (confirmed with host). Deactivated (`is_active = false`) rather than deleted, matching how the already-retired `commission` plan was handled.
- **Volume discount curve lives per-tier** (`pricing_plans.volume_discount_tiers` JSONB column), not one global curve.
- **Managed stays sales-assisted**: its `org_subscriptions.price_php_snapshot` is entered manually by a super-admin via `feature_overrides`/direct override, not computed from the formula.
- **Mid-cycle property removal**: credits the remaining period's value toward the _next_ renewal charge, never an instant refund — the same "never below ₱0, never a cash refund" rule `subscriptionProration.ts` already enforced for tier downgrades.
- **Property-scoped "billing moved to org" pointer**: the property sidebar's existing "Plans & Billing" nav item now points at the org Plans page instead of a (now-deleted) property route, rather than adding a new banner elsewhere.
- **AI credits needed no change** — corrected mid-implementation. Initial research (a background exploration pass) suggested consumption was checked per-property independently against the org's limit, implying a multi-property org could use up to N× its nominal allowance. Direct code tracing disproved this: `assertOrgAndPropertyAiQuota` in `_shared/aiUsageService.ts` always checks the **org-wide aggregate** (`getOrgAiUsageSummary`, summed from `ai_platform_usage_daily` which every property's calls increment) _first and unconditionally_, before any property-level check. The org check is a hard ceiling no property can bypass; the property-level check underneath it is a legitimate, intentional _additional_ per-property sub-limit (for a host who wants to cap one property's spend below the org total), not a redundant loophole. Left untouched.

## Shipped

### Schema

Three migrations: `20261115120000_org_level_billing_migration.sql` (core), `20261115120100_org_subscriptions_feature_overrides.sql`, `20261115120200_drop_property_payment_transactions.sql` (dropped once its last reference — `propertySubscriptionCheckout.ts` — was removed).

- `pricing_plans`: added `volume_discount_tiers JSONB` (array of `{minProperties, discountPercent}`, ascending, CHECK'd as an array). `price_php` is repurposed in meaning only (no column change) — it's now every tier's per-property monthly rate, not a flat plan price. `discount_percent` unchanged (still the flat promo markdown, applied before the volume curve). Dropped `max_properties` — no cap in the new model. `business_plus` deactivated.
- `org_subscriptions`: dropped `max_properties_snapshot`; added `grace_period_ends_at` (billing-cron grace tracking, mirrors what `property_subscriptions` had) and `feature_overrides JSONB` (override escape hatch, mirrors what `property_subscriptions` had — used e.g. for Managed's manually-quoted price).
- **Dropped outright**: `property_subscriptions`, `property_subscription_events`, `booking_commission_charges`, `property_payment_transactions`. Verified directly against the local Postgres instance (PostgREST correctly 404s each; `pricing_plans`/`org_subscriptions` schema changes confirmed via direct query).

### Shared pricing math

`_shared/planPricing.ts` (+ byte-for-byte client mirror `ui/.../plans/lib/planPricing.ts`) gained `VolumeDiscountTier`, `normalizeVolumeDiscountTiers`, `resolveVolumeDiscountPercent`, `computeOrgSubscriptionTotalPhp(pricePerPropertyPhp, volumeDiscountTiers, propertyCount)` — layers the volume discount on top of the promo-discounted rate × count, reusing `discountedPlanPricePhp`'s floor-to-whole-peso rule so client preview and server never round differently. Same client-preview/server-authoritative split this repo already uses for proration.

### Entitlement resolution

`_shared/planEntitlements.ts` — full rewrite. `resolvePropertyEntitlements(propertyId)` **keeps its exact signature** (the ~20 call sites across the codebase needed zero changes) but the body simplified to org-subscription-only, Free fallback — the `?? getActivePropertySubscription(propertyId)` branch is gone. Selective enrollment is preserved: `org_subscription_properties` is unchanged, so a property left out of the org's subscription still resolves to Free even while sibling properties are covered.

New `entitlementPoolPropertyIds(propertyId)` (private): every property sharing a _live_ org subscription with the given property, or just that property alone if unenrolled — mirrors `resolvePropertyEntitlements`'s own resolution exactly, so "which pool is this property in" can never disagree with "which plan is this property on." Used by:

- `countOrgTeamSlots` (renamed from `countPropertyTeamSlots`) — sums active `property_members` + pending invites across the whole pool, not one property. Also fixed two pre-existing bugs found while touching this: it queried a nonexistent table (`property_team_invitations` instead of the real `property_invitations`, breaking every invite on a finite-limit plan), and it didn't count the owner/org-admin virtual seats the client's equivalent already did (a client/server mismatch a direct request could exploit).
- `reconcileTeamSeatsForProperty` (renamed from `reconcilePropertyTeamSeats`, shipped in an earlier session) — now reconciles the whole pool's `property_members` against the pool's shared budget, not one property's. Deactivation/reactivation ordering (newest-out-first, oldest-back-first, `plan_limited` flag) unchanged.
- `countMarketingPublications` — sums published posts across the pool instead of one property.

New `getActiveOrgSubscription(organizationId)` — resolves an org's live subscription with no property involved at all (used by the super-admin surface and available for future org-native lookups elsewhere, e.g. parking — see `parking-property-parity.md`).

New `changeOrgSubscription(orgSubscriptionId, newPlanId, newPropertyIds, changedBy)` — the mid-cycle "add/remove properties and/or switch tiers" path, diffing `org_subscription_properties`, updating `plan_id`/`price_php_snapshot`, writing events, and reconciling seats once for the changed pool.

**Adjacent gap closed in the same pass**: `updatePropertyTeamMember`'s manual-reactivate path had no seat-cap check at all (a second, ungated path to the same limit an invite is blocked from reaching) — now runs the same `requireTeamInviteAllowed` check; `property-team-members/index.ts`'s PATCH handler also gained `catchPlanFeatureError` so this surfaces the standard upgrade prompt instead of a raw error.

Deleted: `getActivePropertySubscription`, `assignPropertyToPlan`, `ensurePropertyDefaultPlan`, `recordBookingCommissionChargeIfApplicable` (already dead since commission pricing was retired earlier). Their callers (`create-property`, `create-organization`'s first-property seed, `workflowOrchestrator.ts`'s booking-COMPLETED commission-charge call) had the calls removed outright — a newly created property with no org subscription simply resolves to Free, nothing to assign.

Also deleted the wholly-unused `_shared/subscriptionAccess.ts` (a "dashboard restriction when billing is suspended" helper with zero callers anywhere in the codebase, and a latent bug of its own — its status-lookup query excluded `suspended`, so its one meaningful check could never actually fire).

### Checkout & proration

`_shared/orgSubscriptionCheckout.ts` — full rewrite. `createOrgSubscriptionCheckoutLink` drops the cap checks; price is `computeOrgSubscriptionTotalPhp(rate, volumeDiscountTiers, propertyCount)`. Now handles first purchase, renewal, _and_ mid-cycle changes in one function — detects a genuine change (different plan and/or property set vs. the org's current live subscription) and reuses the existing `computeMidCycleProration` unchanged (it already just takes an arbitrary `targetPricePhp`, indifferent to what produced it).

`_shared/subscriptionOrchestrator.ts` — full rewrite, org-only. `fulfillOrgSubscriptionPayment` detects fresh-vs-change by checking whether the org already has a live subscription, calling `createOrgSubscription` or `changeOrgSubscription` accordingly; a genuine change starts a fresh billing period, a same-plan-same-properties renewal extends from remaining time. `runPlatformBillingCycle` now walks `org_subscriptions` (was `property_subscriptions` only, a known gap from the org-bundle-add-on era) — full renewal-reminder → past-due → suspended lifecycle, with suspension reconciling team seats for every property that was enrolled (each now individually falls back to Free). New `adminExtendOrgSubscription`.

New org-scoped billing emails in `_shared/subscriptionBillingEmail.ts` (`sendOrgSubscriptionReceiptEmail`/`RenewalReminderEmail`/`PastDueEmail`/`SuspendedEmail`/`PaymentFailedEmail`) — org name + enrolled property count instead of one property's name.

### Super-admin surface

`property-subscriptions-admin` → `org-subscriptions-admin` (edge function renamed, full rewrite): lists/searches organizations instead of properties, manual assign defaults to enrolling every property the org owns (no per-property picker in this admin tool — that's the host-facing org Plans page's job) unless `propertyIds` is passed explicitly, supports an `overridePricePhp` field for Managed's manually-quoted price. UI: `SuperAdminPropertySubscriptionsPage`/`Table`/`Card`/`SummaryCards`/`Toolbar` → `SuperAdminOrgSubscriptions*` (renamed, same structure).

### UI

`OrgPlansPage.tsx` (`/org/:orgSlug/plans`, unchanged route) — full rewrite. Tier rail stays visible and editable even after purchase; selecting a tier reveals a property checklist (no cap) with a live running total computed client-side via the mirrored pricing function; "Save changes"/"Continue to payment" opens `PlanReviewDialog` for a final review (with proration when it's a genuine change) before anything is charged. Same Plans/Compare/Billing tab structure the deleted property page used, reusing `PlanFeatureMatrix`/`PlanBillingPanel`/`PlanFaqSection`.

`PlanReviewDialog.tsx` generalized: gained a required `propertyCount` prop; internal pricing swaps from `discountedPlanPricePhp` to `computeOrgSubscriptionTotalPhp`; shows "N properties enrolled at ₱X/property each" alongside the total.

`PropertyPlansPage.tsx` and its whole dependency chain deleted (`propertyPlanApi.ts`, `usePropertyPlan.ts`, its route, `PropertyPlanTransactions.tsx`) — the backend it depended on (`property-plan`, `create-subscription-checkout` edge functions, `propertySubscriptionCheckout.ts`) is gone. `planPresentation.ts` (781 lines, the shared tier-comparison/pricing-copy layer used by the dashboard Plans UI, the upgrade modal, `TierBadge`, and the public `/for-hosts/pricing` marketing page) retyped from `PropertyPlanDto`/`PropertySubscriptionDto` to `OrgBundlePlanDto`/`OrgSubscriptionDto` — the two type shapes were already identical, so this was a mechanical rename, not a redesign. `planPrice()`'s per-property-rate branch now suffixes `/property/mo` instead of `/month` (a locked-in subscription total, via `chargedPricePhp`, still shows `/month` — that's a real whole-org total, not a per-unit rate).

`TierBadge.tsx` and `SubscriptionUpgradeModal.tsx` (both used from property-scoped surfaces across the app to show/act on a feature gate) re-pointed from the deleted `usePropertyPlan()` to `useOrgPlan(useOrgIdParam())`. The upgrade modal's confirm action now enrolls the current property into the org's subscription (alongside whatever else is already enrolled) at the target tier, instead of assigning a plan to just that one property.

`RequirePropertySubscriptionAccess.tsx` (the route guard behind every property-scoped admin page, wraps `propertyRoute()` in `guards.tsx`) — re-pointed from the deleted `usePropertyPlan()` to `usePropertyEntitlements()` (already correctly reflects the org's suspension status via the rewritten `resolvePropertyEntitlements`), and its redirect target from the deleted property `/plans` route to the org Plans page. The property sidebar's "Plans & Billing" nav item now links straight to `orgPlansPath(orgSlug)`.

## Residual scope, documented not silently dropped

- **No volume-discount-tier editor UI** in the super-admin `EditPricingPlanDialog` yet — the API (`pricing-plans` POST/PATCH) accepts `volumeDiscountTiers` and the GET response includes it, so a super-admin can tune breakpoints via a direct API call today; a JSON-array editor field in the dialog is a small, self-contained follow-up.
- **Parking's entitlement resolution is unaffected** — see the note added to [`parking-property-parity.md`](../in-progress/parking-property-parity.md). The new `getActiveOrgSubscription(organizationId)` is a building block for a future property-independent parking entitlement lookup, but wiring that up was out of scope here (this migration was scoped to property billing).
- **`org-subscriptions-admin`'s manual-assign has no per-property picker** — it enrolls every property the org owns by default (or an explicit list via `propertyIds` if the caller passes one). The host-facing org Plans page has the full picker; the admin tool intentionally stayed minimal.
- **Exact volume-discount breakpoints are placeholders** (`3+ properties: -10%`, `6+: -20%`, seeded uniformly across Starter/Growth/Pro/Managed) — a marketing/pricing call for the host to tune later, not a mechanism gap.

## Verification

Migrations applied and schema verified directly against the local Postgres instance (PostgREST round-trips confirming `volume_discount_tiers` present on `pricing_plans`, `business_plus` deactivated, `grace_period_ends_at`/`feature_overrides` present on `org_subscriptions`, and `property_subscriptions`/`property_subscription_events`/`booking_commission_charges`/`property_payment_transactions` all correctly gone). Full `type-check`/`lint`/`build` clean. Every one of the ~30 files importing from `planEntitlements.ts`/`subscriptionOrchestrator.ts`/`orgSubscriptionCheckout.ts` cross-checked by hand against the new export lists (no local Deno type-checker available, same constraint every other Deno-side phase in this repo's history has documented) — zero missing-import mismatches found.

Not yet done: a live PayMongo sandbox checkout run (create + change + renewal), and a Playwright-driven pass through the new `OrgPlansPage` end-to-end. Recommended before this is exercised with real payment data.

## Related docs

- [`pricing-portfolio-bundling.md`](./pricing-portfolio-bundling.md) — the superseded org-bundle-add-on this migration replaced.
- [`host-plans-and-pricing-tiers.md`](./host-plans-and-pricing-tiers.md) — the original per-property foundation.
- [`tier-feature-alignment-audit.md`](./tier-feature-alignment-audit.md) — the feature-gating audit whose Phase 11 (team-seat downgrade reconciliation) this migration generalized from per-property to org-wide pooling.
- [`../../architecture/plans-feature-matrix.md`](../../architecture/plans-feature-matrix.md) — canonical feature × tier reference, updated in the same change.
