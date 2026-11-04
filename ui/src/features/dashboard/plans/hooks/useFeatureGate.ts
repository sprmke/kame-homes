import { useEffect } from 'react';

import { usePropertyIdParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';
import { usePropertyEntitlements } from '@/features/dashboard/plans/hooks/usePropertyEntitlements';
import { deriveOrgEntitlementsFromPlan } from '@/features/dashboard/plans/lib/orgEntitlements';
import { resolveFeatureGateState } from '@/features/dashboard/plans/lib/featureGateState';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import { captureAppEvent } from '@/lib/posthog/capture';

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
  const { allowed, canUse, planUnknown } = resolveFeatureGateState(
    {
      entitlements,
      isLoading: query.isLoading,
      isError: query.isError,
      hasData: Boolean(query.data),
    },
    feature
  );

  // One event per surface per session: a denied gate renders on every route visit, and the
  // product question is "which locked feature did this host run into", not how many re-renders.
  useEffect(() => {
    if (query.isLoading || planUnknown || allowed) return;
    try {
      const key = 'gfm:feature_gate_reported';
      const seen = new Set<string>(JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[]);
      if (seen.has(feature)) return;
      seen.add(feature);
      sessionStorage.setItem(key, JSON.stringify([...seen]));
    } catch {
      return; // storage unavailable: skip rather than emit on every render
    }
    captureAppEvent('feature_gate_hit', { feature_key: feature });
  }, [allowed, feature, planUnknown, query.isLoading]);

  return {
    ...query,
    allowed,
    canUse,
    entitlements,
    planUnknown,
  };
}
