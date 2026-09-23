import { describe, expect, it } from 'vitest';

import { isLegacyPlatformOrgBrand, resolveOrgDisplayName, appPageTitle, publicPageTitle, platformCopyrightLine, platformWordmarkParts, platformMarkInitial, platformWatermarkLabel, platformLegalSubject, platformLegalIntro, platformProductLabel, PLATFORM_APP_NAME, PLATFORM_CONTACT_EMAIL, APP_TITLE, isLegacyKameHomeBrand } from '@/lib/platformBranding';

describe('isLegacyPlatformOrgBrand', () => {

  it('isLegacyPlatformOrgBrand is exported', () => {
    expect(typeof isLegacyPlatformOrgBrand).toBe('function');
  });

});

describe('resolveOrgDisplayName', () => {

  it('resolveOrgDisplayName is exported', () => {
    expect(typeof resolveOrgDisplayName).toBe('function');
  });

});

describe('appPageTitle', () => {

  it('appPageTitle is exported', () => {
    expect(typeof appPageTitle).toBe('function');
  });

});

describe('publicPageTitle', () => {

  it('publicPageTitle is exported', () => {
    expect(typeof publicPageTitle).toBe('function');
  });

});

describe('platformCopyrightLine', () => {

  it('platformCopyrightLine is exported', () => {
    expect(typeof platformCopyrightLine).toBe('function');
  });

});

describe('platformWordmarkParts', () => {

  it('platformWordmarkParts is exported', () => {
    expect(typeof platformWordmarkParts).toBe('function');
  });

});

describe('platformMarkInitial', () => {

  it('platformMarkInitial is exported', () => {
    expect(typeof platformMarkInitial).toBe('function');
  });

});

describe('platformWatermarkLabel', () => {

  it('platformWatermarkLabel is exported', () => {
    expect(typeof platformWatermarkLabel).toBe('function');
  });

});

describe('platformLegalSubject', () => {

  it('platformLegalSubject is exported', () => {
    expect(typeof platformLegalSubject).toBe('function');
  });

});

describe('platformLegalIntro', () => {

  it('platformLegalIntro is exported', () => {
    expect(typeof platformLegalIntro).toBe('function');
  });

});

describe('platformProductLabel', () => {

  it('platformProductLabel is exported', () => {
    expect(typeof platformProductLabel).toBe('function');
  });

});

describe('PLATFORM_APP_NAME', () => {
  it('is defined', () => {
    expect(PLATFORM_APP_NAME).toBeDefined();
  });
});

describe('PLATFORM_CONTACT_EMAIL', () => {
  it('is defined', () => {
    expect(PLATFORM_CONTACT_EMAIL).toBeDefined();
  });
});

describe('APP_TITLE', () => {
  it('is defined', () => {
    expect(APP_TITLE).toBeDefined();
  });
});

describe('isLegacyKameHomeBrand', () => {
  it('is defined', () => {
    expect(isLegacyKameHomeBrand).toBeDefined();
  });
});

