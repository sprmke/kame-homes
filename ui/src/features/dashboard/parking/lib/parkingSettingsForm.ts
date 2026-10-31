import { legacyGcashQrForPaymentMethods } from '@/features/dashboard/lib/storedMediaDisplay';
import { slugifyOrgName } from '@/features/dashboard/org/lib/orgSettingsForm';
import {
  DEFAULT_PARKING_RESIDENCE_NAME,
  normalizeParkingLevel,
  type ParkingType,
} from '@/features/dashboard/org/lib/parkingResidences';
import { parseParkingSlotNumberFromLabel } from '@/features/dashboard/org/lib/parkingSlotDisplay';
import {
  normalizePaymentMethodsDraft,
  paymentMethodsEqual,
  syncLegacyPaymentFieldsFromMethods,
  type PropertyPaymentMethod,
} from '@/features/dashboard/org/lib/paymentMethods';
import {
  readNullableLatitude,
  readNullableLongitude,
  withAzureNorthLocationDefaultsIfEmpty,
  type PropertyLocationFields,
} from '@/features/dashboard/org/lib/propertyLocation';
import type { Parking } from '@/features/dashboard/org/types';
import type { ParkingSettingsPayload } from '@/features/dashboard/parking/hooks/useParkingSettings';
import {
  DEFAULT_PARKING_HEIGHT_CLEARANCE_M,
  DEFAULT_PARKING_SPACE_LENGTH_M,
  DEFAULT_PARKING_SPACE_WIDTH_M,
  parseParkingDimensionInput,
  resolveParkingHeightClearanceM,
  resolveParkingSpaceLengthM,
  resolveParkingSpaceWidthM,
} from '@/features/dashboard/parking/lib/parkingDimensionDefaults';

import { propertyBrandColorFormValue, propertyBrandColorStoredValue } from '@/lib/theme/brandColor';

export type ParkingLocationDraft = PropertyLocationFields;

export type ParkingProfileDraft = {
  tower: string;
  level: string;
  slotNumber: string;
  parkingType: ParkingType;
  residenceName: string;
  brandColor: string;
  description: string;
};

export type ParkingOperationalDraft = {
  paymentMethods: PropertyPaymentMethod[];
  paymentProvider: string;
  gcashName: string;
  gcashNumber: string;
};

export type ParkingVehicleTypeDraft = 'car' | 'motorcycle';

export type ParkingDetailsDraft = {
  spaceLengthM: string;
  spaceWidthM: string;
  heightClearanceM: string;
  checkInTime: string;
  checkOutTime: string;
  acceptedVehicleTypes: ParkingVehicleTypeDraft[];
};

const DESCRIPTION_MAX = 1000;

function readSettingsString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalDimensionString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) return String(parsed);
  }
  return '';
}

function readParkingDimensionString(
  settings: Record<string, unknown>,
  key: string,
  fallback: number
): string {
  const raw = readOptionalDimensionString(settings, key);
  return raw || String(fallback);
}

function parseParkingDimension(value: string, fallback: number): number {
  return parseParkingDimensionInput(value, fallback);
}

export function parkingProfileDraftFromParking(
  parking: Pick<
    Parking,
    'tower' | 'level' | 'slotLabel' | 'parkingType' | 'residenceName' | 'settings'
  >,
  resolvedBrandColor: string
): ParkingProfileDraft {
  const settings = parking.settings ?? {};
  const description =
    readSettingsString(settings, 'description') || readSettingsString(settings, 'notes');
  const brandStored = typeof settings.brandColor === 'string' ? settings.brandColor.trim() : '';

  return {
    tower: parking.tower ?? '',
    level: normalizeParkingLevel(parking.level ?? ''),
    slotNumber: parseParkingSlotNumberFromLabel(parking.slotLabel) || parking.slotLabel,
    parkingType: (parking.parkingType as ParkingType) || 'inside_tower',
    residenceName: parking.residenceName?.trim() || DEFAULT_PARKING_RESIDENCE_NAME,
    brandColor: propertyBrandColorFormValue(brandStored, resolvedBrandColor),
    description,
  };
}

