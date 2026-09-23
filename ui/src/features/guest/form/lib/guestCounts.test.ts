import { describe, expect, it } from 'vitest';

import { buildGuestLimitMessage, getDefaultAgeForGuestFormPartyGuest, getDefaultAgeForPartyGuest, getActivePartySize, isPartyOverflowGuest, isPartyFifthGuest, preprocessGuestAgeInput, parseGuestAgeInputChange, formatGuestAgeInputValue, shouldShowGuestLimitMessage, shouldShowAzureAdultLimitMessage, requiresValidId, computeGuestCounts, computeOccupancyGuestCountsByAge, computeAzureGuestCountsByAge, computeGuestCountsByAge, bookingGuestSlotsFromRow, resolveGuestCountsFromBooking, getInitialVisibleGuestCount, guestPartyPositionLabel, additionalGuestOrdinal, resolveListingGuestCapacity, clampBookingGuestCounts, canAdjustBookingGuestCount, adjustBookingGuestCount, formatBookingGuestSummary, ADULT_MIN_AGE, VALID_ID_MIN_AGE, PRIMARY_GUEST_MIN_AGE, DEFAULT_GUEST_AGE, OCCUPANCY_CHILD_MAX_AGE, AZURE_CHILD_MAX_AGE, FIFTH_PARTY_GUEST_MAX_AGE, AZURE_MAX_ADULTS, MAX_GUESTS, AZURE_ADULT_LIMIT_MESSAGE } from '@/features/guest/form/lib/guestCounts';

describe('buildGuestLimitMessage', () => {

  it('buildGuestLimitMessage is exported', () => {
    expect(typeof buildGuestLimitMessage).toBe('function');
  });

});

describe('getDefaultAgeForGuestFormPartyGuest', () => {

  it('getDefaultAgeForGuestFormPartyGuest is exported', () => {
    expect(typeof getDefaultAgeForGuestFormPartyGuest).toBe('function');
  });

});

describe('getDefaultAgeForPartyGuest', () => {

  it('getDefaultAgeForPartyGuest is exported', () => {
    expect(typeof getDefaultAgeForPartyGuest).toBe('function');
  });

});

describe('getActivePartySize', () => {

  it('getActivePartySize is exported', () => {
    expect(typeof getActivePartySize).toBe('function');
  });

});

describe('isPartyOverflowGuest', () => {

  it('isPartyOverflowGuest is exported', () => {
    expect(typeof isPartyOverflowGuest).toBe('function');
  });

});

describe('isPartyFifthGuest', () => {

  it('isPartyFifthGuest is exported', () => {
    expect(typeof isPartyFifthGuest).toBe('function');
  });

});

describe('preprocessGuestAgeInput', () => {

  it('preprocessGuestAgeInput is exported', () => {
    expect(typeof preprocessGuestAgeInput).toBe('function');
  });

});

describe('parseGuestAgeInputChange', () => {

  it('parseGuestAgeInputChange is exported', () => {
    expect(typeof parseGuestAgeInputChange).toBe('function');
  });

});

describe('formatGuestAgeInputValue', () => {

  it('formatGuestAgeInputValue is exported', () => {
    expect(typeof formatGuestAgeInputValue).toBe('function');
  });

});

describe('shouldShowGuestLimitMessage', () => {

  it('shouldShowGuestLimitMessage is exported', () => {
    expect(typeof shouldShowGuestLimitMessage).toBe('function');
  });

});

describe('shouldShowAzureAdultLimitMessage', () => {

  it('shouldShowAzureAdultLimitMessage is exported', () => {
    expect(typeof shouldShowAzureAdultLimitMessage).toBe('function');
  });

});

describe('requiresValidId', () => {

  it('requiresValidId is exported', () => {
    expect(typeof requiresValidId).toBe('function');
  });

});

describe('computeGuestCounts', () => {

  it('computeGuestCounts is exported', () => {
    expect(typeof computeGuestCounts).toBe('function');
  });

});

describe('computeOccupancyGuestCountsByAge', () => {

  it('computeOccupancyGuestCountsByAge is exported', () => {
    expect(typeof computeOccupancyGuestCountsByAge).toBe('function');
  });

});

