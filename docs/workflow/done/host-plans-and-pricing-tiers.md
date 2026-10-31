---
title: 'Host pricing tiers — foundation (catalog + entitlements)'
status: in-progress
tags: [workflow, in-progress, billing, pricing]
updated: 2026-08-19
stage: done
kind: plan
---

# Host pricing tiers — foundation (catalog + entitlements)

> **2026-08-24:** Commission plan is **retired from live UI** (catalog row inactive; super-admin / host Plans / public pricing exclude it). Schema + `COMPLETED` ledger hook remain for a future full product — see `docs/architecture/plans-feature-matrix.md` § Pending: commission pricing.

> **2026-08-25:** This doc's foundation is **superseded** by [`org-level-billing-migration.md`](org-level-billing-migration.md) — billing is now org-level only. `property_subscriptions`, `property_subscription_events`, `booking_commission_charges`, `property-subscriptions-admin`, and `property-plan` (all listed as shipped below) have all been dropped/replaced; `assignPropertyToPlan`/`ensurePropertyDefaultPlan` are deleted. Kept here for history — read the org-level doc for current behavior.

## Shipped (2026-08-18)

- Migration **`20261023120000_pricing_plans_foundation.sql`** — `pricing_plans`, `property_subscriptions`, `property_subscription_events`, `booking_commission_charges`; seed 5 subscription tiers + 1 commission plan; backfill existing properties to Free.
- **`_shared/planFeatures.ts`**, **`_shared/planEntitlements.ts`** — `resolvePropertyEntitlements`, `assignPropertyToPlan`, `requirePropertyFeature`, commission recording.
- Edge functions **`pricing-plans`**, **`property-subscriptions-admin`**.
- Auto-assign Free on **`create-property`** / **`create-organization`** via **`ensurePropertyDefaultPlan`**.
- Commission hook in **`workflowOrchestrator`** on **`→ COMPLETED`**.
- Super-admin UI **`/admin/pricing/plans`**, **`/admin/pricing/subscriptions`**.

**Next plans (not this doc):** host Plans page → [`host-plans-pricing-page.md`](../done/host-plans-pricing-page.md) (**shipped**, superseded UI-wise by the org-level Plans page); feature gating → [`feature-gating-subscription-upgrade.md`](./feature-gating-subscription-upgrade.md) (**shipped**); PayMongo → [`paymongo-subscription-billing.md`](../done/paymongo-subscription-billing.md) (**shipped**, checkout/webhook code since rewritten org-level); full app-wide gating audit + server-side hardening + tier badges + upgrade-modal proration → [`tier-feature-alignment-audit.md`](../done/tier-feature-alignment-audit.md) (**shipped**); org portfolio bundling (Pro/Business/Business Plus, flat cap) → [`pricing-portfolio-bundling.md`](../done/pricing-portfolio-bundling.md) (**shipped, then superseded**); final org-level-only billing model (per-property rate × volume discount, no per-property subscription) → [`org-level-billing-migration.md`](../done/org-level-billing-migration.md) (**shipped, current model**).

## Context

Hosts currently get every feature for free with no differentiation. The business wants to introduce 5 pricing tiers per **property listing** (Free → ₱349 → ₱499 → ₱1499 → ₱3499/month), each unlocking a growing set of already-built features (verified badge, Telegram notifications, team management, AI validations, AI dashboard assistant/receptionist, marketing tools, custom pages, search-visibility boost), plus a parallel commission-based pricing option (% of completed bookings) as an alternative to the flat-fee ladder. Super admin must be able to configure/tweak this pricing without a code change.

This is one of five related, deliberately separated intake items (`docs/workflow/intake/_to-plan.md` lines 505–629):

1. **"Plans & Pricing"** — the pricing page UI + subscribe/pay end-to-end flow (separate plan, not this one).
2. **"Host plans and pricing tiers for property listings"** — **this plan.** Defines what the tiers _are_ and how they're stored/configured/queried.
3. **"Integrate paymongo..."** — `docs/workflow/planned/paymongo-subscription-billing.md`, already drafted, 0% built. Handles actual payment collection.
4. **"Allow features based on subscription plan & show payment modal"** — `docs/workflow/planned/feature-gating-subscription-upgrade.md`, drafted, 0% built. The feature-gating/paywall UX (watermarks, upgrade modals). Depends on this plan's entitlement resolver but is out of scope here.
5. **"Accurately track AI usages..."** — `docs/workflow/done/ai-usage-metering-credits-foundation.md`, Phases 1–3 shipped. Already has the AI credit ledger/quota backbone this plan plugs into, not rebuilds.

