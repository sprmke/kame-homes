import {
  isFeatureEnabled,
  type PlanFeatureKey,
  type PlanFeatures,
} from '@/features/dashboard/plans/lib/planFeatures';

export type FeatureGateQueryState = {
  entitlements: PlanFeatures | null | undefined;
  isLoading: boolean;
  isError: boolean;
  /** The plan query returned data at least once (a refetch error keeps the last good plan). */
  hasData: boolean;
};

export type FeatureGateState = {
  allowed: boolean;
  canUse: boolean;
  /** The plan could not be loaded even after retries. */
  planUnknown: boolean;
};

/**
 * Gate decision behind `useFeatureGate`. When the plan cannot be loaded we fail open: every
 * gate is also enforced server-side, so a paying host never sees Free-plan UI during an outage,
 * and a Free host still gets the server's upgrade prompt on the action itself.
 */
export function resolveFeatureGateState(
  query: FeatureGateQueryState,
  feature: PlanFeatureKey
): FeatureGateState {
  const planUnknown = query.isError && !query.hasData;
  if (planUnknown) return { allowed: true, canUse: true, planUnknown };

  const allowed = query.entitlements ? isFeatureEnabled(query.entitlements, feature) : false;
  return { allowed, canUse: !query.isLoading && allowed, planUnknown };
}
