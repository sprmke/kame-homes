import { describe, expect, it } from 'vitest';

import { PARKING_STAY_CHOOSER_TITLE, PARKING_MANUAL_BOOKING_OPTION_LABEL, PARKING_LINKED_CONFIRM_TITLE } from '@/features/guest/marketing/parkings/lib/parkingRequestEntryCopy';

describe('PARKING_STAY_CHOOSER_TITLE', () => {
  it('is defined', () => {
    expect(PARKING_STAY_CHOOSER_TITLE).toBeDefined();
  });
});

describe('PARKING_MANUAL_BOOKING_OPTION_LABEL', () => {
  it('is defined', () => {
    expect(PARKING_MANUAL_BOOKING_OPTION_LABEL).toBeDefined();
  });
});

describe('PARKING_LINKED_CONFIRM_TITLE', () => {
  it('is defined', () => {
    expect(PARKING_LINKED_CONFIRM_TITLE).toBeDefined();
  });
});
