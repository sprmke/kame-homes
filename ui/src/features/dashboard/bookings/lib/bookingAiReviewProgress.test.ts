import { describe, expect, it } from 'vitest';

import { buildOptimisticProcessingReview, isStuckProcessingReview, isBookingAiReviewRunning, hasPriorAiReviewResults, hasBookingAiReviewRun, isBookingAiReviewStale, isBookingAiReviewSectionStale, canRefreshBookingAiReview } from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';

describe('buildOptimisticProcessingReview', () => {

  it('buildOptimisticProcessingReview is exported', () => {
    expect(typeof buildOptimisticProcessingReview).toBe('function');
  });

});

describe('isStuckProcessingReview', () => {

  it('isStuckProcessingReview is exported', () => {
    expect(typeof isStuckProcessingReview).toBe('function');
  });

});

describe('isBookingAiReviewRunning', () => {

  it('isBookingAiReviewRunning is exported', () => {
    expect(typeof isBookingAiReviewRunning).toBe('function');
  });

});

describe('hasPriorAiReviewResults', () => {

  it('hasPriorAiReviewResults is exported', () => {
    expect(typeof hasPriorAiReviewResults).toBe('function');
  });

});

describe('hasBookingAiReviewRun', () => {

  it('hasBookingAiReviewRun is exported', () => {
    expect(typeof hasBookingAiReviewRun).toBe('function');
  });

});

describe('isBookingAiReviewStale', () => {

  it('isBookingAiReviewStale is exported', () => {
    expect(typeof isBookingAiReviewStale).toBe('function');
  });

});

describe('isBookingAiReviewSectionStale', () => {

  it('isBookingAiReviewSectionStale is exported', () => {
    expect(typeof isBookingAiReviewSectionStale).toBe('function');
  });

});

describe('canRefreshBookingAiReview', () => {

  it('canRefreshBookingAiReview is exported', () => {
    expect(typeof canRefreshBookingAiReview).toBe('function');
  });

});

