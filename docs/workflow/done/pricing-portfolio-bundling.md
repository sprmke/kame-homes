---
title: 'Pricing tiers — portfolio bundling for Pro/Business'
status: superseded
tags: [workflow, billing, pricing, superseded]
updated: 2026-08-25
stage: done
kind: plan
---

# Pricing tiers — portfolio bundling for Pro/Business

> **Superseded 2026-08-25 by [`org-level-billing-migration.md`](../done/org-level-billing-migration.md).** The host decided to go further than this doc's org-bundle-as-optional-add-on model: billing is now org-level _only_ (no per-property `property_subscriptions` at all), priced per enrolled property with a volume-discount curve instead of a flat capped-tier price. Everything below is kept for historical context (the schema/checkout/UI this doc shipped was the direct foundation the new migration built on and then replaced pricing-wise) — for current behavior, read the superseding doc instead. Concretely: `max_properties`/`max_properties_snapshot` are dropped, `business_plus` is retired (folded into Pro's volume curve), `property_subscriptions`/`property_subscription_events`/`booking_commission_charges`/`property_payment_transactions` are all dropped, and `resolvePropertyEntitlements` no longer has a per-property fallback branch — every property either has a live org subscription or is Free.

## Status — Phases 1-4 shipped 2026-08-24 (as Phase 8 of [`tier-feature-alignment-audit.md`](./tier-feature-alignment-audit.md))

**Shipped:** Phase 1 (schema — `max_properties`, `business_plus` plan, `org_subscriptions`/`org_subscription_properties`/`org_subscription_events`/`org_payment_transactions`, applied and verified locally), Phase 2 (`resolvePropertyEntitlements` checks the org bundle first via `getActiveOrgSubscriptionForProperty`, falls back to the per-property subscription unchanged; `createOrgSubscription`/`assignPropertyToOrgSubscription`/`removePropertyFromOrgSubscription` in `_shared/planEntitlements.ts`), Phase 3 (`create-org-subscription-checkout` + `_shared/orgSubscriptionCheckout.ts` for the PayMongo link; `paymongo-webhook` dispatches org vs. property transactions via `metadata.kind`; `fulfillOrgSubscriptionPayment` activates the bundle and slots the checked-out properties), Phase 4 (new `/org/:orgSlug/plans` page — tier cards, property picker capped by `maxProperties`, checkout; per-property Plans page shows a "covered by your org's plan" banner when applicable; nav link added).

**Deviations/decisions made during implementation** (none pre-specified in this doc, so recorded here):

