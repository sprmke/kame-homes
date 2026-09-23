import { describe, expect, it } from 'vitest';

import { hostRejectionReasonLabel, buildRejectionMessage, HOST_REJECTION_REASON_OPTIONS } from '@/features/dashboard/super-admin/lib/rejectReasonOptions';

describe('hostRejectionReasonLabel', () => {

  it('hostRejectionReasonLabel is exported', () => {
    expect(typeof hostRejectionReasonLabel).toBe('function');
  });

});

describe('buildRejectionMessage', () => {

  it('buildRejectionMessage is exported', () => {
    expect(typeof buildRejectionMessage).toBe('function');
  });

});

describe('HOST_REJECTION_REASON_OPTIONS', () => {
  it('is defined', () => {
    expect(HOST_REJECTION_REASON_OPTIONS).toBeDefined();
  });
});