**Scope of this plan**: the tier/plan **data model**, a super-admin CRUD UI to configure tiers and their features/pricing, a **per-property plan assignment** (every listing defaults to the Free tier), an **entitlement resolver** other code can query ("does property X have feature Y"), integration with the existing AI credit-limit columns, and a commission-pricing-compatible schema with the calculation hook wired at the existing `COMPLETED` booking transition. It does **not** build: the pricing page, PayMongo checkout, paywall modals/watermarks, or the 3 newly-identified enforcement gaps (team seat caps, marketing publish counters, search-ranking boost) — those are catalogued as declared entitlements only, wired up later by intake items #1/#3/#4.

## Key existing systems this plan builds on (verified this session)

- **AI credits/quotas** — `supabase/functions/_shared/aiUsageService.ts`, `aiCreditLedger.ts`. `ai_platform_org_settings` already has `plan_tier TEXT DEFAULT 'included'` (bare label, no billing backing) plus `daily_credit_limit`/`monthly_credit_limit` (nullable = inherit global default) and a real credit wallet (`ai_platform_org_credit_wallet`/`_ledger`). This plan should **populate `plan_tier` and the credit limit columns from the assigned pricing plan**, not invent a parallel AI-limit system.
- **Booking completion hook** — `supabase/functions/_shared/workflowOrchestrator.ts`, `toStatus === 'COMPLETED'` branch (~lines 627–643), persisted via `DatabaseService.setWorkflowFields`/`updateBookingStatus` (~lines 685–693). This is the single place all bookings become `COMPLETED` (`guest_submissions.status`) — the correct hook point for commission calculation.
- **Org → Property model** — `organizations` (one owner) → `properties` (`organization_id` FK, many per org), confirmed in `supabase/migrations/20260629180000_multi_tenancy_foundation.sql`. Pricing is **per listing**, so plan assignment must key off `property_id`, not `organization_id`.
- **Super-admin patterns to reuse** — `supabase/functions/_shared/serveEdge.ts#serveSuperAdmin`, the `submit-*`/`approve-*` split used by org verification, and the `ui/src/features/dashboard/super-admin/` folder shape (`pages/SuperAdminXPage.tsx` + `components/super-admin-x/` + `hooks/useX.ts` + `lib/superAdminPaths.ts` + nav entry in `superAdminPlatformNav.ts`). `AiPlatformKillSwitchCard.tsx`/`AiCreditWalletCard.tsx` are the closest visual precedent for plan-config cards.
- **Inheritance pattern to reuse** — the `ai_platform_org_settings`/`ai_platform_property_settings` "NULL = inherit from parent" convention is the right shape for plan overrides (support cases needing a manual grant without changing the underlying plan).
- **Verification tiers are a separate concept** — `docs/workflow/for-testing/host-verification-tiers.md` (Verified/Recommended trust badges, reviewed by super admin) already exist as **eligibility gates reviewed independently of payment**. This plan does not touch that review workflow — it only gates _eligibility to apply_ for those badges by tier (a property below Level 2 shouldn't see the Get Verified CTA; below Level 3 shouldn't see Get Recommended).
- **Cross-plan note (flagged per user confirmation)**: `docs/workflow/planned/paymongo-subscription-billing.md` currently drafts its own `platform_subscription_plans`/`platform_subscriptions` tables, org-scoped. This plan's `pricing_plans`/`property_subscriptions` tables should become the source of truth instead — when PayMongo billing is picked up, it should attach payment/checkout/transaction tables to `property_subscriptions` (by `property_id`) rather than re-deriving a parallel org-scoped plan catalog. Add a short note to the top of that plan doc pointing here (Phase 4 of this plan, below).

## Data model

New migration `supabase/migrations/<ts>_pricing_plans_foundation.sql`:

