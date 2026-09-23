import { describe, expect, it } from 'vitest';

import { setSetupGuideRequiredRemaining, clearSetupGuideRequiredRemaining, subscribeSetupGuideIssues, getSetupGuideRequiredRemaining, hasSetupGuideIssues } from '@/features/dashboard/setup-guide/lib/setupGuideIssuesStore';

describe('setSetupGuideRequiredRemaining', () => {

  it('setSetupGuideRequiredRemaining is exported', () => {
    expect(typeof setSetupGuideRequiredRemaining).toBe('function');
  });

});

describe('clearSetupGuideRequiredRemaining', () => {

  it('clearSetupGuideRequiredRemaining is exported', () => {
    expect(typeof clearSetupGuideRequiredRemaining).toBe('function');
  });

});

describe('subscribeSetupGuideIssues', () => {

  it('subscribeSetupGuideIssues is exported', () => {
    expect(typeof subscribeSetupGuideIssues).toBe('function');
  });

});

describe('getSetupGuideRequiredRemaining', () => {

  it('getSetupGuideRequiredRemaining is exported', () => {
    expect(typeof getSetupGuideRequiredRemaining).toBe('function');
  });

});

describe('hasSetupGuideIssues', () => {

  it('hasSetupGuideIssues is exported', () => {
    expect(typeof hasSetupGuideIssues).toBe('function');
  });

});
