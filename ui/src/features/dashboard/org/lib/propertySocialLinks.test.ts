import { describe, expect, it } from 'vitest';

import { socialLinkModeFromStored, socialLinkModesFromDraft, propertySocialLinkInherits, effectiveSocialLink, propertySocialLinkStoredValue, propertySocialLinksEquivalent, allPropertySocialLinksInherit, anyPropertySocialLinkCustom, socialUrlMapFromLinks, effectiveSocialUrlMap, effectiveSocialUrlMapWithModes, normalizePropertySocialLinksForSave, countFilledSocialUrls } from '@/features/dashboard/org/lib/propertySocialLinks';

describe('socialLinkModeFromStored', () => {

  it('socialLinkModeFromStored is exported', () => {
    expect(typeof socialLinkModeFromStored).toBe('function');
  });

});

describe('socialLinkModesFromDraft', () => {

  it('socialLinkModesFromDraft is exported', () => {
    expect(typeof socialLinkModesFromDraft).toBe('function');
  });

});

describe('propertySocialLinkInherits', () => {

  it('propertySocialLinkInherits is exported', () => {
    expect(typeof propertySocialLinkInherits).toBe('function');
  });

});

describe('effectiveSocialLink', () => {

  it('effectiveSocialLink is exported', () => {
    expect(typeof effectiveSocialLink).toBe('function');
  });

});

describe('propertySocialLinkStoredValue', () => {

  it('propertySocialLinkStoredValue is exported', () => {
    expect(typeof propertySocialLinkStoredValue).toBe('function');
  });

});

describe('propertySocialLinksEquivalent', () => {

  it('propertySocialLinksEquivalent is exported', () => {
    expect(typeof propertySocialLinksEquivalent).toBe('function');
  });

});

describe('allPropertySocialLinksInherit', () => {

  it('allPropertySocialLinksInherit is exported', () => {
    expect(typeof allPropertySocialLinksInherit).toBe('function');
  });

});

describe('anyPropertySocialLinkCustom', () => {

  it('anyPropertySocialLinkCustom is exported', () => {
    expect(typeof anyPropertySocialLinkCustom).toBe('function');
  });

});

describe('socialUrlMapFromLinks', () => {

  it('socialUrlMapFromLinks is exported', () => {
    expect(typeof socialUrlMapFromLinks).toBe('function');
  });

});

describe('effectiveSocialUrlMap', () => {

  it('effectiveSocialUrlMap is exported', () => {
    expect(typeof effectiveSocialUrlMap).toBe('function');
  });

});

describe('effectiveSocialUrlMapWithModes', () => {

  it('effectiveSocialUrlMapWithModes is exported', () => {
    expect(typeof effectiveSocialUrlMapWithModes).toBe('function');
  });

});

describe('normalizePropertySocialLinksForSave', () => {

  it('normalizePropertySocialLinksForSave is exported', () => {
    expect(typeof normalizePropertySocialLinksForSave).toBe('function');
  });

});

describe('countFilledSocialUrls', () => {

  it('countFilledSocialUrls is exported', () => {
    expect(typeof countFilledSocialUrls).toBe('function');
  });

});
