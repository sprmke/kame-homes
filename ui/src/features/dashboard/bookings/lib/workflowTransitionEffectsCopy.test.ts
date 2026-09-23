import { describe, expect, it } from 'vitest';

import { workflowTransitionEmailEffects, workflowWouldEmailOnPaidPlan, workflowTransitionEffectLines, workflowCancelEffectLines } from '@/features/dashboard/bookings/lib/workflowTransitionEffectsCopy';

describe('workflowTransitionEmailEffects', () => {

  it('workflowTransitionEmailEffects is exported', () => {
    expect(typeof workflowTransitionEmailEffects).toBe('function');
  });

});

describe('workflowWouldEmailOnPaidPlan', () => {

  it('workflowWouldEmailOnPaidPlan is exported', () => {
    expect(typeof workflowWouldEmailOnPaidPlan).toBe('function');
  });

});

describe('workflowTransitionEffectLines', () => {

  it('workflowTransitionEffectLines is exported', () => {
    expect(typeof workflowTransitionEffectLines).toBe('function');
  });

});

describe('workflowCancelEffectLines', () => {

  it('workflowCancelEffectLines is exported', () => {
    expect(typeof workflowCancelEffectLines).toBe('function');
  });

});
