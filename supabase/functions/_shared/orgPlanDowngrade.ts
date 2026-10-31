/**
 * Pure validation for host self-serve org plan downgrades — shared by
 * `applyOrgPlanDowngrade` and Deno unit tests (no DB).
 */

export const MANAGED_PLAN_CODE = 'managed';

export type OrgPlanDowngradeValidationInput = {
  currentPlanId: string;
  currentPlanCode: string;
  currentPlanSortOrder: number;
  currentPlanIsDefault: boolean;
  subscriptionStatus: string;
  targetPlanId: string;
  targetPlanCode: string;
  targetPlanSortOrder: number;
  targetPlanIsDefault: boolean;
};

export type OrgPlanDowngradeValidationResult =
  { ok: true; toFree: boolean } | { ok: false; message: string };

/** Returns whether the request is a valid self-serve downgrade (not upgrade / same tier). */
export function validateOrgPlanDowngradeRequest(
  input: OrgPlanDowngradeValidationInput
): OrgPlanDowngradeValidationResult {
  const toFree = input.targetPlanIsDefault;
  const currentSort = input.currentPlanSortOrder;
  const targetSort = input.targetPlanSortOrder;
  const status = input.subscriptionStatus;

  if (input.currentPlanCode === MANAGED_PLAN_CODE) {
    return { ok: false, message: 'Contact support to change your Managed plan' };
  }

  if (input.targetPlanCode === MANAGED_PLAN_CODE) {
    return { ok: false, message: 'Use checkout or contact sales for Managed' };
  }

  if (toFree) {
    if (input.currentPlanIsDefault) {
      return { ok: false, message: 'Already on the Free plan' };
    }
  } else if (input.targetPlanId === input.currentPlanId || targetSort >= currentSort) {
    return { ok: false, message: 'Use checkout to upgrade or update billing' };
  }

  if (status === 'past_due') {
    return {
      ok: false,
      message: 'Pay the overdue balance from Billing before changing your plan',
    };
  }

  if (status === 'suspended' && !toFree) {
    return {
      ok: false,
      message: 'Pay to restore access before switching to a different paid plan',
    };
  }

  if (status !== 'active' && status !== 'trialing' && status !== 'suspended') {
    return {
      ok: false,
      message: 'Subscription is not eligible for a self-serve downgrade',
    };
  }

  return { ok: true, toFree };
}

/** Suspended subs keep plan identity for billing UI but block paid feature gates. */
export function subscriptionStatusBlocksFeatureGates(status: string): boolean {
  return status === 'suspended';
}
