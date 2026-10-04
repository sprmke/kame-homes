import { usePropertyIdParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';
import { usePropertyEntitlements } from '@/features/dashboard/plans/hooks/usePropertyEntitlements';
import { deriveOrgEntitlementsFromPlan } from '@/features/dashboard/plans/lib/orgEntitlements';
import { isFeatureEnabled, type PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

/**
 * Property-scoped routes check that property's own entitlement; every other route (org-only
 * **and** parking, which has no property to check through) resolves the org's own live
 * subscription (or Free default) via `useOrgPlan` + `deriveOrgEntitlementsFromPlan` — the same
 * property-independent org gate the server now uses (`requireOrgFeature` in
 * `_shared/planEntitlements.ts`). Closes the `parking-property-parity.md` interim-ungate blocker:
 * parking routes used to unconditionally allow `telegramNotifications`/`aiDashboardAssistant`
 * regardless of plan tier (`PARKING_INTERIM_UNGATED_FEATURES`) — removed, parking now gates on
 * the org's real plan exactly like an org-only page already did.
 */
export function useFeatureGate(feature: PlanFeatureKey, propertyIdOverride?: string | null) {
  const routePropertyId = usePropertyIdParam();
  const propertyId = propertyIdOverride ?? routePropertyId;
  const orgId = useResolvedOrgId();
  const propertyQuery = usePropertyEntitlements(propertyIdOverride);
  const orgPlanQuery = useOrgPlan(propertyId ? null : orgId);

  const entitlements = propertyId
    ? propertyQuery.data
    : deriveOrgEntitlementsFromPlan(orgPlanQuery.data);

  const query = propertyId ? propertyQuery : orgPlanQuery;
  const isLoading = query.isLoading;

  // Plan could not be loaded even after retries: fail open. Every gate is also enforced
  // server-side, so a paying host never sees Free-plan UI during an outage, and a Free host
  // still gets the server's upgrade prompt on the action itself.
  const planUnknown = query.isError && !query.data;

  const allowed =
    planUnknown || (entitlements ? isFeatureEnabled(entitlements, feature) : false);
  const canUse = planUnknown || (!isLoading && allowed && Boolean(entitlements));

  return {
    ...query,
    allowed,
    canUse,
    entitlements,
    planUnknown,
  };
}
