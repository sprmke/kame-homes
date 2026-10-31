---
title: 'Finalize plans & billing'
status: done
tags: [workflow, billing, plans, org]
updated: 2026-08-25
stage: done
kind: plan
---

# Finalize plans & billing

Post–org-billing polish: org Team seat caps, org-aware plan badges, upgrade CTAs routed through org Plans review, and paid-plan property create requiring checkout before enrollment.

## Shipped

### Org Team seat enforcement

- `resolveOrgEntitlements`, `countOrgWideTeamSlots`, `requireOrgTeamInviteAllowed` in `_shared/planEntitlements.ts`
- Pending `organization_invitations` count toward the pooled cap (property invite path updated via shared `countPooledTeamSlots`)
- `org-team-invitations` + `org-team-members` PATCH reactivate call `requireOrgTeamInviteAllowed`; upgrade-hook JSON on limit
- Org Team UI mirrors property Team: `TierBadge`, `useFeatureGate`, client invite block + upgrade navigation

### Org-aware feature gate

- `deriveOrgEntitlementsFromPlan` + `useResolvedOrgId` — `useFeatureGate` / `TierBadge` work on org-only routes (no property in URL)

### Upgrade flow

- `UpgradeModalProvider` + **`SubscriptionUpgradeModal`** — gated actions open an inline plan review; **Continue to payment** navigates to `/org/:orgSlug/plans?reviewPlan=<planId>` (PayMongo on the Plans page)
- `OrgPlansPage` reads `?feature=` / `?reviewPlan=` / `?tab=billing` and opens `PlanReviewDialog` on the Plans tab

### Property add on paid plan

- `create-property` skips `autoEnrollPropertyInOrgSubscription` when org has live paid subscription; returns `billingRequired: true`
- `AddEntityDialog` redirects to Plans review for current plan after create
- `CurrentPlanSummary` shows uncovered-property count with **Update billing** CTA

## Related docs

- [`docs/guides/routes/org/plans.md`](../../guides/routes/org/plans.md)
- [`docs/guides/routes/org/team.md`](../../guides/routes/org/team.md)
- [`org-level-billing-migration.md`](./org-level-billing-migration.md)
