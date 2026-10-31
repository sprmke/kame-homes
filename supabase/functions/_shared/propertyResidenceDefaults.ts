/**
 * Per-residence property defaults — keep in sync with ui propertyResidenceDefaults.ts.
 */

export type NumericRange = {
  min: number;
  max: number;
  default: number;
};

export type ResidencePropertyDefaults = {
  bedrooms: NumericRange;
  bathrooms: NumericRange;
  floors: NumericRange;
  maxAdults: NumericRange;
  maxChildren: NumericRange;
  checkInTime: string;
  checkOutTime: string;
};

export const DEFAULT_RESIDENCE_NAME = 'Azure North Residences';

const AZURE_NORTH_DEFAULTS: ResidencePropertyDefaults = {
  bedrooms: { min: 1, max: 2, default: 1 },
  bathrooms: { min: 1, max: 1, default: 1 },
  floors: { min: 1, max: 29, default: 1 },
  maxAdults: { min: 1, max: 6, default: 4 },
  maxChildren: { min: 0, max: 4, default: 0 },
  checkInTime: '14:00',
  checkOutTime: '12:00',
};

const GENERIC_DEFAULTS: ResidencePropertyDefaults = {
  bedrooms: { min: 0, max: 20, default: 1 },
  bathrooms: { min: 0, max: 20, default: 1 },
  floors: { min: 1, max: 50, default: 1 },
  maxAdults: { min: 1, max: 30, default: 4 },
  maxChildren: { min: 0, max: 30, default: 0 },
  checkInTime: '14:00',
  checkOutTime: '12:00',
};

const DEFAULTS_BY_RESIDENCE: Record<string, ResidencePropertyDefaults> = {
  [DEFAULT_RESIDENCE_NAME]: AZURE_NORTH_DEFAULTS,
};

export function getResidencePropertyDefaults(residenceName: string): ResidencePropertyDefaults {
  const normalized = residenceName.trim();
  return DEFAULTS_BY_RESIDENCE[normalized] ?? GENERIC_DEFAULTS;
}

export function clampToRange(value: number, range: NumericRange): number {
  if (!Number.isFinite(value)) return range.default;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

export function validateNumericField(
  value: number,
  range: NumericRange,
  label: string
): string | null {
  if (!Number.isFinite(value)) {
    return `${label} must be a number`;
  }
  if (value < range.min || value > range.max) {
    return `${label} must be between ${range.min} and ${range.max}`;
  }
  return null;
}

export function validatePropertyDetailsForResidence(settings: {
  residenceName?: string | null;
  bedrooms?: unknown;
  bathrooms?: unknown;
  floors?: unknown;
  maxAdults?: unknown;
  maxChildren?: unknown;
}): string | null {
  const defaults = getResidencePropertyDefaults(
    (settings.residenceName ?? '').trim() || DEFAULT_RESIDENCE_NAME
  );
  const bedrooms = Number(settings.bedrooms);
  const bathrooms = Number(settings.bathrooms);
  const floors = Number(settings.floors);
  const maxAdults = Number(settings.maxAdults);
  const maxChildren = Number(settings.maxChildren);

  return (
    validateNumericField(bedrooms, defaults.bedrooms, 'Bedrooms') ??
    validateNumericField(bathrooms, defaults.bathrooms, 'Bathrooms') ??
    validateNumericField(floors, defaults.floors, 'Floor') ??
    validateNumericField(maxAdults, defaults.maxAdults, 'Max adults') ??
    validateNumericField(maxChildren, defaults.maxChildren, 'Max children')
  );
}

export function defaultPropertySettingsForResidence(
  residenceName: string
): Record<string, unknown> {
  const defaults = getResidencePropertyDefaults(residenceName);
  const maxAdults = defaults.maxAdults.default;
  const maxChildren = defaults.maxChildren.default;
  return {
    bedrooms: defaults.bedrooms.default,
    bathrooms: defaults.bathrooms.default,
    floors: defaults.floors.default,
    maxAdults,
    maxChildren,
    maxGuests: maxAdults + maxChildren,
    checkInTime: defaults.checkInTime,
    checkOutTime: defaults.checkOutTime,
    selfCheckIn: false,
    enabledAmenities: [],
    customAmenities: [],
    enabledHouseRules: [],
    customHouseRules: [],
    cancellationPolicy: { type: 'grace_period', gracePeriodHours: 48 },
    media: [],
  };
}
