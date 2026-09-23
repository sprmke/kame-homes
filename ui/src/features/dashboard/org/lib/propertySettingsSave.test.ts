import { describe, expect, it } from 'vitest';

import { propertySettingsSectionDirty, planPropertySettingsSave, buildProfilePatchForSections, buildAppSettingsPatchForSections, applySavedProfileSections, applySavedOperationalSections } from '@/features/dashboard/org/lib/propertySettingsSave';

describe('propertySettingsSectionDirty', () => {

  it('propertySettingsSectionDirty is exported', () => {
    expect(typeof propertySettingsSectionDirty).toBe('function');
  });

});

describe('planPropertySettingsSave', () => {

  it('planPropertySettingsSave is exported', () => {
    expect(typeof planPropertySettingsSave).toBe('function');
  });

});

describe('buildProfilePatchForSections', () => {

  it('buildProfilePatchForSections is exported', () => {
    expect(typeof buildProfilePatchForSections).toBe('function');
  });

});

describe('buildAppSettingsPatchForSections', () => {

  it('buildAppSettingsPatchForSections is exported', () => {
    expect(typeof buildAppSettingsPatchForSections).toBe('function');
  });

});

describe('applySavedProfileSections', () => {

  it('applySavedProfileSections is exported', () => {
    expect(typeof applySavedProfileSections).toBe('function');
  });

});

describe('applySavedOperationalSections', () => {

  it('applySavedOperationalSections is exported', () => {
    expect(typeof applySavedOperationalSections).toBe('function');
  });

});