- **`pricing_plans`** — the tier catalog. `id UUID PK`, `code TEXT UNIQUE` (e.g. `free`, `starter`, `growth`, `pro`, `managed`), `name TEXT` (display name, e.g. "Level 2"), `tagline TEXT` (short marketing line), `sort_order INT`, `pricing_model TEXT NOT NULL CHECK (pricing_model IN ('subscription','commission'))`, `price_php NUMERIC` (nullable — null for commission plans), `billing_interval TEXT CHECK (billing_interval IN ('month')) DEFAULT 'month'`, `commission_rate_percent NUMERIC` (nullable — only set when `pricing_model = 'commission'`, e.g. `8.00`), `features JSONB NOT NULL DEFAULT '{}'` (see Feature schema below), `is_active BOOLEAN DEFAULT true`, `is_default BOOLEAN DEFAULT false` (exactly one row should be the auto-assigned default — the Free tier), `created_at`, `updated_at`. Deactivating (not deleting) a plan preserves history for existing subscribers, same convention as the PayMongo plan doc already established.
- **`property_subscriptions`** — plan assignment, one **active** row per property. `id UUID PK`, `property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE`, `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` (denormalized for org-level rollup queries/reporting), `plan_id UUID NOT NULL REFERENCES pricing_plans(id)`, `pricing_model TEXT NOT NULL` (snapshot from plan at assignment time), `price_php_snapshot NUMERIC`, `commission_rate_percent_snapshot NUMERIC`, `status TEXT NOT NULL CHECK (status IN ('active','trialing','past_due','suspended','canceled')) DEFAULT 'active'`, `current_period_start`/`current_period_end TIMESTAMPTZ` (nullable — meaningless for Free/commission plans, populated once real billing lands), `feature_overrides JSONB` (nullable — super-admin manual grant/support override, same NULL-inherits-plan shape as `ai_platform_property_settings`), `created_at`, `updated_at`. **Unique partial index** `WHERE status IN ('active','trialing','past_due')` on `property_id` — one live subscription per listing. Snapshotting price/commission at assignment time matches the PayMongo plan doc's existing convention (a later plan price change doesn't retroactively alter an in-flight period).
- **`property_subscription_events`** — lightweight audit trail (plan changes, super-admin overrides), mirrors the `*_ledger`/`*_events` append-only convention used elsewhere (`ai_platform_org_credit_ledger`, `ai_platform_usage_events`). `id`, `property_subscription_id`, `event_type TEXT CHECK (event_type IN ('assigned','plan_changed','status_changed','override_set'))`, `previous_plan_id`, `new_plan_id`, `previous_status`, `new_status`, `note`, `created_by UUID REFERENCES auth.users(id)`, `created_at`.
- **`booking_commission_charges`** — only written for properties on a commission plan, populated at the `COMPLETED` hook. `id`, `booking_id UUID REFERENCES guest_submissions(id) ON DELETE CASCADE`, `property_id`, `property_subscription_id`, `booking_revenue_php NUMERIC` (the amount commission is computed against — reuse the existing host-net figure from `_shared/bookingFinance.ts` rather than inventing a new revenue definition), `commission_rate_percent`, `commission_amount_php NUMERIC`, `status TEXT CHECK (status IN ('pending','invoiced','paid','waived')) DEFAULT 'pending'`, `created_at`. This plan only **calculates and records** the charge (an audit ledger); actual invoicing/collection is PayMongo-plan territory later — same "schema now, collection later" split already used for `ai_platform_org_credit_wallet`.

### Feature schema (`pricing_plans.features` JSONB)

