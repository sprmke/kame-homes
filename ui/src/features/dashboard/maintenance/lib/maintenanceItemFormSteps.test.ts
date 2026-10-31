import { describe, expect, it } from 'vitest';

import {
  buildMaintenanceItemFormSteps,
  clampMaintenanceItemFormStepIndex,
  findMaintenanceItemFormStepIndex,
  maintenanceItemFormStepLabels,
} from '@/features/dashboard/maintenance/lib/maintenanceItemFormSteps';

describe('maintenanceItemFormSteps', () => {
  it('builds Details → Reminders → Preview', () => {
    expect(maintenanceItemFormStepLabels(buildMaintenanceItemFormSteps())).toEqual([
      'Details',
      'Reminders',
      'Preview',
    ]);
  });

  it('finds step indexes by kind', () => {
    const steps = buildMaintenanceItemFormSteps();
    expect(findMaintenanceItemFormStepIndex(steps, 'details')).toBe(0);
    expect(findMaintenanceItemFormStepIndex(steps, 'reminders')).toBe(1);
    expect(findMaintenanceItemFormStepIndex(steps, 'preview')).toBe(2);
  });

  it('clamps step index', () => {
    expect(clampMaintenanceItemFormStepIndex(-1, 3)).toBe(0);
    expect(clampMaintenanceItemFormStepIndex(99, 3)).toBe(2);
    expect(clampMaintenanceItemFormStepIndex(1, 0)).toBe(0);
  });
});
