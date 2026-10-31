import { describe, expect, it } from 'vitest';

import { resolveFeatureGateState } from '@/features/dashboard/plans/lib/featureGateState';
import { DEFAULT_PLAN_FEATURES } from '@/features/dashboard/plans/lib/planFeatures';

const free = { ...DEFAULT_PLAN_FEATURES, propertyShowcase: false };
const pro = { ...DEFAULT_PLAN_FEATURES, propertyShowcase: true };
const loaded = { isLoading: false, isError: false, hasData: true };

describe('resolveFeatureGateState', () => {
  it('allows a feature the plan includes', () => {
    expect(resolveFeatureGateState({ ...loaded, entitlements: pro }, 'propertyShowcase')).toEqual({
      allowed: true,
      canUse: true,
      planUnknown: false,
    });
  });

  it('blocks a feature the plan does not include', () => {
    expect(resolveFeatureGateState({ ...loaded, entitlements: free }, 'propertyShowcase')).toEqual({
      allowed: false,
      canUse: false,
      planUnknown: false,
    });
  });

  it('does not allow use while the plan is still loading', () => {
    const state = resolveFeatureGateState(
      { entitlements: undefined, isLoading: true, isError: false, hasData: false },
      'propertyShowcase'
    );
    expect(state).toEqual({ allowed: false, canUse: false, planUnknown: false });
  });

  it('fails open when the plan cannot be loaded, so paying hosts never see Free UI', () => {
    const state = resolveFeatureGateState(
      { entitlements: undefined, isLoading: false, isError: true, hasData: false },
      'propertyShowcase'
    );
    expect(state).toEqual({ allowed: true, canUse: true, planUnknown: true });
  });

  it('keeps the last known plan when only a background refetch fails', () => {
    const state = resolveFeatureGateState(
      { entitlements: free, isLoading: false, isError: true, hasData: true },
      'propertyShowcase'
    );
    expect(state).toEqual({ allowed: false, canUse: false, planUnknown: false });
  });
});
