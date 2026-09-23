import { describe, expect, it } from 'vitest';

import { normalizeSlugInput, slugifyOrgName, orgSettingsDraftFromOrg, orgSettingsDraftIsDirty, orgSettingsDraftToPayload, validateOrgSettingsDraft, orgSlugPreview } from '@/features/dashboard/org/lib/orgSettingsForm';

describe('normalizeSlugInput', () => {

  it('normalizeSlugInput is exported', () => {
    expect(typeof normalizeSlugInput).toBe('function');
  });

});

describe('slugifyOrgName', () => {

  it('slugifyOrgName is exported', () => {
    expect(typeof slugifyOrgName).toBe('function');
  });

});

describe('orgSettingsDraftFromOrg', () => {

  it('orgSettingsDraftFromOrg is exported', () => {
    expect(typeof orgSettingsDraftFromOrg).toBe('function');
  });

});

describe('orgSettingsDraftIsDirty', () => {

  it('orgSettingsDraftIsDirty is exported', () => {
    expect(typeof orgSettingsDraftIsDirty).toBe('function');
  });

});

describe('orgSettingsDraftToPayload', () => {

  it('orgSettingsDraftToPayload is exported', () => {
    expect(typeof orgSettingsDraftToPayload).toBe('function');
  });

});

describe('validateOrgSettingsDraft', () => {

  it('validateOrgSettingsDraft is exported', () => {
    expect(typeof validateOrgSettingsDraft).toBe('function');
  });

});

describe('orgSlugPreview', () => {

  it('orgSlugPreview is exported', () => {
    expect(typeof orgSlugPreview).toBe('function');
  });

});
