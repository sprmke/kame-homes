import { describe, expect, it } from 'vitest';

import { formatBookingDate, formatIsoDate, formatBookingDateShort, formatBookingDateTime, formatRelative } from '@/utils/format/bookingDisplay';

describe('formatBookingDate', () => {

  it('formatBookingDate is exported', () => {
    expect(typeof formatBookingDate).toBe('function');
  });

});

describe('formatIsoDate', () => {

  it('formatIsoDate is exported', () => {
    expect(typeof formatIsoDate).toBe('function');
  });

});

describe('formatBookingDateShort', () => {

  it('formatBookingDateShort is exported', () => {
    expect(typeof formatBookingDateShort).toBe('function');
  });

});

describe('formatBookingDateTime', () => {

  it('formatBookingDateTime is exported', () => {
    expect(typeof formatBookingDateTime).toBe('function');
  });

});

describe('formatRelative', () => {

  it('formatRelative is exported', () => {
    expect(typeof formatRelative).toBe('function');
  });

});

