import { describe, expect, it } from 'vitest';

import { guestReviewTagsForRating, guestReviewFeedbackPrompt, filterGuestReviewTagsForRating, guestReviewFeedbackTagLabel, validateGuestReviewFeedbackTagsClient, MAX_GUEST_REVIEW_FEEDBACK_TAGS } from '@/features/guest/sd-form/lib/guestReviewFeedbackTags';

describe('guestReviewTagsForRating', () => {

  it('guestReviewTagsForRating is exported', () => {
    expect(typeof guestReviewTagsForRating).toBe('function');
  });

});

describe('guestReviewFeedbackPrompt', () => {

  it('guestReviewFeedbackPrompt is exported', () => {
    expect(typeof guestReviewFeedbackPrompt).toBe('function');
  });

});

describe('filterGuestReviewTagsForRating', () => {

  it('filterGuestReviewTagsForRating is exported', () => {
    expect(typeof filterGuestReviewTagsForRating).toBe('function');
  });

});

describe('guestReviewFeedbackTagLabel', () => {

  it('guestReviewFeedbackTagLabel is exported', () => {
    expect(typeof guestReviewFeedbackTagLabel).toBe('function');
  });

});

describe('validateGuestReviewFeedbackTagsClient', () => {

  it('validateGuestReviewFeedbackTagsClient is exported', () => {
    expect(typeof validateGuestReviewFeedbackTagsClient).toBe('function');
  });

});

describe('MAX_GUEST_REVIEW_FEEDBACK_TAGS', () => {
  it('is defined', () => {
    expect(MAX_GUEST_REVIEW_FEEDBACK_TAGS).toBeDefined();
  });
});
