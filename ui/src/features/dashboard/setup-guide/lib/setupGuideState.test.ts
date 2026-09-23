import { describe, expect, it } from 'vitest';

import { readSetupGuidePersistedState, mergeSetupGuidePersistedState, setupGuideSessionSnoozeKey, isSetupGuideSessionSnoozed, setSetupGuideSessionSnoozed } from '@/features/dashboard/setup-guide/lib/setupGuideState';

describe('readSetupGuidePersistedState', () => {

  it('readSetupGuidePersistedState is exported', () => {
    expect(typeof readSetupGuidePersistedState).toBe('function');
  });

});

describe('mergeSetupGuidePersistedState', () => {

  it('mergeSetupGuidePersistedState is exported', () => {
    expect(typeof mergeSetupGuidePersistedState).toBe('function');
  });

});

describe('setupGuideSessionSnoozeKey', () => {

  it('setupGuideSessionSnoozeKey is exported', () => {
    expect(typeof setupGuideSessionSnoozeKey).toBe('function');
  });

});

describe('isSetupGuideSessionSnoozed', () => {

  it('isSetupGuideSessionSnoozed is exported', () => {
    expect(typeof isSetupGuideSessionSnoozed).toBe('function');
  });

});

describe('setSetupGuideSessionSnoozed', () => {

  it('setSetupGuideSessionSnoozed is exported', () => {
    expect(typeof setSetupGuideSessionSnoozed).toBe('function');
  });

});
