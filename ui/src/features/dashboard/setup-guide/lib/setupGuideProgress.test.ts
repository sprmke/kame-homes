import { describe, expect, it } from 'vitest';

import {
  deriveSetupGuideProgress,
  isSetupGuideStepReachable,
  setupGuideRequiredComplete,
} from '@/features/dashboard/setup-guide/lib/setupGuideProgress';
import type {
  SetupGuideStep,
  SetupGuideStepProgress,
  SetupGuideStepStatus,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

function entry(id: string, status: SetupGuideStepStatus): SetupGuideStepProgress {
  const step = {
    id,
    kind: 'org.brand',
    title: id,
    requirement: 'required',
    group: { type: 'org-start' },
    estimatedMinutes: 1,
    completionSections: [],
  } as SetupGuideStep;
  return { step, status };
}

describe('deriveSetupGuideProgress', () => {
  it('deriveSetupGuideProgress is exported', () => {
    expect(typeof deriveSetupGuideProgress).toBe('function');
  });
});

describe('isSetupGuideStepReachable', () => {
  it('keeps later steps locked until earlier ones are settled', () => {
    const steps = [
      entry('brand', 'complete'),
      entry('listing', 'incomplete'),
      entry('verify', 'incomplete'),
    ];

    expect(isSetupGuideStepReachable(steps, 'brand')).toBe(true);
    expect(isSetupGuideStepReachable(steps, 'listing')).toBe(true);
    expect(isSetupGuideStepReachable(steps, 'verify')).toBe(false);
  });

  it('treats a skipped step as settled', () => {
    const steps = [
      entry('verify', 'skipped'),
      entry('team', 'incomplete'),
      entry('done', 'incomplete'),
    ];

    expect(isSetupGuideStepReachable(steps, 'team')).toBe(true);
    expect(isSetupGuideStepReachable(steps, 'done')).toBe(false);
  });
});

describe('setupGuideRequiredComplete', () => {
  it('setupGuideRequiredComplete is exported', () => {
    expect(typeof setupGuideRequiredComplete).toBe('function');
  });
});
