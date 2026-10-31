import { describe, expect, it } from 'vitest';

import {
  buildOperatingLineItemFormSteps,
  clampOperatingLineItemFormStepIndex,
  findOperatingLineItemFormStepIndex,
  operatingLineItemFormStepLabels,
} from '@/features/dashboard/finance/lib/operatingLineItemFormSteps';

describe('operatingLineItemFormSteps', () => {
  it('builds create steps with repeat', () => {
    expect(
      operatingLineItemFormStepLabels(
        buildOperatingLineItemFormSteps({ isEdit: false, isRecurringEdit: false })
      )
    ).toEqual(['Details', 'Repeat', 'Reminders', 'Preview']);
  });

  it('builds recurring edit steps with repeat', () => {
    expect(
      operatingLineItemFormStepLabels(
        buildOperatingLineItemFormSteps({ isEdit: true, isRecurringEdit: true })
      )
    ).toEqual(['Details', 'Repeat', 'Reminders', 'Preview']);
  });

  it('skips repeat on one-shot edit', () => {
    expect(
      operatingLineItemFormStepLabels(
        buildOperatingLineItemFormSteps({ isEdit: true, isRecurringEdit: false })
      )
    ).toEqual(['Details', 'Reminders', 'Preview']);
  });

  it('finds step indexes by kind', () => {
    const steps = buildOperatingLineItemFormSteps({ isEdit: false, isRecurringEdit: false });
    expect(findOperatingLineItemFormStepIndex(steps, 'details')).toBe(0);
    expect(findOperatingLineItemFormStepIndex(steps, 'repeat')).toBe(1);
    expect(findOperatingLineItemFormStepIndex(steps, 'reminders')).toBe(2);
    expect(findOperatingLineItemFormStepIndex(steps, 'preview')).toBe(3);
  });

  it('clamps step index', () => {
    expect(clampOperatingLineItemFormStepIndex(-1, 4)).toBe(0);
    expect(clampOperatingLineItemFormStepIndex(99, 4)).toBe(3);
    expect(clampOperatingLineItemFormStepIndex(2, 0)).toBe(0);
  });
});
