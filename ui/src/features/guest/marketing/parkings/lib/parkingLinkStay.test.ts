import { describe, expect, it } from 'vitest';

import { isParkingLinkStayId, readParkingLinkStayFromSearch, captureParkingLinkStayFromSearch, getParkingLinkStayId, clearParkingLinkStayId } from '@/features/guest/marketing/parkings/lib/parkingLinkStay';

describe('isParkingLinkStayId', () => {

  it('isParkingLinkStayId is exported', () => {
    expect(typeof isParkingLinkStayId).toBe('function');
  });

});

describe('readParkingLinkStayFromSearch', () => {

  it('readParkingLinkStayFromSearch is exported', () => {
    expect(typeof readParkingLinkStayFromSearch).toBe('function');
  });

});

describe('captureParkingLinkStayFromSearch', () => {

  it('captureParkingLinkStayFromSearch is exported', () => {
    expect(typeof captureParkingLinkStayFromSearch).toBe('function');
  });

});

describe('getParkingLinkStayId', () => {

  it('getParkingLinkStayId is exported', () => {
    expect(typeof getParkingLinkStayId).toBe('function');
  });

});

describe('clearParkingLinkStayId', () => {

  it('clearParkingLinkStayId is exported', () => {
    expect(typeof clearParkingLinkStayId).toBe('function');
  });

});
