import { describe, expect, it } from 'vitest';

import { normalizeStayPhotoUrls, stayPhotoUrlsEqual, externalReviewContentEqual, applyExternalReviewDraftChange, createEmptyExternalReview, normalizeExternalReviewsDraft, externalReviewEqual, externalReviewDirty, mergeExternalReviewsForSingleReviewSave, externalReviewsEqual, externalReviewSourceLabel, externalReviewModerationLabel, rejectedExternalReviewCount, externalReviewsAggregateLabel, getExternalReviewFieldErrors, isExternalReviewDraftValid, validateExternalReviewDraft, validateExternalReviewsDraft, MAX_PROPERTY_EXTERNAL_REVIEWS, MAX_EXTERNAL_REVIEW_STAY_PHOTOS, MAX_EXTERNAL_REVIEW_TEXT_LENGTH } from '@/features/dashboard/org/lib/propertyExternalReviews';

describe('normalizeStayPhotoUrls', () => {

  it('normalizeStayPhotoUrls is exported', () => {
    expect(typeof normalizeStayPhotoUrls).toBe('function');
  });

});

describe('stayPhotoUrlsEqual', () => {

  it('stayPhotoUrlsEqual is exported', () => {
    expect(typeof stayPhotoUrlsEqual).toBe('function');
  });

});

describe('externalReviewContentEqual', () => {

  it('externalReviewContentEqual is exported', () => {
    expect(typeof externalReviewContentEqual).toBe('function');
  });

});

describe('applyExternalReviewDraftChange', () => {

  it('applyExternalReviewDraftChange is exported', () => {
    expect(typeof applyExternalReviewDraftChange).toBe('function');
  });

});

describe('createEmptyExternalReview', () => {

  it('createEmptyExternalReview is exported', () => {
    expect(typeof createEmptyExternalReview).toBe('function');
  });

});

describe('normalizeExternalReviewsDraft', () => {

  it('normalizeExternalReviewsDraft is exported', () => {
    expect(typeof normalizeExternalReviewsDraft).toBe('function');
  });

});

describe('externalReviewEqual', () => {

  it('externalReviewEqual is exported', () => {
    expect(typeof externalReviewEqual).toBe('function');
  });

});

describe('externalReviewDirty', () => {

  it('externalReviewDirty is exported', () => {
    expect(typeof externalReviewDirty).toBe('function');
  });

});

describe('mergeExternalReviewsForSingleReviewSave', () => {

  it('mergeExternalReviewsForSingleReviewSave is exported', () => {
    expect(typeof mergeExternalReviewsForSingleReviewSave).toBe('function');
  });

});

describe('externalReviewsEqual', () => {

  it('externalReviewsEqual is exported', () => {
    expect(typeof externalReviewsEqual).toBe('function');
  });

});

describe('externalReviewSourceLabel', () => {

  it('externalReviewSourceLabel is exported', () => {
    expect(typeof externalReviewSourceLabel).toBe('function');
  });

});

describe('externalReviewModerationLabel', () => {

  it('externalReviewModerationLabel is exported', () => {
    expect(typeof externalReviewModerationLabel).toBe('function');
  });

});

describe('rejectedExternalReviewCount', () => {

  it('rejectedExternalReviewCount is exported', () => {
    expect(typeof rejectedExternalReviewCount).toBe('function');
  });

});

describe('externalReviewsAggregateLabel', () => {

  it('externalReviewsAggregateLabel is exported', () => {
    expect(typeof externalReviewsAggregateLabel).toBe('function');
  });

});

describe('getExternalReviewFieldErrors', () => {

  it('getExternalReviewFieldErrors is exported', () => {
    expect(typeof getExternalReviewFieldErrors).toBe('function');
  });

});

describe('isExternalReviewDraftValid', () => {

  it('isExternalReviewDraftValid is exported', () => {
    expect(typeof isExternalReviewDraftValid).toBe('function');
  });

});

describe('validateExternalReviewDraft', () => {

  it('validateExternalReviewDraft is exported', () => {
    expect(typeof validateExternalReviewDraft).toBe('function');
  });

});

describe('validateExternalReviewsDraft', () => {

  it('validateExternalReviewsDraft is exported', () => {
    expect(typeof validateExternalReviewsDraft).toBe('function');
  });

});

describe('MAX_PROPERTY_EXTERNAL_REVIEWS', () => {
  it('is defined', () => {
    expect(MAX_PROPERTY_EXTERNAL_REVIEWS).toBeDefined();
  });
});

describe('MAX_EXTERNAL_REVIEW_STAY_PHOTOS', () => {
  it('is defined', () => {
    expect(MAX_EXTERNAL_REVIEW_STAY_PHOTOS).toBeDefined();
  });
});

describe('MAX_EXTERNAL_REVIEW_TEXT_LENGTH', () => {
  it('is defined', () => {
    expect(MAX_EXTERNAL_REVIEW_TEXT_LENGTH).toBeDefined();
  });
});

