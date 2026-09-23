import { describe, expect, it } from 'vitest';

import { resolveReviewDesignFields, bindingWithReview, SAMPLE_MARKETING_REVIEW } from '@/features/dashboard/marketing/lib/marketingReviewDesignSeed';

describe('resolveReviewDesignFields', () => {

  it('resolveReviewDesignFields is exported', () => {
    expect(typeof resolveReviewDesignFields).toBe('function');
  });

});

describe('bindingWithReview', () => {

  it('bindingWithReview is exported', () => {
    expect(typeof bindingWithReview).toBe('function');
  });

});

describe('SAMPLE_MARKETING_REVIEW', () => {
  it('is defined', () => {
    expect(SAMPLE_MARKETING_REVIEW).toBeDefined();
  });
});
