import { describe, expect, it } from 'vitest';

import { normalizeDevelopmentParkingLevel, normalizeDevelopmentParkingLevels, defaultParkingLevelsForDevelopment, readDevelopmentParkingLevels } from '@/features/dashboard/super-admin/lib/developmentParking';

describe('normalizeDevelopmentParkingLevel', () => {

  it('normalizeDevelopmentParkingLevel is exported', () => {
    expect(typeof normalizeDevelopmentParkingLevel).toBe('function');
  });

});

describe('normalizeDevelopmentParkingLevels', () => {

  it('normalizeDevelopmentParkingLevels is exported', () => {
    expect(typeof normalizeDevelopmentParkingLevels).toBe('function');
  });

});

describe('defaultParkingLevelsForDevelopment', () => {

  it('defaultParkingLevelsForDevelopment is exported', () => {
    expect(typeof defaultParkingLevelsForDevelopment).toBe('function');
  });

});

describe('readDevelopmentParkingLevels', () => {

  it('readDevelopmentParkingLevels is exported', () => {
    expect(typeof readDevelopmentParkingLevels).toBe('function');
  });

});
