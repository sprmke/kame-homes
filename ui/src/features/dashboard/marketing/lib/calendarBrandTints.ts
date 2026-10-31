import { resolveOrgBrandHex } from '@/lib/theme/brandColor';
import { mixHexToward } from '@/lib/theme/colorConvert';

export type CalendarBrandPalette = {
  brand: string;
  brandLight: string;
  brandDark: string;
};

/** Light tint for “today” cell background. */
export function calendarBrandLightTint(brandColor?: string): string {
  const brand = resolveOrgBrandHex(brandColor);
  return mixHexToward(brand, { r: 255, g: 255, b: 255 }, 0.9);
}

/** Slightly darker brand for secondary status (e.g. checked-in). */
export function calendarBrandDarkShade(brandColor?: string): string {
  const brand = resolveOrgBrandHex(brandColor);
  return mixHexToward(brand, { r: 0, g: 0, b: 0 }, 0.18);
}

export function calendarBrandPalette(brandColor?: string): CalendarBrandPalette {
  const brand = resolveOrgBrandHex(brandColor);
  return {
    brand,
    brandLight: calendarBrandLightTint(brand),
    brandDark: calendarBrandDarkShade(brand),
  };
}
