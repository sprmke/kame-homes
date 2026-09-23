import { describe, expect, it } from 'vitest';

import { parkingProfileDraftFromParking, parkingOperationalDraftFromSettings, parkingProfileDraftIsDirty, parkingOperationalDraftIsDirty, parkingCoverImageFromSettings, parkingSlugPreview, parkingProfileSettingsPatch, parkingLocationDraftFromSettings, parkingLocationDraftIsDirty, parkingLocationSettingsPatch, parkingDetailsDraftFromSettings, parkingDetailsDraftIsDirty, parkingDetailsSettingsPatch, parkingBasicDraftFromParking, parkingBasicDraftIsDirty } from '@/features/dashboard/parking/lib/parkingSettingsForm';

describe('parkingProfileDraftFromParking', () => {

  it('parkingProfileDraftFromParking is exported', () => {
    expect(typeof parkingProfileDraftFromParking).toBe('function');
  });

});

describe('parkingOperationalDraftFromSettings', () => {

  it('parkingOperationalDraftFromSettings is exported', () => {
    expect(typeof parkingOperationalDraftFromSettings).toBe('function');
  });

});

describe('parkingProfileDraftIsDirty', () => {

  it('parkingProfileDraftIsDirty is exported', () => {
    expect(typeof parkingProfileDraftIsDirty).toBe('function');
  });

});

describe('parkingOperationalDraftIsDirty', () => {

  it('parkingOperationalDraftIsDirty is exported', () => {
    expect(typeof parkingOperationalDraftIsDirty).toBe('function');
  });

});

describe('parkingCoverImageFromSettings', () => {

  it('parkingCoverImageFromSettings is exported', () => {
    expect(typeof parkingCoverImageFromSettings).toBe('function');
  });

});

describe('parkingSlugPreview', () => {

  it('parkingSlugPreview is exported', () => {
    expect(typeof parkingSlugPreview).toBe('function');
  });

});

describe('parkingProfileSettingsPatch', () => {

  it('parkingProfileSettingsPatch is exported', () => {
    expect(typeof parkingProfileSettingsPatch).toBe('function');
  });

});

describe('parkingLocationDraftFromSettings', () => {

  it('parkingLocationDraftFromSettings is exported', () => {
    expect(typeof parkingLocationDraftFromSettings).toBe('function');
  });

});

describe('parkingLocationDraftIsDirty', () => {

  it('parkingLocationDraftIsDirty is exported', () => {
    expect(typeof parkingLocationDraftIsDirty).toBe('function');
  });

});

describe('parkingLocationSettingsPatch', () => {

  it('parkingLocationSettingsPatch is exported', () => {
    expect(typeof parkingLocationSettingsPatch).toBe('function');
  });

});

describe('parkingDetailsDraftFromSettings', () => {

  it('parkingDetailsDraftFromSettings is exported', () => {
    expect(typeof parkingDetailsDraftFromSettings).toBe('function');
  });

});

describe('parkingDetailsDraftIsDirty', () => {

  it('parkingDetailsDraftIsDirty is exported', () => {
    expect(typeof parkingDetailsDraftIsDirty).toBe('function');
  });

});

describe('parkingDetailsSettingsPatch', () => {

  it('parkingDetailsSettingsPatch is exported', () => {
    expect(typeof parkingDetailsSettingsPatch).toBe('function');
  });

});

describe('parkingBasicDraftFromParking', () => {

  it('parkingBasicDraftFromParking is exported', () => {
    expect(typeof parkingBasicDraftFromParking).toBe('function');
  });

});

describe('parkingBasicDraftIsDirty', () => {

  it('parkingBasicDraftIsDirty is exported', () => {
    expect(typeof parkingBasicDraftIsDirty).toBe('function');
  });

});
