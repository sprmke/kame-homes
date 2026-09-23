import { describe, expect, it } from 'vitest';

import { collectBookingAiValidations, bookingAiValidationSeverityRank, isAiProviderErrorText, clarifyDocumentSubject, repairTruncatedAiText, sanitizeAiReviewSummary, sanitizeAiReviewFlags, resolveSectionOutcome, sortBookingAiValidations } from '@/features/dashboard/bookings/lib/bookingAiValidations';

describe('collectBookingAiValidations', () => {

  it('collectBookingAiValidations is exported', () => {
    expect(typeof collectBookingAiValidations).toBe('function');
  });

});

describe('bookingAiValidationSeverityRank', () => {

  it('bookingAiValidationSeverityRank is exported', () => {
    expect(typeof bookingAiValidationSeverityRank).toBe('function');
  });

});

describe('isAiProviderErrorText', () => {

  it('isAiProviderErrorText is exported', () => {
    expect(typeof isAiProviderErrorText).toBe('function');
  });

});

describe('clarifyDocumentSubject', () => {

  it('clarifyDocumentSubject is exported', () => {
    expect(typeof clarifyDocumentSubject).toBe('function');
  });

});

describe('repairTruncatedAiText', () => {

  it('repairTruncatedAiText is exported', () => {
    expect(typeof repairTruncatedAiText).toBe('function');
  });

});

describe('sanitizeAiReviewSummary', () => {

  it('sanitizeAiReviewSummary is exported', () => {
    expect(typeof sanitizeAiReviewSummary).toBe('function');
  });

});

describe('sanitizeAiReviewFlags', () => {

  it('sanitizeAiReviewFlags is exported', () => {
    expect(typeof sanitizeAiReviewFlags).toBe('function');
  });

});

describe('resolveSectionOutcome', () => {

  it('resolveSectionOutcome is exported', () => {
    expect(typeof resolveSectionOutcome).toBe('function');
  });

});

describe('sortBookingAiValidations', () => {

  it('sortBookingAiValidations is exported', () => {
    expect(typeof sortBookingAiValidations).toBe('function');
  });

});
