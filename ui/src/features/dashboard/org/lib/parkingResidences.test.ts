import { describe, expect, it } from 'vitest';

import { normalizeParkingLevel, getParkingLevelsForTower, isValidParkingLevelForTower, isAzureNorthParkingTower, isAzureNorthParkingLevel, getParkingResidenceNames, DEFAULT_PARKING_RESIDENCE_NAME, AZURE_NORTH_PARKING_TOWERS, AZURE_NORTH_PARKING_LEVELS, AZURE_NORTH_BAY_PARKING_LEVELS, PARKING_TYPES } from '@/features/dashboard/org/lib/parkingResidences';

describe('normalizeParkingLevel', () => {

  it('normalizeParkingLevel is exported', () => {
    expect(typeof normalizeParkingLevel).toBe('function');
  });

});

describe('getParkingLevelsForTower', () => {

  it('getParkingLevelsForTower is exported', () => {
    expect(typeof getParkingLevelsForTower).toBe('function');
  });

});

describe('isValidParkingLevelForTower', () => {

  it('isValidParkingLevelForTower is exported', () => {
    expect(typeof isValidParkingLevelForTower).toBe('function');
  });

});

describe('isAzureNorthParkingTower', () => {

  it('isAzureNorthParkingTower is exported', () => {
    expect(typeof isAzureNorthParkingTower).toBe('function');
  });

});

describe('isAzureNorthParkingLevel', () => {

  it('isAzureNorthParkingLevel is exported', () => {
    expect(typeof isAzureNorthParkingLevel).toBe('function');
  });

});

describe('getParkingResidenceNames', () => {

  it('getParkingResidenceNames is exported', () => {
    expect(typeof getParkingResidenceNames).toBe('function');
  });

});

describe('DEFAULT_PARKING_RESIDENCE_NAME', () => {
  it('is defined', () => {
    expect(DEFAULT_PARKING_RESIDENCE_NAME).toBeDefined();
  });
});

describe('AZURE_NORTH_PARKING_TOWERS', () => {
  it('is defined', () => {
    expect(AZURE_NORTH_PARKING_TOWERS).toBeDefined();
  });
});

describe('AZURE_NORTH_PARKING_LEVELS', () => {
  it('is defined', () => {
    expect(AZURE_NORTH_PARKING_LEVELS).toBeDefined();
  });
});

describe('AZURE_NORTH_BAY_PARKING_LEVELS', () => {
  it('is defined', () => {
    expect(AZURE_NORTH_BAY_PARKING_LEVELS).toBeDefined();
  });
});

describe('PARKING_TYPES', () => {
  it('is defined', () => {
    expect(PARKING_TYPES).toBeDefined();
  });
});