- **`org_payment_transactions` is a new table**, not called out in this doc's Phase 1 — `property_payment_transactions.property_id` is `NOT NULL`, so property-level checkout transactions couldn't represent an org-level purchase without a schema change to that (already-shipped) table. A parallel table was safer than loosening an existing NOT NULL constraint.
- **`sort_order` renumbering**: `business_plus` needed an integer sort position between `pro` (4) and `managed` (5) — `managed`/`commission` were bumped to 6/7 in the same migration (a companion migration, since the original `sort_order=4.5` attempt failed the column's `INT` type — caught before it ever ran).
- **Timestamp collision caught mid-phase**: the Phase 2 migration from earlier in this session (`...pricing_plan_new_feature_keys.sql`) collided on filename timestamp with an unrelated, already-applied migration from separate work in this repo. Renamed (the file was still untracked/never shipped) — see `plans-feature-matrix.md` for detail.
- **Parking's `PARKING_INTERIM_UNGATED_FEATURES` carve-out is narrowed, not removed.** `firstActivePropertyIdForOrg` (used by parking's Telegram/badge entitlement resolution) now prefers a property already covered by a live org bundle, so parking correctly inherits real org-bundle entitlements when one exists — a safe, additive fix. Full removal of the client-side interim carve-out was **not** done: orgs without any bundle still have no dedicated parking entitlement source, and changing that fallback (e.g. to Free) risked a live regression without a way to test broadly in this pass. Tracked as still-open in `plans-feature-matrix.md`.
- **Not built in this pass** (out of scope for Phase 8's stated Schema → Entitlements → Checkout/webhook → UI → Docs scope, flagged rather than silently skipped): recurring billing-cycle automation for org subscriptions (renewal reminders, past-due/suspension — `runPlatformBillingCycle` only walks `property_subscriptions` today), org-subscription receipt/payment-failed emails (property-level equivalents exist, org-level don't yet), mid-bundle plan changes / removing a property from a bundle via the UI (the server functions `assignPropertyToOrgSubscription`/`removePropertyFromOrgSubscription` exist and are ready to wire up, but no UI calls them yet — today the UI only supports first-time bundle purchase), and org-level proration (Phase 7's mid-cycle-switch proration was built for per-property subscriptions only; an org switching bundle tiers mid-cycle would need the same treatment, not yet extended here).

### Post-ship review findings — fixed 2026-08-24

A full audit pass across all 9 phases of `tier-feature-alignment-audit.md` (3 parallel independent code reviews plus direct DB/schema verification) found and fixed 4 real bugs specific to this bundling feature, on top of confirming the uniqueness/webhook-dispatch/entitlement-fallback/max-properties enforcement all worked correctly:

- **`business_plus` (bundle-only, per its own design) could actually be purchased standalone on a single property** — the `.neq('code', 'business_plus')` filter added to `property-plan`/`list-public-pricing-plans` only ever hid it from those two GET responses; it was never an authorization boundary. A property owner could take the plan `id` from `org-plan`'s GET response and POST it straight to `create-subscription-checkout`, and the super-admin override tool (`property-subscriptions-admin`) had no plan-eligibility check at all. Fixed at the actual write path: `assignPropertyToPlan` (`_shared/planEntitlements.ts`, the single function both `property-plan` POST and `property-subscriptions-admin` POST route through) now rejects `business_plus` outright, and `createPropertySubscriptionCheckoutLink` (`_shared/propertySubscriptionCheckout.ts`) rejects it before ever creating a PayMongo link.
- **`createOrgSubscription` wasn't atomic** — supabase-js REST calls aren't wrapped in a DB transaction, so a failure partway through the per-property assignment loop (e.g. a genuine race against a concurrent bundle claiming the same property, which the DB unique index correctly rejects rather than corrupting) left a live `active` org_subscriptions row covering fewer properties than were paid for, with no cleanup and the payment transaction stuck `pending` forever. Fixed: the property-assignment loop is now wrapped so any failure deletes the just-created `org_subscriptions` row (cascades via FK to its `org_subscription_properties`/`org_subscription_events` rows) before re-throwing, and `fulfillOrgSubscriptionPayment` now marks the transaction `failed` with the real error (not left `pending`) if fulfillment throws after payment was already collected.
- **Checkout-time property ownership wasn't validated until fulfillment (after payment).** `createOrgSubscriptionCheckoutLink` only checked the property count against `max_properties`, not that each property actually belonged to the requesting org or wasn't already slotted into a different bundle — a bad request would still generate a valid, payable PayMongo link, and the ownership error would only surface at webhook time, leaving the transaction stuck `pending` with money already collected. Fixed: both checks (ownership + not-already-bundled) now run at checkout-creation time too, mirroring `createOrgSubscription`'s own authoritative checks.
- Confirmed correct and not re-touched: DB-level uniqueness (`org_subscription_properties_property_unique`, `org_subscriptions_one_live_per_org_idx` partial index — not just app-level checking), webhook `metadata.kind` dispatch and double-fire idempotency, `max_properties` enforcement, and entitlement fallback when an org bundle lapses or a property is removed from one.

## Context

Two independent pricing-strategy reports (a ChatGPT report and a Cursor session) analyzed the just-shipped [Host Plans & Pricing Tiers](../done/host-plans-and-pricing-tiers.md) feature for whether the ₱15k–25k/month-net Airbnb host segment is priced fairly, and whether pricing should stay strictly per-property or shift toward portfolio bundles for multi-listing hosts.

Both reports agree the current single-listing prices (Free ₱0 / Starter ₱399 / Pro ₱799 / Business ₱1,439 promo) are well-calibrated for that ICP, and agree that per-property billing becomes painful once a host has 3–10 units (3× Business = ₱4,317/mo, 10× = ₱14,390/mo). They diverge on the fix: Cursor recommends staying per-property and softening the multi-listing cliff with a checkout discount; ChatGPT recommends restructuring into portfolio tiers with property caps (Starter=1, Pro≤3, Business≤5, plus a new Business Plus≤10).

Two things were independently verified before recommending a direction: (1) ChatGPT's cited competitor pricing (PinasBnb, TuloyPH specific numbers) could not be corroborated — search and fetch found no evidence, PinasBnb's pricing page 404s — so that evidence is unreliable and shouldn't be load-bearing; (2) the entire pricing/plans system shipped **2026-08-18** (one day before this decision), built ground-up per-property (`property_subscriptions` has a partial unique index enforcing one live subscription per `property_id`; `resolvePropertyEntitlements` takes a single `propertyId`; the route is `/org/:orgSlug/property/:propertySlug/plans`). The recommendation going in was to keep per-property billing and add a same-org multi-listing checkout discount instead of rearchitecting a 24-hour-old feature.

**The host explicitly chose to proceed with the portfolio-cap pivot anyway**, overriding that recommendation. This plan implements that chosen direction as a genuine, scoped rearchitecture rather than a cosmetic pricing tweak — a per-listing discount schedule is moot under this model since bundling replaces per-unit pricing for the affected tiers.

## Final tier ladder

Single-listing price points are unchanged (both reports agreed on these). What changes is the property cap and the introduction of org-level bundling for Pro, Business, and a new Business Plus tier. Free, Starter, Managed, and Commission remain exactly as they are today (per-property, no architecture change needed — Starter's cap is 1, which is already what a per-property subscription is).

| Tier                | Internal code   | List → Promo (20% off)                       | Property scope                              | Seats    | AI credits/mo | Search tier | Publishing |
| ------------------- | --------------- | -------------------------------------------- | ------------------------------------------- | -------- | ------------- | ----------- | ---------- |
| Free                | `free`          | ₱0                                           | per-property (unchanged)                    | existing | —             | none        | existing   |
| Starter             | `starter`       | ₱499 → ₱399                                  | per-property (unchanged, effectively cap=1) | 3        | —             | existing    | existing   |
| Pro                 | `growth`        | ₱999 → ₱799                                  | **org bundle, up to 3 properties**          | 5        | 1,000         | top-30      | 30/channel |
| Business            | `pro`           | ₱1,799 → ₱1,439                              | **org bundle, up to 5 properties**          | 10       | 10,000        | top-15      | unlimited  |
| Business Plus (NEW) | `business_plus` | ₱2,999 → ₱2,399                              | **org bundle, up to 10 properties**         | 15       | 20,000        | top-10      | unlimited  |
| Managed             | `managed`       | ₱4,999 → ₱3,999 **per property** (unchanged) | per-property (unchanged)                    | 10       | 30,000        | top-5       | unlimited  |
| Commission          | `commission`    | 8% of completed booking revenue (unchanged)  | per-property (unchanged)                    | 10       | 1,000         | top-20      | —          |

Rationale for keeping Managed/Commission per-property: both reports agree — Managed is closer to co-hosting/ops labor than SaaS, and commission is inherently a per-booking revenue share, neither fits bundling.

An org can have at most one active portfolio subscription (Pro/Business/Business Plus) at a time, covering up to the tier's `max_properties`. A property not slotted into the org's portfolio subscription defaults to Free (existing behavior) or can independently run Starter/Managed/Commission as it does today. Exceeding the cap requires upgrading to the next portfolio tier, not an à-la-carte overage add-on (matches ChatGPT's explicit reasoning against unlimited/uncapped bundles diluting margins).

## Implementation plan

### Phase 1 — Schema

New migration (after existing `20261031140000_pricing_plan_discounts.sql`):

- Add `max_properties INT` to `pricing_plans` (NULL = per-property/unbounded model as today; `growth`=3, `pro`=5; new `business_plus`=10).
- Seed new `business_plus` plan row (list ₱2,999, 20% discount → ₱2,399, `max_properties=10`, features: 15 seats, 20,000 AI credits, `searchVisibilityTier: 'top10'`, unlimited publishing, same AI toolkit as `pro`/Business).
- **`org_subscriptions`** — `id`, `organization_id UUID NOT NULL REFERENCES organizations(id)`, `plan_id UUID NOT NULL REFERENCES pricing_plans(id)` (constrained to portfolio-eligible plans: `growth`/`pro`/`business_plus`), `pricing_model`/`price_php_snapshot`/`max_properties_snapshot` (snapshot convention matches `property_subscriptions`), `status TEXT CHECK (... 'active','trialing','past_due','suspended','canceled')`, `current_period_start`/`current_period_end`. Partial unique index on `organization_id` where `status IN ('active','trialing','past_due')` — one live portfolio subscription per org (mirrors the existing `property_subscriptions_one_live_per_property_idx` pattern).
- **`org_subscription_properties`** — join table: `id`, `org_subscription_id FK`, `property_id UUID NOT NULL REFERENCES properties(id)`, unique on `property_id` (a property can only sit in one org subscription's slots at a time), `assigned_at`, `assigned_by`.
- Mirror `property_subscription_events`'s audit convention with an `org_subscription_events` table (assigned/plan_changed/property_added/property_removed/status_changed).

### Phase 2 — Entitlement resolution (`_shared/planEntitlements.ts`)

Extend `resolvePropertyEntitlements(propertyId)`:

1. Look up the property's org and check `org_subscription_properties` for a live assignment.
2. If found, resolve features/limits from the org subscription's plan (reuse the existing `PlanFeatures` JSONB shape — no new feature schema).
3. Else, fall back unchanged to the current `property_subscriptions` lookup (Free/Starter/Managed/Commission untouched).

Add `assignPropertyToOrgSubscription(orgId, propertyId, assignedBy)` / `removePropertyFromOrgSubscription(...)` / `createOrgSubscription(orgId, planId, propertyIds[], assignedBy)` alongside the existing `assignPropertyToPlan`. Enforce `max_properties` server-side on every assignment call (reject if the org subscription is already at capacity).

### Phase 3 — Checkout & PayMongo webhook

New edge function `create-org-subscription-checkout` (parallel to existing `create-subscription-checkout`): org-scoped, takes `plan_id` + selected `property_ids` (≤ cap), returns a PayMongo `checkoutUrl`. Extend `paymongo-webhook` with a branch that activates `org_subscriptions` on payment success — sets `current_period_start`/`end`, inserts the selected `org_subscription_properties` rows — mirroring how it already activates `property_subscriptions` today.

### Phase 4 — UI

- **New org-level Plans page**, e.g. `/org/:orgSlug/plans` (distinct from the existing per-property `/org/:orgSlug/property/:propertySlug/plans`, which continues to handle Free/Starter/Managed/Commission selection for an individual listing). Shows: current portfolio subscription (if any) with assigned properties, the Pro/Business/Business Plus tier ladder, a property picker (checkboxes over the org's properties, capped by the target tier's `max_properties`), and upgrade/downgrade flow reusing `PlanReviewDialog`/checkout patterns from the existing Plans page.
- **Per-property Plans page** (`PropertyPlansPage.tsx`): if the property is currently slotted into an org portfolio subscription, replace the tier-card carousel with a state banner ("Covered by your org's {Business} plan ({n}/{cap} properties) — manage at Org Plans") linking to the new org page; Free/Starter/Managed/Commission selection stays available for properties not in a portfolio.

### Phase 5 — Docs (same-change requirement per CLAUDE.md)

- `docs/guides/routes/org/property/plans.md` — add a note that Pro/Business/Business Plus can be org-bundled, with a link to the new org Plans route guide.
- New `docs/guides/routes/org/plans.md` — operator guide for the new org-level Plans page (route-guides skill conventions).
- `docs/workflow/done/host-plans-and-pricing-tiers.md` — append a note pointing to this plan as the source of truth for the portfolio-tier extension (same convention it already uses for `paymongo-subscription-billing.md`).
- `docs/PROJECT.md` — add the new route + `org_subscriptions`/`org_subscription_properties` tables to the architecture/route inventory.

### Rollout note

Since the pricing feature shipped 24h before this decision, check `property_subscriptions` for any existing paid-tier (`growth`/`pro`) assignments before deploying Phase 3. If any org already has 2+ properties on the same paid tier, that's a candidate for support-assisted migration into the new bundle (not a silent automatic switch, since it changes billing amounts) — flag for manual outreach rather than an automated backfill.

## Verification

No code exists yet — this is the decision + implementation plan. When picked up for implementation, verify per phase: Phase 1 via `bun run db:migrate` + inspecting the new tables/columns locally; Phase 2 via a direct call to `resolvePropertyEntitlements` for a property assigned to a mock org subscription; Phase 3 via a PayMongo sandbox checkout + webhook replay; Phase 4 via Playwright MCP driving the new org Plans page end-to-end (property picker, checkout, per-property banner state).

## Unblocks

- [`../in-progress/parking-property-parity.md`](../in-progress/parking-property-parity.md) — parking routes temporarily skip property-plan gates for Telegram Chat enable and the AI dashboard assistant. Closing that plan requires **org-scoped** entitlement resolution (parking is not on `property_subscriptions` today). When implementing portfolio/org billing here, extend Phase 2 or a follow-up slice so parking vertical checks org entitlements — do not leave interim ungating in `useFeatureGate` / edge handlers permanently.
