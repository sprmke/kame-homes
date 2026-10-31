import { Car, type LucideIcon } from 'lucide-react';

export const PARKING_AMENITY_CATEGORY_ID = 'parking';

export const CUSTOM_PARKING_AMENITY_MAX_LENGTH = 50;

export type CustomParkingAmenity = {
  id: string;
  name: string;
  categoryId: typeof PARKING_AMENITY_CATEGORY_ID;
};

export type ParkingAmenityCategory = {
  id: typeof PARKING_AMENITY_CATEGORY_ID;
  name: string;
  icon: LucideIcon;
  amenities: { id: string; name: string }[];
};

/** Default parking slot features — aligned with public mock catalog + create-parking defaults. */
export const PARKING_AMENITY_CATEGORY: ParkingAmenityCategory = {
  id: PARKING_AMENITY_CATEGORY_ID,
  name: 'Parking',
  icon: Car,
  amenities: [
    { id: 'cctv', name: 'CCTV' },
    { id: 'security_24_7', name: '24/7 Security' },
    { id: 'gated_access', name: 'Gated Access' },
    { id: 'fire_suppression', name: 'Fire Suppression' },
    { id: 'covered', name: 'Covered' },
    { id: 'covered_shade', name: 'Covered Shade' },
    { id: 'ev_charging', name: 'EV Charging Station' },
    { id: 'accessible_ramp', name: 'Accessible Ramp' },
    { id: 'extra_wide_bay', name: 'Extra Wide Bay' },
    { id: 'oversized_vehicle', name: 'Oversized Vehicle' },
    { id: 'visitor_parking', name: 'Visitor Parking' },
    { id: 'motorcycle_bay', name: 'Motorcycle Bay' },
  ],
};

const PRESET_BY_ID = new Map(
  PARKING_AMENITY_CATEGORY.amenities.map((entry) => [entry.id, entry.name])
);

const PRESET_BY_NAME = new Map(
  PARKING_AMENITY_CATEGORY.amenities.map((entry) => [entry.name.trim().toLowerCase(), entry.id])
);

export function parkingPresetFeatureName(id: string): string | null {
  return PRESET_BY_ID.get(id) ?? null;
}

export function resolveParkingFeatureLabels(input: {
  enabledParkingAmenities: string[];
  customParkingAmenities: CustomParkingAmenity[];
}): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const id of input.enabledParkingAmenities) {
    const preset = parkingPresetFeatureName(id);
    if (preset) {
      const key = preset.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        labels.push(preset);
      }
      continue;
    }

    const custom = input.customParkingAmenities.find((entry) => entry.id === id);
    if (custom) {
      const trimmed = custom.name.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        labels.push(trimmed);
      }
    }
  }

  return labels;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readCustomParkingAmenities(value: unknown): CustomParkingAmenity[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is CustomParkingAmenity =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as CustomParkingAmenity).id === 'string' &&
      typeof (entry as CustomParkingAmenity).name === 'string' &&
      (entry as CustomParkingAmenity).categoryId === PARKING_AMENITY_CATEGORY_ID
  );
}

/** Hydrate amenity draft from `parkings.settings`, migrating legacy `features: string[]` when needed. */
export function parkingFeaturesDraftFromSettings(settings: Record<string, unknown>): {
  enabledParkingAmenities: string[];
  customParkingAmenities: CustomParkingAmenity[];
} {
  const enabledFromSettings = readStringArray(settings.enabledParkingAmenities);
  const customFromSettings = readCustomParkingAmenities(settings.customParkingAmenities);

  if (enabledFromSettings.length > 0 || customFromSettings.length > 0) {
    return {
      enabledParkingAmenities: enabledFromSettings,
      customParkingAmenities: customFromSettings,
    };
  }

  const legacyLabels = readStringArray(settings.features);
  if (legacyLabels.length === 0) {
    return { enabledParkingAmenities: [], customParkingAmenities: [] };
  }

  const enabledParkingAmenities: string[] = [];
  const customParkingAmenities: CustomParkingAmenity[] = [];

  for (const label of legacyLabels) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    const presetId = PRESET_BY_NAME.get(trimmed.toLowerCase());
    if (presetId) {
      if (!enabledParkingAmenities.includes(presetId)) {
        enabledParkingAmenities.push(presetId);
      }
      continue;
    }

    const custom: CustomParkingAmenity = {
      id: `legacy_${PARKING_AMENITY_CATEGORY_ID}_${trimmed.toLowerCase().replace(/\s+/g, '_')}`,
      name: trimmed,
      categoryId: PARKING_AMENITY_CATEGORY_ID,
    };
    customParkingAmenities.push(custom);
    enabledParkingAmenities.push(custom.id);
  }

  return { enabledParkingAmenities, customParkingAmenities };
}

export function parkingFeaturesDraftIsDirty(
  draft: { enabledParkingAmenities: string[]; customParkingAmenities: CustomParkingAmenity[] },
  baseline: { enabledParkingAmenities: string[]; customParkingAmenities: CustomParkingAmenity[] }
): boolean {
  return (
    JSON.stringify(draft.enabledParkingAmenities) !==
      JSON.stringify(baseline.enabledParkingAmenities) ||
    JSON.stringify(draft.customParkingAmenities) !== JSON.stringify(baseline.customParkingAmenities)
  );
}

export function parkingFeaturesSettingsPatch(input: {
  enabledParkingAmenities: string[];
  customParkingAmenities: CustomParkingAmenity[];
}): Record<string, unknown> {
  return {
    enabledParkingAmenities: input.enabledParkingAmenities,
    customParkingAmenities: input.customParkingAmenities,
    features: resolveParkingFeatureLabels(input),
  };
}
