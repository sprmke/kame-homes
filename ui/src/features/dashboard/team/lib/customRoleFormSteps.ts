import type { TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';

export type CustomRoleFormDetailsStep = {
  kind: 'details';
  id: 'details';
  label: string;
};

export type CustomRoleFormListingsStep = {
  kind: 'listings';
  id: 'listings';
  label: string;
};

export type CustomRoleFormPermissionsStep = {
  kind: 'permissions';
  id: 'permissions';
  label: string;
};

export type CustomRoleFormPreviewStep = {
  kind: 'preview';
  id: 'preview';
  label: string;
};

export type CustomRoleFormStep =
  | CustomRoleFormDetailsStep
  | CustomRoleFormListingsStep
  | CustomRoleFormPermissionsStep
  | CustomRoleFormPreviewStep;

const DETAILS_STEP: CustomRoleFormDetailsStep = {
  kind: 'details',
  id: 'details',
  label: 'Details',
};

const LISTINGS_STEP: CustomRoleFormListingsStep = {
  kind: 'listings',
  id: 'listings',
  label: 'Listings',
};

const PERMISSIONS_STEP: CustomRoleFormPermissionsStep = {
  kind: 'permissions',
  id: 'permissions',
  label: 'Permissions',
};

const PREVIEW_STEP: CustomRoleFormPreviewStep = {
  kind: 'preview',
  id: 'preview',
  label: 'Preview',
};

/**
 * Wizard steps for create/edit custom role.
 * Org: Details → Listings → Permissions → Preview
 * Property / parking: Details → Permissions → Preview
 */
export function buildCustomRoleFormSteps(input: { scope: TeamScope }): CustomRoleFormStep[] {
  const steps: CustomRoleFormStep[] = [DETAILS_STEP];
  if (input.scope === 'org') {
    steps.push(LISTINGS_STEP);
  }
  steps.push(PERMISSIONS_STEP, PREVIEW_STEP);
  return steps;
}

export function customRoleFormStepLabels(steps: readonly CustomRoleFormStep[]): string[] {
  return steps.map((step) => step.label);
}

export function clampCustomRoleFormStepIndex(index: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(Math.max(0, index), stepCount - 1);
}

export function isCustomRoleNameValid(name: string): boolean {
  return name.trim().length > 0;
}

export function canSubmitCustomRole(name: string, permissions: readonly string[]): boolean {
  return isCustomRoleNameValid(name) && permissions.length > 0;
}

export function findCustomRoleFormStepIndex(
  steps: readonly CustomRoleFormStep[],
  kind: CustomRoleFormStep['kind']
): number {
  return steps.findIndex((step) => step.kind === kind);
}

/** Permissions for the seeded Full Access template, or empty if missing. */
export function defaultBaselineRolePermissions(
  templates: readonly { name: string; permissions: readonly string[] }[]
): string[] {
  const fullAccess = templates.find((role) => role.name.trim().toLowerCase() === 'full access');
  return fullAccess ? [...fullAccess.permissions] : [];
}
