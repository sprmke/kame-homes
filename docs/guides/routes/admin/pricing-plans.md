---
title: 'Super Admin pricing plans — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-08-25
---

# Super Admin pricing plans — operator guide

Route: `/admin/pricing/plans`

> **Status:** Documented

## Progress overview

| Section       | E2E save | Validation | Docs | Notes                                        |
| ------------- | -------- | ---------- | ---- | -------------------------------------------- |
| Pricing plans | Done     | Server     | Done | Subscription tiers only (commission retired) |

---

## Overview

Super-admin CRUD surface for the **`pricing_plans`** **subscription** tier catalog (Free → Managed host ladder, plus org-bundle **Business Plus** when present). Changes affect entitlement resolution for newly assigned properties and the feature JSONB defaults hosts inherit when assigned to a plan.

**Commission pricing** is not exposed here — the catalog row is inactive and the API rejects commission create/edit/list. Schema remains for a future product (see `docs/architecture/plans-feature-matrix.md` and `docs/workflow/intake/_to-plan.md`).

**Access:** `RequireSuperAdmin` — email in `SUPER_ADMIN_EMAILS`.

**Step-up OTP:** creating or editing a plan needs a fresh email verification code (~15-min sudo window) — see [`overview.md`](overview.md#step-up-verification-all-admin-pages) / `.cursor/rules/admin-auth.mdc` §8.

---

## Behavior

- **Summary cards:** total plans, host tiers (excludes Business Plus), active plans, default plan name — from the current filtered/paginated page.
- **Toolbar:** search, status filter, table/grid view toggle (grid forced on mobile), per-page select (`AdminListPerPageSelect`). No pricing-model filter.
- Table uses shared **`AdminDataTable`** shell; grid shows plan cards with the same actions.
- **Pagination:** standard admin-list `page`/`limit` pattern — filters applied **server-side** in `pricing-plans` (always `pricing_model = 'subscription'`).
- **Edit** opens a **`ResponsiveModal`**: name, tagline, sort order, **list price**, **discount %**, **volume pricing** (ramp floor PHP/property, ramp-at property count, editable volume discount tiers with live preview at 1/5/10/50 properties), AI monthly credits, boolean feature toggles, team max members, active flag. Live preview shows the host checkout promo rate.
- Saving calls **`pricing-plans`** PATCH (`volumeDiscountTiers`, `volumeRampFloorPhp`, `volumeRampAtCount`); does not retroactively change in-flight PayMongo periods.

---

## API

| Method | Edge function   | Notes                                                                                                                                                    |
| ------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `pricing-plans` | Paginated/filtered list — `search`, `status` (`active`\|`inactive`), `page`/`limit`; **subscription rows only** (commission never returned)              |
| PATCH  | `pricing-plans` | Update subscription plan (`volumeDiscountTiers`, `volumeRampFloorPhp`, `volumeRampAtCount`, …); rejects commission plan ids / `pricingModel: commission` |

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Layer       | Path                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Page        | `ui/src/features/dashboard/super-admin/pages/SuperAdminPricingPlansPage.tsx`                                                |
| Edit dialog | `ui/src/features/dashboard/super-admin/components/super-admin-pricing/EditPricingPlanDialog.tsx`, `VolumePricingEditor.tsx` |
| Hook        | `ui/src/features/dashboard/super-admin/hooks/usePricingPlans.ts`                                                            |
| Edge        | `supabase/functions/pricing-plans/index.ts`                                                                                 |
| Shared      | `supabase/functions/_shared/planFeatures.ts`, `_shared/planPricing.ts`                                                      |

---

## Host-facing knowledge

Hosts do not use this page. They manage plans for their whole organization on the org **Plans & Billing** page (`/org/:orgSlug/plans`).
---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |
