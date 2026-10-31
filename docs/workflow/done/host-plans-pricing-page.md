---
title: 'Host Plans & Pricing page — shipped'
status: active
tags: [workflow, done, billing, pricing]
updated: 2026-08-18
stage: done
kind: plan
---

# Host Plans & Pricing page — shipped

Route: `/org/:orgSlug/property/:propertySlug/plans`

## Shipped (2026-08-18)

- **Redesigned host-facing Plans page** with a tier rail (mobile/tablet) → equal-height grid (desktop), a feature comparison matrix, and a real subscription summary.
- **Current plan summary** card: plan name, status badge, price, renewal date, quick facts, and one-tap **Pay now** / **Resume payment** actions.
- **Recent payments** list pulled from `property_payment_transactions` with status badges and payment method.
- **Edge-function parity**: `property-plan` GET exposes `currentPeriodStart`, `currentPeriodEnd`, `gracePeriodEndsAt`, and `pendingCheckoutUrl`; `create-subscription-checkout` returns a PayMongo checkout link.
- **Plan change flow**: Free → real `property-plan` POST; paid → `create-subscription-checkout` then redirect to PayMongo; review dialog shows gained/lost features and payment method.
- **Accessibility**: sticky feature column, pinned group labels in the comparison matrix, touch targets ≥44px, reduced-motion-safe transitions, dark-mode compatible.
- **Route guide**: [`docs/guides/routes/org/property/plans.md`](../guides/routes/org/property/plans.md).

## What changed from the original plan

- **Paid checkout is no longer stubbed**: `paymongo-subscription-billing.md` landed ahead of this page, so the page uses the real `create-subscription-checkout` edge function and redirects to PayMongo (QRPH, Maya, online banking).
- **Compare tab added**: a scrollable feature matrix with incremental tier comparison and per-column action buttons.
- **Presentation library**: `planPresentation.ts` centralizes feature rows, tier deltas, status/price formatting, and upgrade direction so the UI, matrix, and review dialog stay consistent.

## Implementation map

| Layer         | Path                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| Page          | `ui/src/features/dashboard/plans/pages/PropertyPlansPage.tsx`             |
| Summary card  | `ui/src/features/dashboard/plans/components/CurrentPlanSummary.tsx`       |
| Tier rail     | `ui/src/features/dashboard/plans/components/PlanTierRail.tsx`             |
| Matrix        | `ui/src/features/dashboard/plans/components/PlanFeatureMatrix.tsx`        |
| Review dialog | `ui/src/features/dashboard/plans/components/PlanReviewDialog.tsx`         |
| Payments list | `ui/src/features/dashboard/plans/components/PropertyPlanTransactions.tsx` |
| API           | `ui/src/features/dashboard/plans/lib/propertyPlanApi.ts`                  |
| Presentation  | `ui/src/features/dashboard/plans/lib/planPresentation.ts`                 |
| Edge          | `property-plan`, `create-subscription-checkout`, `paymongo-webhook`       |

## Related

- Tier catalog + entitlements: [`../in-progress/host-plans-and-pricing-tiers.md`](../in-progress/host-plans-and-pricing-tiers.md)
- PayMongo billing: [`paymongo-subscription-billing.md`](./paymongo-subscription-billing.md)
- Feature gating + upgrade modal: [`feature-gating-subscription-upgrade.md`](./feature-gating-subscription-upgrade.md)
