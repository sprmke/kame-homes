import { describe, expect, it } from 'vitest';

import { buildPropertyFilterChips, removePropertyFilterChip, buildDevelopmentFilterChips, removeDevelopmentFilterChip, buildParkingFilterChips, removeParkingFilterChip, PROPERTY_SORT_OPTIONS, DEVELOPMENT_SORT_OPTIONS, PARKING_SORT_OPTIONS } from '@/features/guest/marketing/shared/lib/listingFilterChips';

describe('buildPropertyFilterChips', () => {

  it('buildPropertyFilterChips is exported', () => {
    expect(typeof buildPropertyFilterChips).toBe('function');
  });

});

describe('removePropertyFilterChip', () => {

  it('removePropertyFilterChip is exported', () => {
    expect(typeof removePropertyFilterChip).toBe('function');
  });

});

describe('buildDevelopmentFilterChips', () => {

  it('buildDevelopmentFilterChips is exported', () => {
    expect(typeof buildDevelopmentFilterChips).toBe('function');
  });

});

describe('removeDevelopmentFilterChip', () => {

  it('removeDevelopmentFilterChip is exported', () => {
    expect(typeof removeDevelopmentFilterChip).toBe('function');
  });

});

describe('buildParkingFilterChips', () => {

  it('buildParkingFilterChips is exported', () => {
    expect(typeof buildParkingFilterChips).toBe('function');
  });

});

describe('removeParkingFilterChip', () => {

  it('removeParkingFilterChip is exported', () => {
    expect(typeof removeParkingFilterChip).toBe('function');
  });

});

describe('PROPERTY_SORT_OPTIONS', () => {
  it('is defined', () => {
    expect(PROPERTY_SORT_OPTIONS).toBeDefined();
  });
});

describe('DEVELOPMENT_SORT_OPTIONS', () => {
  it('is defined', () => {
    expect(DEVELOPMENT_SORT_OPTIONS).toBeDefined();
  });
});

describe('PARKING_SORT_OPTIONS', () => {
  it('is defined', () => {
    expect(PARKING_SORT_OPTIONS).toBeDefined();
  });
});


