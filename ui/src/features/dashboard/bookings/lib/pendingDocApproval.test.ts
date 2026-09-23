import { describe, expect, it } from 'vitest';

import { pendingDocStepApprovalAsset, pendingDocStepUsesApprovalModal, approvedPdfUrlForDocStep, approvedPdfUploadLabel } from '@/features/dashboard/bookings/lib/pendingDocApproval';

describe('pendingDocStepApprovalAsset', () => {

  it('pendingDocStepApprovalAsset is exported', () => {
    expect(typeof pendingDocStepApprovalAsset).toBe('function');
  });

});

describe('pendingDocStepUsesApprovalModal', () => {

  it('pendingDocStepUsesApprovalModal is exported', () => {
    expect(typeof pendingDocStepUsesApprovalModal).toBe('function');
  });

});

describe('approvedPdfUrlForDocStep', () => {

  it('approvedPdfUrlForDocStep is exported', () => {
    expect(typeof approvedPdfUrlForDocStep).toBe('function');
  });

});

describe('approvedPdfUploadLabel', () => {

  it('approvedPdfUploadLabel is exported', () => {
    expect(typeof approvedPdfUploadLabel).toBe('function');
  });

});
