import { describe, expect, it } from 'vitest';

import { isAzureNorthResidence, mergeDevelopmentPoolSettings, createGuestGuideId, emptyGuestGuide, parseGuestGuides, validateGuestGuides, AZURE_NORTH_RESIDENCE_NAME, DEFAULT_AZURE_NORTH_POOL_FEE, DEFAULT_AZURE_NORTH_POOL_SCHEDULE } from '@/features/dashboard/super-admin/lib/developmentGuestInfo';

describe('isAzureNorthResidence', () => {

  it('isAzureNorthResidence is exported', () => {
    expect(typeof isAzureNorthResidence).toBe('function');
  });

});

describe('mergeDevelopmentPoolSettings', () => {

  it('mergeDevelopmentPoolSettings is exported', () => {
    expect(typeof mergeDevelopmentPoolSettings).toBe('function');
  });

});

describe('createGuestGuideId', () => {

  it('createGuestGuideId is exported', () => {
    expect(typeof createGuestGuideId).toBe('function');
  });

});

describe('emptyGuestGuide', () => {

  it('emptyGuestGuide is exported', () => {
    expect(typeof emptyGuestGuide).toBe('function');
  });

});

describe('parseGuestGuides', () => {

  it('parseGuestGuides is exported', () => {
    expect(typeof parseGuestGuides).toBe('function');
  });

});

describe('validateGuestGuides', () => {

  it('validateGuestGuides is exported', () => {
    expect(typeof validateGuestGuides).toBe('function');
  });

});

describe('AZURE_NORTH_RESIDENCE_NAME', () => {
  it('is defined', () => {
    expect(AZURE_NORTH_RESIDENCE_NAME).toBeDefined();
  });
});

describe('DEFAULT_AZURE_NORTH_POOL_FEE', () => {
  it('is defined', () => {
    expect(DEFAULT_AZURE_NORTH_POOL_FEE).toBeDefined();
  });
});

describe('DEFAULT_AZURE_NORTH_POOL_SCHEDULE', () => {
  it('is defined', () => {
    expect(DEFAULT_AZURE_NORTH_POOL_SCHEDULE).toBeDefined();
  });
});
