import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import type { PropertyProfileDraft } from '@/features/dashboard/org/lib/propertySettingsForm';

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

export function applyResidenceDefaultsToDraft(
  residenceName: string
): Partial<PropertyProfileDraft> {
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
    unitTypeId: 'studio',
    checkInTime: defaults.checkInTime,
    checkOutTime: defaults.checkOutTime,
  };
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

export function validatePropertyDetailsForResidence(
  draft: Pick<
    PropertyProfileDraft,
    'residenceName' | 'bedrooms' | 'bathrooms' | 'floors' | 'maxAdults' | 'maxChildren'
  >
): string | null {
  const defaults = getResidencePropertyDefaults(
    draft.residenceName.trim() || DEFAULT_RESIDENCE_NAME
  );
  return (
    validateNumericField(draft.bedrooms, defaults.bedrooms, 'Bedrooms') ??
    validateNumericField(draft.bathrooms, defaults.bathrooms, 'Bathrooms') ??
    validateNumericField(draft.floors, defaults.floors, 'Floor') ??
    validateNumericField(draft.maxAdults, defaults.maxAdults, 'Max adults') ??
    validateNumericField(draft.maxChildren, defaults.maxChildren, 'Max children')
  );
}
