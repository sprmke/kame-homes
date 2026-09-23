import { describe, expect, it } from 'vitest';

import { buildParkingListEntries, toParkingListEntry, parkingListEntriesForSlots, parkingSlotsFromEntries } from '@/features/guest/marketing/parkings/lib/parkingListEntries';

describe('buildParkingListEntries', () => {

  it('buildParkingListEntries is exported', () => {
    expect(typeof buildParkingListEntries).toBe('function');
  });

});

describe('toParkingListEntry', () => {

  it('toParkingListEntry is exported', () => {
    expect(typeof toParkingListEntry).toBe('function');
  });

});

describe('parkingListEntriesForSlots', () => {

  it('parkingListEntriesForSlots is exported', () => {
    expect(typeof parkingListEntriesForSlots).toBe('function');
  });

});

describe('parkingSlotsFromEntries', () => {

  it('parkingSlotsFromEntries is exported', () => {
    expect(typeof parkingSlotsFromEntries).toBe('function');
  });

});
