import { describe, expect, it } from 'vitest';

import { truncateReviewQuote, formatReviewAttribution, reviewDisplayDate, formatReviewAttributionFromReview, reviewStarLabel, firstReviewImageUrl } from '@/features/dashboard/marketing/lib/marketingGuestReview';

describe('truncateReviewQuote', () => {

  it('truncateReviewQuote is exported', () => {
    expect(typeof truncateReviewQuote).toBe('function');
  });

});

describe('formatReviewAttribution', () => {

  it('formatReviewAttribution is exported', () => {
    expect(typeof formatReviewAttribution).toBe('function');
  });

});

describe('reviewDisplayDate', () => {

  it('reviewDisplayDate is exported', () => {
    expect(typeof reviewDisplayDate).toBe('function');
  });

});

describe('formatReviewAttributionFromReview', () => {

  it('formatReviewAttributionFromReview is exported', () => {
    expect(typeof formatReviewAttributionFromReview).toBe('function');
  });

});

describe('reviewStarLabel', () => {

  it('reviewStarLabel is exported', () => {
    expect(typeof reviewStarLabel).toBe('function');
  });

});

describe('firstReviewImageUrl', () => {

  it('firstReviewImageUrl is exported', () => {
    expect(typeof firstReviewImageUrl).toBe('function');
  });

});

