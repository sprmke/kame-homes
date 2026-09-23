import { describe, expect, it } from 'vitest';

import { propertyMediaFromProperty, propertyGuestCapacityTotal, propertyProfileDraftFromProperty, propertyProfileDbFieldsDirty, propertyProfileExtendedDirty, propertyProfileDraftIsDirty, propertyProfileSettingsPatch, propertyProfileDraftToUpdatePayload, gafTowerUnitFromProfile, propertySlugPreview } from '@/features/dashboard/org/lib/propertySettingsForm';

describe('propertyMediaFromProperty', () => {

  it('propertyMediaFromProperty is exported', () => {
    expect(typeof propertyMediaFromProperty).toBe('function');
  });

});

describe('propertyGuestCapacityTotal', () => {

  it('propertyGuestCapacityTotal is exported', () => {
    expect(typeof propertyGuestCapacityTotal).toBe('function');
  });

});

describe('propertyProfileDraftFromProperty', () => {

  it('propertyProfileDraftFromProperty is exported', () => {
    expect(typeof propertyProfileDraftFromProperty).toBe('function');
  });

});

describe('propertyProfileDbFieldsDirty', () => {

  it('propertyProfileDbFieldsDirty is exported', () => {
    expect(typeof propertyProfileDbFieldsDirty).toBe('function');
  });

});

describe('propertyProfileExtendedDirty', () => {

  it('propertyProfileExtendedDirty is exported', () => {
    expect(typeof propertyProfileExtendedDirty).toBe('function');
  });

});

describe('propertyProfileDraftIsDirty', () => {

  it('propertyProfileDraftIsDirty is exported', () => {
    expect(typeof propertyProfileDraftIsDirty).toBe('function');
  });

});

describe('propertyProfileSettingsPatch', () => {

  it('propertyProfileSettingsPatch is exported', () => {
    expect(typeof propertyProfileSettingsPatch).toBe('function');
  });

});

describe('propertyProfileDraftToUpdatePayload', () => {

  it('propertyProfileDraftToUpdatePayload is exported', () => {
    expect(typeof propertyProfileDraftToUpdatePayload).toBe('function');
  });

});

describe('gafTowerUnitFromProfile', () => {

  it('gafTowerUnitFromProfile is exported', () => {
    expect(typeof gafTowerUnitFromProfile).toBe('function');
  });

});

describe('propertySlugPreview', () => {

  it('propertySlugPreview is exported', () => {
    expect(typeof propertySlugPreview).toBe('function');
  });

});
