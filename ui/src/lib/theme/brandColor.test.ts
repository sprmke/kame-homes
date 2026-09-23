import { describe, expect, it } from 'vitest';

import { buildBrandGradientCss, hexToHslComponents, brandTransitionGradientStops, readCssBrandGradientStops, resolveBrandTransitionGradientStops, resolveBrandWordmarkTextColors, resolveOrgBrandHex, isDefaultOrgBrandColor, propertyBrandColorFormValue, propertyBrandColorStoredValue, propertyBrandColorsEquivalent, buildDashboardBrandStyle, buildGuestBrandStyle, DEFAULT_ORG_BRAND_COLOR, resolveGuestBrandHex } from '@/lib/theme/brandColor';

describe('buildBrandGradientCss', () => {

  it('buildBrandGradientCss is exported', () => {
    expect(typeof buildBrandGradientCss).toBe('function');
  });

});

describe('hexToHslComponents', () => {

  it('hexToHslComponents is exported', () => {
    expect(typeof hexToHslComponents).toBe('function');
  });

});

describe('brandTransitionGradientStops', () => {

  it('brandTransitionGradientStops is exported', () => {
    expect(typeof brandTransitionGradientStops).toBe('function');
  });

});

describe('readCssBrandGradientStops', () => {

  it('readCssBrandGradientStops is exported', () => {
    expect(typeof readCssBrandGradientStops).toBe('function');
  });

});

describe('resolveBrandTransitionGradientStops', () => {

  it('resolveBrandTransitionGradientStops is exported', () => {
    expect(typeof resolveBrandTransitionGradientStops).toBe('function');
  });

});

describe('resolveBrandWordmarkTextColors', () => {

  it('resolveBrandWordmarkTextColors is exported', () => {
    expect(typeof resolveBrandWordmarkTextColors).toBe('function');
  });

});

describe('resolveOrgBrandHex', () => {

  it('resolveOrgBrandHex is exported', () => {
    expect(typeof resolveOrgBrandHex).toBe('function');
  });

});

describe('isDefaultOrgBrandColor', () => {

  it('isDefaultOrgBrandColor is exported', () => {
    expect(typeof isDefaultOrgBrandColor).toBe('function');
  });

});

describe('propertyBrandColorFormValue', () => {

  it('propertyBrandColorFormValue is exported', () => {
    expect(typeof propertyBrandColorFormValue).toBe('function');
  });

});

describe('propertyBrandColorStoredValue', () => {

  it('propertyBrandColorStoredValue is exported', () => {
    expect(typeof propertyBrandColorStoredValue).toBe('function');
  });

});

describe('propertyBrandColorsEquivalent', () => {

  it('propertyBrandColorsEquivalent is exported', () => {
    expect(typeof propertyBrandColorsEquivalent).toBe('function');
  });

});

describe('buildDashboardBrandStyle', () => {

  it('buildDashboardBrandStyle is exported', () => {
    expect(typeof buildDashboardBrandStyle).toBe('function');
  });

});

describe('buildGuestBrandStyle', () => {

  it('buildGuestBrandStyle is exported', () => {
    expect(typeof buildGuestBrandStyle).toBe('function');
  });

});

describe('DEFAULT_ORG_BRAND_COLOR', () => {
  it('is defined', () => {
    expect(DEFAULT_ORG_BRAND_COLOR).toBeDefined();
  });
});

describe('resolveGuestBrandHex', () => {
  it('is defined', () => {
    expect(resolveGuestBrandHex).toBeDefined();
  });
});
