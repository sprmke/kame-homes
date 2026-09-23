import { describe, expect, it } from 'vitest';

import { automationSkipLabelsForKinds, notifyAutomationSkippedByPlan, notifyAutomationSkippedByHost, workflowEmailKindFromSkipKey, AUTOMATION_SKIP_SESSION_KEY } from '@/features/dashboard/bookings/lib/workflowPlanSkip';

describe('automationSkipLabelsForKinds', () => {

  it('automationSkipLabelsForKinds is exported', () => {
    expect(typeof automationSkipLabelsForKinds).toBe('function');
  });

});

describe('notifyAutomationSkippedByPlan', () => {

  it('notifyAutomationSkippedByPlan is exported', () => {
    expect(typeof notifyAutomationSkippedByPlan).toBe('function');
  });

});

describe('notifyAutomationSkippedByHost', () => {

  it('notifyAutomationSkippedByHost is exported', () => {
    expect(typeof notifyAutomationSkippedByHost).toBe('function');
  });

});

describe('workflowEmailKindFromSkipKey', () => {

  it('workflowEmailKindFromSkipKey is exported', () => {
    expect(typeof workflowEmailKindFromSkipKey).toBe('function');
  });

});

describe('AUTOMATION_SKIP_SESSION_KEY', () => {
  it('is defined', () => {
    expect(AUTOMATION_SKIP_SESSION_KEY).toBeDefined();
  });
});
