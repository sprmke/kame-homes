import { describe, expect, it } from 'vitest';

import {
  buildBrandGradientCss,
  hexToHslComponents,
  brandTransitionGradientStops,
  readCssBrandGradientStops,
  resolveBrandTransitionGradientStops,
  resolveBrandWordmarkTextColors,
  resolveOrgBrandHex,
  isDefaultOrgBrandColor,
  propertyBrandColorFormValue,
  propertyBrandColorStoredValue,
  propertyBrandColorsEquivalent,
  buildDashboardBrandStyle,
  buildGuestBrandStyle,
  DEFAULT_ORG_BRAND_COLOR,
  resolveGuestBrandHex,
  textSafeLightness,
  whiteTextContrast,
  WHITE_TEXT_MIN_CONTRAST,
} from '@/lib/theme/brandColor';

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

function parseHsl(value: string): [number, number, number] {
  const [h, s, l] = value.replace(/%/g, '').split(/\s+/).map(Number);
  return [h!, s!, l!];
}

function firstGradientStop(gradient: string): [number, number, number] {
  const match = gradient.match(/hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)/);
  return [Number(match![1]), Number(match![2]), Number(match![3])];
}

describe('text-safe brand fills', () => {
  const samples = [DEFAULT_ORG_BRAND_COLOR, '#f5c518', '#7fe3d6', '#e53935', '#ffffff', '#1e3a5f'];

  it.each(samples.flatMap((hex) => [true, false].map((isDark) => [hex, isDark] as const)))(
    '%s (dark=%s): white text passes AA on --primary-strong and the CTA gradient',
    (hex, isDark) => {
      const theme = buildDashboardBrandStyle(hex, isDark);
      expect(whiteTextContrast(...parseHsl(theme['--primary-strong']!))).toBeGreaterThanOrEqual(
        WHITE_TEXT_MIN_CONTRAST - 0.05
      );
      expect(
        whiteTextContrast(...firstGradientStop(theme['--brand-gradient']!))
      ).toBeGreaterThanOrEqual(WHITE_TEXT_MIN_CONTRAST - 0.05);
    }
  );

  it('keeps already-dark brand colors unchanged', () => {
    const theme = buildDashboardBrandStyle('#1e3a5f', false);
    expect(theme['--primary-strong']).toBe(theme['--primary']);
  });

  it('keeps hue and saturation, only lowers lightness', () => {
    expect(textSafeLightness(168, 65, 40)).toBe(31);
    const [h, s] = parseHsl(buildDashboardBrandStyle(DEFAULT_ORG_BRAND_COLOR, false)['--primary']!);
    const [hs, ss] = parseHsl(
      buildDashboardBrandStyle(DEFAULT_ORG_BRAND_COLOR, false)['--primary-strong']!
    );
    expect([hs, ss]).toEqual([h, s]);
  });

  it('guest shells receive --primary-strong', () => {
    expect(buildGuestBrandStyle(DEFAULT_ORG_BRAND_COLOR, false)['--primary-strong']).toBeDefined();
  });
});
