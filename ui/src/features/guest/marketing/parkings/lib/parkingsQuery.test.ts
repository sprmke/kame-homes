import { describe, expect, it } from 'vitest';

import { isParkingLocationFilterParam, parseParkingsQuery, writeParkingsQuery, parkingsQueryToFilterState, filterStateToParkingsQuery, countActiveParkingsQueryFilters, clearParkingsFilters, toParkingListEntry, PARKINGS_SORTS } from '@/features/guest/marketing/parkings/lib/parkingsQuery';

describe('isParkingLocationFilterParam', () => {

  it('isParkingLocationFilterParam is exported', () => {
    expect(typeof isParkingLocationFilterParam).toBe('function');
  });

});

describe('parseParkingsQuery', () => {

  it('parseParkingsQuery is exported', () => {
    expect(typeof parseParkingsQuery).toBe('function');
  });

});

describe('writeParkingsQuery', () => {

  it('writeParkingsQuery is exported', () => {
    expect(typeof writeParkingsQuery).toBe('function');
  });

});

describe('parkingsQueryToFilterState', () => {

  it('parkingsQueryToFilterState is exported', () => {
    expect(typeof parkingsQueryToFilterState).toBe('function');
  });

});

describe('filterStateToParkingsQuery', () => {

  it('filterStateToParkingsQuery is exported', () => {
    expect(typeof filterStateToParkingsQuery).toBe('function');
  });

});

describe('countActiveParkingsQueryFilters', () => {

  it('countActiveParkingsQueryFilters is exported', () => {
    expect(typeof countActiveParkingsQueryFilters).toBe('function');
  });

});

describe('clearParkingsFilters', () => {

  it('clearParkingsFilters is exported', () => {
    expect(typeof clearParkingsFilters).toBe('function');
  });

});

describe('toParkingListEntry', () => {

  it('toParkingListEntry is exported', () => {
    expect(typeof toParkingListEntry).toBe('function');
  });

});

describe('PARKINGS_SORTS', () => {
  it('is defined', () => {
    expect(PARKINGS_SORTS).toBeDefined();
  });
});