A typed catalog, not a free-form blob — define the shape in `supabase/functions/_shared/planFeatures.ts` (mirrors `aiModelRouter.ts`'s `AiFeature` enum pattern) and mirror the type on the UI side:

```ts
interface PlanFeatures {
  automatedBookingFlow: boolean;
  verifiedBadgeEligible: boolean;
  recommendedBadgeEligible: boolean;
  telegramNotifications: boolean;
  teamManagement: { enabled: boolean; maxMembers: number | null }; // null = unlimited
  searchVisibilityTier: 'none' | 'top20' | 'top10' | null;
  marketingPublishLimitPerGroup: number | null; // null = unlimited
  aiValidations: boolean;
  aiMonthlyCreditAllowance: number; // feeds ai_platform_org_settings.monthly_credit_limit
  marketingStudio: boolean;
  customPages: boolean;
  aiDashboardAssistant: boolean;
  aiReceptionist: boolean;
  aiMarketingGeneration: boolean;
  aiChatAutoReply: boolean;
  fullyManagedByPlatform: boolean; // Level 5 — platform team invited as org/property member
}
```

Seed data (one row per level, `pricing_model = 'subscription'`) plus a starting **commission** plan row (`pricing_model = 'commission'`, `price_php = NULL`, a starting `commission_rate_percent` — flag as a placeholder needing business confirmation, same as every other unconfirmed number in the AI-credits plan) with its own reasonable feature set (recommend: same features as Level 3, since a commission-based host is trading a flat fee for a cut of revenue, not for fewer features — confirm with the user before shipping seed data, don't invent silently).

## Entitlement resolver

New `supabase/functions/_shared/planEntitlements.ts`:

- `resolvePropertyEntitlements(propertyId): Promise<PlanFeatures & { planCode: string; pricingModel: 'subscription' | 'commission'; status: string }>` — loads the property's active `property_subscriptions` row (falling back to the default Free plan if none exists, e.g. for legacy properties), merges `plan.features` with any non-null `property_subscriptions.feature_overrides` (override wins per key), returns the resolved set. This is the **one function** every other plan (feature-gating paywall, pricing page, badge eligibility checks) should call — never duplicate the merge logic at a call site, same "single source" rule as `workflowOrchestrator.ts`/`statusMachine.ts`.
- `assignPropertyToPlan(propertyId, planId, assignedBy)` — creates/updates the `property_subscriptions` row, snapshots price/commission, writes a `property_subscription_events` row, and **syncs into the AI credits system**: sets `ai_platform_org_settings.plan_tier = plan.code` and `monthly_credit_limit = plan.features.aiMonthlyCreditAllowance` (reusing existing `_shared/aiUsageService.ts` setters — do not write those columns directly from a second code path). This is the concrete integration point between this plan and the already-shipped AI credits foundation.
- On property creation (find the existing property-creation edge function/service), auto-call `assignPropertyToPlan(newPropertyId, defaultPlanId, ...)` so every listing has a Free-tier row from day one — no property should ever have zero subscription rows.

## Commission calculation hook

In `_shared/workflowOrchestrator.ts`, inside the existing `toStatus === 'COMPLETED'` branch (~line 627), after computing the SD settlement fields already there: call `resolvePropertyEntitlements(propertyId)` (or a lighter `getActivePropertySubscription(propertyId)` to avoid the full feature merge) — if `pricingModel === 'commission'`, compute `commission_amount_php` from the booking's host-net revenue (reuse `_shared/bookingFinance.ts`'s existing calculation, don't reimplement) and insert a `booking_commission_charges` row in the same transaction/persist step as the existing `setWorkflowFields`/`updateBookingStatus` calls. No side effects for subscription-plan properties.

## Super-admin UI

Follow the exact `ui/src/features/dashboard/super-admin/` shape:

- `supabase/functions/pricing-plans/index.ts` (`serveSuperAdmin`) — CRUD for `pricing_plans`.
- `supabase/functions/property-subscriptions-admin/index.ts` (`serveSuperAdmin`) — list/search properties with their current plan + status, manual assign/override (mirrors `ai-platform-credit-wallet`'s manual-adjustment pattern).
- `ui/src/features/dashboard/super-admin/pages/SuperAdminPricingPlansPage.tsx` — plan table + create/edit dialog (name, code, price, pricing model, commission rate, feature toggles form driven by the `PlanFeatures` shape) + activate/deactivate. Structure mirrors `SuperAdminDevelopmentsPage.tsx`.
- `ui/src/features/dashboard/super-admin/pages/SuperAdminPropertySubscriptionsPage.tsx` — property list with plan/status columns, manual assign/override action, audit trail from `property_subscription_events`.
- Add `pricingPlans`/`propertySubscriptions` entries to `lib/superAdminPaths.ts`, route registration in `super-admin/routes/index.tsx`, nav entries in `superAdminPlatformNav.ts` (a new "Pricing" section, separate from the future PayMongo "Billing" section per the cross-plan note above).

## Docs to update (same change, per `CLAUDE.md`)

- `docs/architecture/data-model.md` — new section documenting `pricing_plans`, `property_subscriptions`, `property_subscription_events`, `booking_commission_charges`.
- `docs/architecture/edge-functions.md` — add `pricing-plans`, `property-subscriptions-admin` rows.
- `docs/PROJECT.md` — new "Pricing tiers (host plans)" section (Tables + edge functions + UI), matching the format of existing completed-module sections.
- `docs/README.md` — index row.
- Invoke the `route-guides` skill for the two new super-admin pages.
- Add a short pointer note at the top of `docs/workflow/planned/paymongo-subscription-billing.md` ("plan catalog now lives in `pricing_plans`/`property_subscriptions` from the pricing-tiers plan — reuse those, don't re-derive `platform_subscription_plans`/`platform_subscriptions`") so the next person to pick that plan up doesn't rebuild it.
- Update `docs/workflow/intake/_to-plan.md`'s 📋 entry status once this plan is saved (via the `workflow`/`workflow-sync-scratchpads` skill at execution time, not during planning).

## Verification

No automated test suite exists (per `CLAUDE.md`) — manual verification:

1. `bun run type-check && bun run lint && bun run build`.
2. Local Supabase: apply migration, `mcp__supabase__get_advisors` on the 4 new tables.
3. Seed the 5 subscription plans + 1 commission plan via the new super-admin UI; confirm exactly one `is_default = true` row exists.
4. Create a test property, confirm it auto-gets a Free-tier `property_subscriptions` row.
5. Reassign it to a paid plan via `SuperAdminPropertySubscriptionsPage`; confirm `ai_platform_org_settings.plan_tier`/`monthly_credit_limit` update accordingly (cross-check in the existing `OrgAiPlatformSection.tsx`).
6. Assign a test property to the commission plan; run a booking through to `COMPLETED` (or trigger the transition directly) and confirm a `booking_commission_charges` row is written with the correct computed amount; confirm no row is written for a subscription-plan property completing a booking.
7. Manually set a `feature_overrides` value on one property's subscription and confirm `resolvePropertyEntitlements()` reflects the override over the plan default.
