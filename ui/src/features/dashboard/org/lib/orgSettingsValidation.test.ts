import { describe, expect, it } from 'vitest';

import { validateOrgTagline, validateOrgDescription, validateOrgBrandColor, validateOrgContactRole, readOrgSettingsString, DUPLICATE_ORGANIZATION_NAME_MESSAGE, ORG_TAGLINE_MAX_LENGTH, ORG_DESCRIPTION_MAX_LENGTH, ORG_CONTACT_ROLE_VALUES } from '@/features/dashboard/org/lib/orgSettingsValidation';

describe('validateOrgTagline', () => {

  it('validateOrgTagline is exported', () => {
    expect(typeof validateOrgTagline).toBe('function');
  });

});

describe('validateOrgDescription', () => {

  it('validateOrgDescription is exported', () => {
    expect(typeof validateOrgDescription).toBe('function');
  });

});

describe('validateOrgBrandColor', () => {

  it('validateOrgBrandColor is exported', () => {
    expect(typeof validateOrgBrandColor).toBe('function');
  });

});

describe('validateOrgContactRole', () => {

  it('validateOrgContactRole is exported', () => {
    expect(typeof validateOrgContactRole).toBe('function');
  });

});

describe('readOrgSettingsString', () => {

  it('readOrgSettingsString is exported', () => {
    expect(typeof readOrgSettingsString).toBe('function');
  });

});

describe('DUPLICATE_ORGANIZATION_NAME_MESSAGE', () => {
  it('is defined', () => {
    expect(DUPLICATE_ORGANIZATION_NAME_MESSAGE).toBeDefined();
  });
});

describe('ORG_TAGLINE_MAX_LENGTH', () => {
  it('is defined', () => {
    expect(ORG_TAGLINE_MAX_LENGTH).toBeDefined();
  });
});

describe('ORG_DESCRIPTION_MAX_LENGTH', () => {
  it('is defined', () => {
    expect(ORG_DESCRIPTION_MAX_LENGTH).toBeDefined();
  });
});

describe('ORG_CONTACT_ROLE_VALUES', () => {
  it('is defined', () => {
    expect(ORG_CONTACT_ROLE_VALUES).toBeDefined();
  });
});