export function parkingOperationalDraftFromSettings(
  settings: ParkingSettingsPayload
): ParkingOperationalDraft {
  const legacyGcashQr = legacyGcashQrForPaymentMethods(
    settings.gcashQrImageUrl ?? '',
    settings.gcashQrImageUrl?.trim() ? 'db' : 'default'
  );
  const paymentMethods = normalizePaymentMethodsDraft(
    settings.paymentMethods as PropertyPaymentMethod[] | undefined,
    {
      paymentProvider: settings.paymentProvider ?? 'gcash',
      gcashName: settings.gcashName ?? '',
      gcashNumber: settings.gcashNumber ?? '',
      gcashQrImageUrl: legacyGcashQr,
    }
  );
  const synced = syncLegacyPaymentFieldsFromMethods(paymentMethods);
  return {
    paymentMethods,
    paymentProvider: synced.paymentProvider,
    gcashName: synced.gcashName,
    gcashNumber: synced.gcashNumber,
  };
}

export function parkingProfileDraftIsDirty(
  draft: ParkingProfileDraft,
  baseline: ParkingProfileDraft,
  resolvedBrandColor: string
): boolean {
  return (
    draft.tower !== baseline.tower ||
    draft.level !== baseline.level ||
    draft.slotNumber !== baseline.slotNumber ||
    draft.parkingType !== baseline.parkingType ||
    draft.residenceName.trim() !== baseline.residenceName.trim() ||
    draft.description.trim() !== baseline.description.trim() ||
    propertyBrandColorStoredValue(draft.brandColor, resolvedBrandColor).toLowerCase() !==
      propertyBrandColorStoredValue(baseline.brandColor, resolvedBrandColor).toLowerCase()
  );
}

export function parkingOperationalDraftIsDirty(
  draft: ParkingOperationalDraft,
  baseline: ParkingOperationalDraft
): boolean {
  return !paymentMethodsEqual(draft.paymentMethods, baseline.paymentMethods);
}

export function parkingCoverImageFromSettings(settings: Record<string, unknown>): string {
  return typeof settings.coverImage === 'string' ? settings.coverImage.trim() : '';
}

/** Live slug preview while slot fields change; falls back to saved slug when unchanged. */
export function parkingSlugPreview(
  displayName: string,
  savedSlug: string,
  baselineDisplayName: string
): string {
  if (displayName.trim() === baselineDisplayName.trim()) {
    return savedSlug;
  }
  if (displayName.trim().length < 2) {
    return savedSlug;
  }
  return slugifyOrgName(displayName);
}

export function parkingProfileSettingsPatch(
  draft: ParkingProfileDraft,
  resolvedBrandColor: string
): Record<string, unknown> {
  return {
    brandColor: propertyBrandColorStoredValue(draft.brandColor, resolvedBrandColor),
    description: draft.description.trim().slice(0, DESCRIPTION_MAX),
  };
}

export function parkingLocationDraftFromSettings(
  settings: Record<string, unknown>,
  residenceName: string | null | undefined = DEFAULT_PARKING_RESIDENCE_NAME
): ParkingLocationDraft {
  const effectiveResidence = residenceName?.trim() || DEFAULT_PARKING_RESIDENCE_NAME;
  const draft: ParkingLocationDraft = {
    address: readSettingsString(settings, 'address'),
    city: readSettingsString(settings, 'city'),
    province: readSettingsString(settings, 'province'),
    country: readSettingsString(settings, 'country') || 'Philippines',
    zipCode: readSettingsString(settings, 'zipCode'),
    latitude: readNullableLatitude(settings),
    longitude: readNullableLongitude(settings),
    mapsUrl: readSettingsString(settings, 'mapsUrl'),
    placeId: readSettingsString(settings, 'placeId'),
  };
  return withAzureNorthLocationDefaultsIfEmpty(effectiveResidence, draft);
}

export function parkingLocationDraftIsDirty(
  draft: ParkingLocationDraft,
  baseline: ParkingLocationDraft
): boolean {
  return (
    draft.address.trim() !== baseline.address.trim() ||
    draft.city.trim() !== baseline.city.trim() ||
    draft.province.trim() !== baseline.province.trim() ||
    draft.country.trim() !== baseline.country.trim() ||
    draft.zipCode.trim() !== baseline.zipCode.trim() ||
    draft.latitude !== baseline.latitude ||
    draft.longitude !== baseline.longitude ||
    draft.mapsUrl.trim() !== baseline.mapsUrl.trim() ||
    draft.placeId.trim() !== baseline.placeId.trim()
  );
}