describe('computeAzureGuestCountsByAge', () => {

  it('computeAzureGuestCountsByAge is exported', () => {
    expect(typeof computeAzureGuestCountsByAge).toBe('function');
  });

});

describe('computeGuestCountsByAge', () => {

  it('computeGuestCountsByAge is exported', () => {
    expect(typeof computeGuestCountsByAge).toBe('function');
  });

});

describe('bookingGuestSlotsFromRow', () => {

  it('bookingGuestSlotsFromRow is exported', () => {
    expect(typeof bookingGuestSlotsFromRow).toBe('function');
  });

});

describe('resolveGuestCountsFromBooking', () => {

  it('resolveGuestCountsFromBooking is exported', () => {
    expect(typeof resolveGuestCountsFromBooking).toBe('function');
  });

});

describe('getInitialVisibleGuestCount', () => {

  it('getInitialVisibleGuestCount is exported', () => {
    expect(typeof getInitialVisibleGuestCount).toBe('function');
  });

});

describe('guestPartyPositionLabel', () => {

  it('guestPartyPositionLabel is exported', () => {
    expect(typeof guestPartyPositionLabel).toBe('function');
  });

});

describe('additionalGuestOrdinal', () => {

  it('additionalGuestOrdinal is exported', () => {
    expect(typeof additionalGuestOrdinal).toBe('function');
  });

});

describe('resolveListingGuestCapacity', () => {

  it('resolveListingGuestCapacity is exported', () => {
    expect(typeof resolveListingGuestCapacity).toBe('function');
  });

});

describe('clampBookingGuestCounts', () => {

  it('clampBookingGuestCounts is exported', () => {
    expect(typeof clampBookingGuestCounts).toBe('function');
  });

});

describe('canAdjustBookingGuestCount', () => {

  it('canAdjustBookingGuestCount is exported', () => {
    expect(typeof canAdjustBookingGuestCount).toBe('function');
  });

});

describe('adjustBookingGuestCount', () => {

  it('adjustBookingGuestCount is exported', () => {
    expect(typeof adjustBookingGuestCount).toBe('function');
  });

});

describe('formatBookingGuestSummary', () => {

  it('formatBookingGuestSummary is exported', () => {
    expect(typeof formatBookingGuestSummary).toBe('function');
  });

});

describe('ADULT_MIN_AGE', () => {
  it('is defined', () => {
    expect(ADULT_MIN_AGE).toBeDefined();
  });
});

describe('VALID_ID_MIN_AGE', () => {
  it('is defined', () => {
    expect(VALID_ID_MIN_AGE).toBeDefined();
  });
});

describe('PRIMARY_GUEST_MIN_AGE', () => {
  it('is defined', () => {
    expect(PRIMARY_GUEST_MIN_AGE).toBeDefined();
  });
});

describe('DEFAULT_GUEST_AGE', () => {
  it('is defined', () => {
    expect(DEFAULT_GUEST_AGE).toBeDefined();
  });
});

describe('OCCUPANCY_CHILD_MAX_AGE', () => {
  it('is defined', () => {
    expect(OCCUPANCY_CHILD_MAX_AGE).toBeDefined();
  });
});

describe('AZURE_CHILD_MAX_AGE', () => {
  it('is defined', () => {
    expect(AZURE_CHILD_MAX_AGE).toBeDefined();
  });
});

describe('FIFTH_PARTY_GUEST_MAX_AGE', () => {
  it('is defined', () => {
    expect(FIFTH_PARTY_GUEST_MAX_AGE).toBeDefined();
  });
});

describe('AZURE_MAX_ADULTS', () => {
  it('is defined', () => {
    expect(AZURE_MAX_ADULTS).toBeDefined();
  });
});

describe('MAX_GUESTS', () => {
  it('is defined', () => {
    expect(MAX_GUESTS).toBeDefined();
  });
});

describe('AZURE_ADULT_LIMIT_MESSAGE', () => {
  it('is defined', () => {
    expect(AZURE_ADULT_LIMIT_MESSAGE).toBeDefined();
  });
});






