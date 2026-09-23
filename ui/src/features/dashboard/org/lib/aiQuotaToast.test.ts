import { describe, expect, it } from 'vitest';

import { toastAiQuotaExceeded, isAiQuotaResponse, isAiQuotaError, throwIfUpgradeHookFromJson, throwIfAiQuota, handleAiMutationError } from '@/features/dashboard/org/lib/aiQuotaToast';

describe('toastAiQuotaExceeded', () => {

  it('toastAiQuotaExceeded is exported', () => {
    expect(typeof toastAiQuotaExceeded).toBe('function');
  });

});

describe('isAiQuotaResponse', () => {

  it('isAiQuotaResponse is exported', () => {
    expect(typeof isAiQuotaResponse).toBe('function');
  });

});

describe('isAiQuotaError', () => {

  it('isAiQuotaError is exported', () => {
    expect(typeof isAiQuotaError).toBe('function');
  });

});

describe('throwIfUpgradeHookFromJson', () => {

  it('throwIfUpgradeHookFromJson is exported', () => {
    expect(typeof throwIfUpgradeHookFromJson).toBe('function');
  });

});

describe('throwIfAiQuota', () => {

  it('throwIfAiQuota is exported', () => {
    expect(typeof throwIfAiQuota).toBe('function');
  });

});

describe('handleAiMutationError', () => {

  it('handleAiMutationError is exported', () => {
    expect(typeof handleAiMutationError).toBe('function');
  });

});