export function parkingLocationSettingsPatch(draft: ParkingLocationDraft): Record<string, unknown> {
  return {
    address: draft.address.trim(),
    city: draft.city.trim(),
    province: draft.province.trim(),
    country: draft.country.trim() || 'Philippines',
    zipCode: draft.zipCode.trim(),
    latitude: draft.latitude,
    longitude: draft.longitude,
    mapsUrl: draft.mapsUrl.trim(),
    placeId: draft.placeId.trim(),
  };
}

function normalizeAcceptedVehicleTypes(
  value: ReadonlyArray<string> | null | undefined
): ParkingVehicleTypeDraft[] {
  const valid = (value ?? []).filter(
    (v): v is ParkingVehicleTypeDraft => v === 'car' || v === 'motorcycle'
  );
  return valid.length > 0 ? Array.from(new Set(valid)) : ['car'];
}

export function parkingDetailsDraftFromSettings(
  settings: Record<string, unknown>,
  acceptedVehicleTypes?: ReadonlyArray<string> | null
): ParkingDetailsDraft {
  return {
    spaceLengthM: readParkingDimensionString(
      settings,
      'spaceLengthM',
      DEFAULT_PARKING_SPACE_LENGTH_M
    ),
    spaceWidthM: readParkingDimensionString(settings, 'spaceWidthM', DEFAULT_PARKING_SPACE_WIDTH_M),
    heightClearanceM: readParkingDimensionString(
      settings,
      'heightClearanceM',
      DEFAULT_PARKING_HEIGHT_CLEARANCE_M
    ),
    checkInTime: readSettingsString(settings, 'checkInTime') || '14:00',
    checkOutTime: readSettingsString(settings, 'checkOutTime') || '12:00',
    acceptedVehicleTypes: normalizeAcceptedVehicleTypes(acceptedVehicleTypes),
  };
}

export function parkingDetailsDraftIsDirty(
  draft: ParkingDetailsDraft,
  baseline: ParkingDetailsDraft
): boolean {
  return (
    draft.spaceLengthM.trim() !== baseline.spaceLengthM.trim() ||
    draft.spaceWidthM.trim() !== baseline.spaceWidthM.trim() ||
    draft.heightClearanceM.trim() !== baseline.heightClearanceM.trim() ||
    draft.checkInTime !== baseline.checkInTime ||
    draft.checkOutTime !== baseline.checkOutTime ||
    draft.acceptedVehicleTypes.length !== baseline.acceptedVehicleTypes.length ||
    draft.acceptedVehicleTypes.some((t) => !baseline.acceptedVehicleTypes.includes(t))
  );
}

export function parkingDetailsSettingsPatch(draft: ParkingDetailsDraft): Record<string, unknown> {
  return {
    spaceLengthM: parseParkingDimension(draft.spaceLengthM, DEFAULT_PARKING_SPACE_LENGTH_M),
    spaceWidthM: parseParkingDimension(draft.spaceWidthM, DEFAULT_PARKING_SPACE_WIDTH_M),
    heightClearanceM: parseParkingDimension(
      draft.heightClearanceM,
      DEFAULT_PARKING_HEIGHT_CLEARANCE_M
    ),
    checkInTime: draft.checkInTime.trim() || '14:00',
    checkOutTime: draft.checkOutTime.trim() || '12:00',
  };
}

export {
  DEFAULT_PARKING_HEIGHT_CLEARANCE_M,
  DEFAULT_PARKING_SPACE_LENGTH_M,
  DEFAULT_PARKING_SPACE_WIDTH_M,
  resolveParkingHeightClearanceM,
  resolveParkingSpaceLengthM,
  resolveParkingSpaceWidthM,
};

/** @deprecated Use ParkingProfileDraft */
export type ParkingBasicDraft = Pick<ParkingProfileDraft, 'tower' | 'level' | 'slotNumber'>;

export function parkingBasicDraftFromParking(parking: {
  tower: string | null;
  level: string | null;
  slotLabel: string;
}): ParkingBasicDraft {
  return {
    tower: parking.tower ?? '',
    level: normalizeParkingLevel(parking.level ?? ''),
    slotNumber: parseParkingSlotNumberFromLabel(parking.slotLabel) || parking.slotLabel,
  };
}

export function parkingBasicDraftIsDirty(
  draft: ParkingBasicDraft,
  baseline: ParkingBasicDraft
): boolean {
  return (
    draft.tower !== baseline.tower ||
    draft.level !== baseline.level ||
    draft.slotNumber !== baseline.slotNumber
  );
}

export { DESCRIPTION_MAX as PARKING_DESCRIPTION_MAX };
