import { describe, expect, it } from 'vitest';

import { approvalHasDualTierQueue, defaultApprovalReviewTier, latestApprovalSubmittedAt } from '@/features/dashboard/super-admin/lib/approvalReviewTier';

describe('approvalHasDualTierQueue', () => {

  it('approvalHasDualTierQueue is exported', () => {
    expect(typeof approvalHasDualTierQueue).toBe('function');
  });

});

describe('defaultApprovalReviewTier', () => {

  it('defaultApprovalReviewTier is exported', () => {
    expect(typeof defaultApprovalReviewTier).toBe('function');
  });

});

describe('latestApprovalSubmittedAt', () => {

  it('latestApprovalSubmittedAt is exported', () => {
    expect(typeof latestApprovalSubmittedAt).toBe('function');
  });

});
