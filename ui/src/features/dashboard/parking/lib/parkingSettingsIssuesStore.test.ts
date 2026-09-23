import { describe, expect, it } from 'vitest';

import { setParkingSettingsIssueSections, clearParkingSettingsIssueSections, subscribeParkingSettingsIssues, getParkingSettingsIssueSections, hasParkingSettingsIssues } from '@/features/dashboard/parking/lib/parkingSettingsIssuesStore';

describe('setParkingSettingsIssueSections', () => {

  it('setParkingSettingsIssueSections is exported', () => {
    expect(typeof setParkingSettingsIssueSections).toBe('function');
  });

});

describe('clearParkingSettingsIssueSections', () => {

  it('clearParkingSettingsIssueSections is exported', () => {
    expect(typeof clearParkingSettingsIssueSections).toBe('function');
  });

});

describe('subscribeParkingSettingsIssues', () => {

  it('subscribeParkingSettingsIssues is exported', () => {
    expect(typeof subscribeParkingSettingsIssues).toBe('function');
  });

});

describe('getParkingSettingsIssueSections', () => {

  it('getParkingSettingsIssueSections is exported', () => {
    expect(typeof getParkingSettingsIssueSections).toBe('function');
  });

});

describe('hasParkingSettingsIssues', () => {

  it('hasParkingSettingsIssues is exported', () => {
    expect(typeof hasParkingSettingsIssues).toBe('function');
  });

});
