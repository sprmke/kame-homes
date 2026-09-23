import { describe, expect, it } from 'vitest';

import { collectBookingAiDocumentRefs, bookingAiSectionDocumentRefs, linkifyBookingAiText } from '@/features/dashboard/bookings/lib/bookingAiDocumentLinks';

describe('collectBookingAiDocumentRefs', () => {

  it('collectBookingAiDocumentRefs is exported', () => {
    expect(typeof collectBookingAiDocumentRefs).toBe('function');
  });

});

describe('bookingAiSectionDocumentRefs', () => {

  it('bookingAiSectionDocumentRefs is exported', () => {
    expect(typeof bookingAiSectionDocumentRefs).toBe('function');
  });

});

describe('linkifyBookingAiText', () => {

  it('linkifyBookingAiText is exported', () => {
    expect(typeof linkifyBookingAiText).toBe('function');
  });

});
