import { describe, expect, it } from 'vitest';

import {
  buildCustomRoleFormSteps,
  canSubmitCustomRole,
  clampCustomRoleFormStepIndex,
  customRoleFormStepLabels,
  defaultBaselineRolePermissions,
  findCustomRoleFormStepIndex,
  isCustomRoleNameValid,
} from '@/features/dashboard/team/lib/customRoleFormSteps';

describe('customRoleFormSteps', () => {
  it('builds org steps with listings', () => {
    const steps = buildCustomRoleFormSteps({ scope: 'org' });
    expect(customRoleFormStepLabels(steps)).toEqual([
      'Details',
      'Listings',
      'Permissions',
      'Preview',
    ]);
  });

  it('builds property and parking steps without listings', () => {
    expect(customRoleFormStepLabels(buildCustomRoleFormSteps({ scope: 'property' }))).toEqual([
      'Details',
      'Permissions',
      'Preview',
    ]);
    expect(customRoleFormStepLabels(buildCustomRoleFormSteps({ scope: 'parking' }))).toEqual([
      'Details',
      'Permissions',
      'Preview',
    ]);
  });

  it('finds step indexes by kind', () => {
    const steps = buildCustomRoleFormSteps({ scope: 'org' });
    expect(findCustomRoleFormStepIndex(steps, 'details')).toBe(0);
    expect(findCustomRoleFormStepIndex(steps, 'listings')).toBe(1);
    expect(findCustomRoleFormStepIndex(steps, 'permissions')).toBe(2);
    expect(findCustomRoleFormStepIndex(steps, 'preview')).toBe(3);
  });

  it('clamps step index', () => {
    expect(clampCustomRoleFormStepIndex(-1, 4)).toBe(0);
    expect(clampCustomRoleFormStepIndex(99, 4)).toBe(3);
    expect(clampCustomRoleFormStepIndex(2, 0)).toBe(0);
  });

  it('validates name and submit readiness', () => {
    expect(isCustomRoleNameValid('')).toBe(false);
    expect(isCustomRoleNameValid('  ')).toBe(false);
    expect(isCustomRoleNameValid('Co-host')).toBe(true);
    expect(canSubmitCustomRole('Co-host', [])).toBe(false);
    expect(canSubmitCustomRole('Co-host', ['org.dashboard:view'])).toBe(true);
  });

  it('defaults baseline permissions from Full Access', () => {
    expect(
      defaultBaselineRolePermissions([
        { name: 'Operations', permissions: ['a'] },
        { name: 'Full Access', permissions: ['x', 'y'] },
      ])
    ).toEqual(['x', 'y']);
    expect(defaultBaselineRolePermissions([{ name: 'Operations', permissions: ['a'] }])).toEqual(
      []
    );
  });
});
