import {
  defaultUnitTypesForResidence,
  resolveUnitTypeIdFromCapacity,
} from '@/features/dashboard/bookings/lib/unitTypes';
import { slugifyOrgName } from '@/features/dashboard/org/lib/orgSettingsForm';
import {
  readCancellationPolicyFromSettings,
  type CancellationPolicySettings,
} from '@/features/dashboard/org/lib/propertyCancellationPolicy';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import {
  INITIAL_ENABLED_HOUSE_RULES,
  type CustomHouseRule,
} from '@/features/dashboard/org/lib/propertyHouseRulesConstants';
import {
  readNullableLatitude,
  readNullableLongitude,
  withAzureNorthLocationDefaultsIfEmpty,
} from '@/features/dashboard/org/lib/propertyLocation';
import { normalizePropertyMediaDraft } from '@/features/dashboard/org/lib/propertyMedia';
import { isCondoPropertyType } from '@/features/dashboard/org/lib/propertyResidences';
import {
  PROPERTY_CONTACT_ROLE_VALUES,
  type CustomAmenity,
  type PropertyContactRole,
  type PropertyMediaItem,
} from '@/features/dashboard/org/lib/propertySettingsConstants';
import {
  formatTowerAndUnit,
  isPropertyTowerForResidence,
  type PropertyTower,
} from '@/features/dashboard/org/lib/propertyTowerUnit';
import type { Property } from '@/features/dashboard/org/types';

import { normalizeCleaningBufferMinutes } from '@/lib/cleaningBuffer';

export type PropertyProfileDraft = {
  name: string;
  type: string;
  status: 'ACTIVE' | 'INACTIVE';
  description: string;
  contactName: string;
  contactRole: PropertyContactRole | '';
  contactPhone: string;
  contactEmail: string;
  tower: PropertyTower | '';
  unitNumber: string;
  residenceName: string;
  address: string;
  city: string;
  province: string;
  country: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string;
  placeId: string;
  bedrooms: number;
  bathrooms: number;
  maxAdults: number;
  maxChildren: number;
  maxGuests: number;
  unitTypeId: string;
  floors: number;
  checkInTime: string;
  checkOutTime: string;
  /** Required minutes between a checkout and the next check-in on a same-day turnover (min 1 hour). */
  cleaningBufferMinutes: number;
  selfCheckIn: boolean;
  media: PropertyMediaItem[];
  enabledAmenities: string[];
  customAmenities: CustomAmenity[];
  enabledHouseRules: string[];
  customHouseRules: CustomHouseRule[];
  cancellationPolicy: CancellationPolicySettings;
  allowPets: boolean;
  allowParking: boolean;
  allowSurpriseDecor: boolean;
  /** Org parking UUID preferred for owner-default ranking when available. */
  preferredOwnerParkingId: string;
  /** Same-org own-slot pins skip PayMongo and auto-fulfill. */
  complimentaryOwnerParking: boolean;
};

function readSettingsString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value : '';
}

function readSettingsNumber(
  settings: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function readSettingsBoolean(
  settings: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  const value = settings[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readSettingsStringArray(
  settings: Record<string, unknown>,
  key: string,
  fallback: string[]
): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return fallback;
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readCustomAmenities(settings: Record<string, unknown>): CustomAmenity[] {
  const value = settings.customAmenities;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is CustomAmenity =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as CustomAmenity).id === 'string' &&
      typeof (entry as CustomAmenity).name === 'string' &&
      typeof (entry as CustomAmenity).categoryId === 'string'
  );
}

function readCustomHouseRules(settings: Record<string, unknown>): CustomHouseRule[] {
  const value = settings.customHouseRules;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is CustomHouseRule =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as CustomHouseRule).id === 'string' &&
      typeof (entry as CustomHouseRule).name === 'string' &&
      typeof (entry as CustomHouseRule).categoryId === 'string'
  );
}

function readMedia(settings: Record<string, unknown>): PropertyMediaItem[] {
  const value = settings.media;
  if (!Array.isArray(value) || value.length === 0) return [];

  const parsed: PropertyMediaItem[] = value
    .filter(
      (entry): entry is PropertyMediaItem =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PropertyMediaItem).id === 'string' &&
        typeof (entry as PropertyMediaItem).url === 'string'
    )
    .map((entry) => ({
      id: entry.id,
      url: entry.url,
      storagePath: typeof entry.storagePath === 'string' ? entry.storagePath : undefined,
      type: (entry.type === 'video' ? 'video' : 'image') as 'image' | 'video',
      caption: typeof entry.caption === 'string' ? entry.caption : undefined,
      isPrimary: entry.isPrimary === true,
      order: typeof entry.order === 'number' ? entry.order : 0,
    }));

  return normalizePropertyMediaDraft(parsed) as PropertyMediaItem[];
}

export function propertyMediaFromProperty(property: Property): PropertyMediaItem[] {
  return readMedia((property.settings ?? {}) as Record<string, unknown>);
}

function normalizePropertyType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (!normalized || normalized === 'condo') return 'condo';
  return normalized;
}

function normalizeGuestCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function propertyGuestCapacityTotal(maxAdults: number, maxChildren: number): number {
  return normalizeGuestCount(maxAdults) + normalizeGuestCount(maxChildren);
}

export function propertyProfileDraftFromProperty(property: Property): PropertyProfileDraft {
  const settings = property.settings ?? {};
  const residenceName = property.residenceName?.trim() || DEFAULT_RESIDENCE_NAME;
  const tower =
    property.tower && isPropertyTowerForResidence(property.tower, residenceName)
      ? (property.tower as PropertyTower)
      : '';

  const contactRoleRaw = readSettingsString(settings, 'contactRole');
  const contactRole = PROPERTY_CONTACT_ROLE_VALUES.includes(contactRoleRaw as PropertyContactRole)
    ? (contactRoleRaw as PropertyContactRole)
    : '';

  const maxAdults = (() => {
    const fromSettings = readSettingsNumber(settings, 'maxAdults', -1);
    if (fromSettings >= 0) return fromSettings;
    const total = property.maxGuests ?? readSettingsNumber(settings, 'maxGuests', 4);
    return Math.max(total, 1);
  })();
  const maxChildren = Math.max(readSettingsNumber(settings, 'maxChildren', 0), 0);
  const unitTypes = defaultUnitTypesForResidence(residenceName);
  const unitTypeIdFromSettings = readSettingsString(settings, 'unitTypeId');
  const unitTypeId =
    unitTypeIdFromSettings || resolveUnitTypeIdFromCapacity(unitTypes, maxAdults, maxChildren);

  return withAzureNorthLocationDefaultsIfEmpty(residenceName, {
    name: property.name,
    type: normalizePropertyType(property.type),
    status: property.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    description: readSettingsString(settings, 'description'),
    contactName: readSettingsString(settings, 'contactName'),
    contactRole,
    contactPhone: readSettingsString(settings, 'contactPhone'),
    contactEmail: readSettingsString(settings, 'contactEmail'),
    tower,
    unitNumber: property.unitNumber ?? '',
    residenceName: property.residenceName?.trim() ?? '',
    address: property.address ?? '',
    city: readSettingsString(settings, 'city'),
    province: readSettingsString(settings, 'province'),
    country: readSettingsString(settings, 'country') || 'Philippines',
    zipCode: readSettingsString(settings, 'zipCode'),
    latitude: readNullableLatitude(settings),
    longitude: readNullableLongitude(settings),
    mapsUrl: readSettingsString(settings, 'mapsUrl'),
    placeId: readSettingsString(settings, 'placeId'),
    bedrooms: readSettingsNumber(settings, 'bedrooms', 1),
    bathrooms: readSettingsNumber(settings, 'bathrooms', 1),
    maxAdults,
    maxChildren,
    maxGuests:
      propertyGuestCapacityTotal(maxAdults, maxChildren) ||
      property.maxGuests ||
      readSettingsNumber(settings, 'maxGuests', 4),
    unitTypeId,
    floors: readSettingsNumber(settings, 'floors', 1),
    checkInTime: readSettingsString(settings, 'checkInTime') || '14:00',
    checkOutTime: readSettingsString(settings, 'checkOutTime') || '12:00',
    cleaningBufferMinutes: normalizeCleaningBufferMinutes(
      typeof settings.cleaningBufferMinutes === 'number' ? settings.cleaningBufferMinutes : null
    ),
    selfCheckIn: readSettingsBoolean(settings, 'selfCheckIn', false),
    media: readMedia(settings),
    enabledAmenities: readSettingsStringArray(settings, 'enabledAmenities', []),
    customAmenities: readCustomAmenities(settings),
    enabledHouseRules: readSettingsStringArray(
      settings,
      'enabledHouseRules',
      INITIAL_ENABLED_HOUSE_RULES
    ),
    customHouseRules: readCustomHouseRules(settings),
    cancellationPolicy: readCancellationPolicyFromSettings(settings),
    allowPets: readSettingsBoolean(settings, 'allowPets', true),
    allowParking: readSettingsBoolean(settings, 'allowParking', true),
    allowSurpriseDecor: readSettingsBoolean(settings, 'allowSurpriseDecor', true),
    preferredOwnerParkingId: readSettingsString(settings, 'preferredOwnerParkingId'),
    complimentaryOwnerParking: readSettingsBoolean(settings, 'complimentaryOwnerParking', false),
  });
}

export function propertyProfileDbFieldsDirty(
  draft: PropertyProfileDraft,
  baseline: PropertyProfileDraft
): boolean {
  return (
    draft.name.trim() !== baseline.name.trim() ||
    draft.type !== baseline.type ||
    draft.status !== baseline.status ||
    draft.tower !== baseline.tower ||
    draft.unitNumber !== baseline.unitNumber ||
    draft.residenceName.trim() !== baseline.residenceName.trim() ||
    draft.address.trim() !== baseline.address.trim() ||
    draft.maxGuests !== baseline.maxGuests
  );
}

export function propertyProfileExtendedDirty(
  draft: PropertyProfileDraft,
  baseline: PropertyProfileDraft
): boolean {
  return (
    draft.description.trim() !== baseline.description.trim() ||
    draft.contactName.trim() !== baseline.contactName.trim() ||
    draft.contactRole !== baseline.contactRole ||
    draft.contactPhone.trim() !== baseline.contactPhone.trim() ||
    draft.contactEmail.trim() !== baseline.contactEmail.trim() ||
    draft.city.trim() !== baseline.city.trim() ||
    draft.province.trim() !== baseline.province.trim() ||
    draft.country.trim() !== baseline.country.trim() ||
    draft.zipCode.trim() !== baseline.zipCode.trim() ||
    draft.latitude !== baseline.latitude ||
    draft.longitude !== baseline.longitude ||
    draft.mapsUrl.trim() !== baseline.mapsUrl.trim() ||
    draft.placeId.trim() !== baseline.placeId.trim() ||
    draft.bedrooms !== baseline.bedrooms ||
    draft.bathrooms !== baseline.bathrooms ||
    draft.maxAdults !== baseline.maxAdults ||
    draft.maxChildren !== baseline.maxChildren ||
    draft.unitTypeId !== baseline.unitTypeId ||
    draft.floors !== baseline.floors ||
    draft.checkInTime !== baseline.checkInTime ||
    draft.checkOutTime !== baseline.checkOutTime ||
    draft.cleaningBufferMinutes !== baseline.cleaningBufferMinutes ||
    draft.selfCheckIn !== baseline.selfCheckIn ||
    JSON.stringify(draft.media) !== JSON.stringify(baseline.media) ||
    JSON.stringify(draft.enabledAmenities) !== JSON.stringify(baseline.enabledAmenities) ||
    JSON.stringify(draft.customAmenities) !== JSON.stringify(baseline.customAmenities) ||
    JSON.stringify(draft.enabledHouseRules) !== JSON.stringify(baseline.enabledHouseRules) ||
    JSON.stringify(draft.customHouseRules) !== JSON.stringify(baseline.customHouseRules) ||
    JSON.stringify(draft.cancellationPolicy) !== JSON.stringify(baseline.cancellationPolicy) ||
    draft.allowPets !== baseline.allowPets ||
    draft.allowParking !== baseline.allowParking ||
    draft.allowSurpriseDecor !== baseline.allowSurpriseDecor ||
    draft.preferredOwnerParkingId !== baseline.preferredOwnerParkingId ||
    draft.complimentaryOwnerParking !== baseline.complimentaryOwnerParking
  );
}

export function propertyProfileDraftIsDirty(
  draft: PropertyProfileDraft,
  baseline: PropertyProfileDraft
): boolean {
  return (
    propertyProfileDbFieldsDirty(draft, baseline) || propertyProfileExtendedDirty(draft, baseline)
  );
}

export type PropertyProfileUpdatePayload = {
  propertyId: string;
  name?: string;
  tower?: string;
  unitNumber?: string;
  residenceName?: string;
  address?: string;
  maxGuests?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  settings?: Record<string, unknown>;
  /** Page Editor autosave — server requires `publicPagesAutosave` plan feature. */
  publicPagesAutosaveGate?: boolean;
};

export function propertyProfileSettingsPatch(draft: PropertyProfileDraft): Record<string, unknown> {
  return {
    description: draft.description.trim(),
    contactName: draft.contactName.trim(),
    contactRole: draft.contactRole,
    contactPhone: draft.contactPhone.trim(),
    contactEmail: draft.contactEmail.trim(),
    city: draft.city.trim(),
    province: draft.province.trim(),
    country: draft.country.trim(),
    zipCode: draft.zipCode.trim(),
    latitude: draft.latitude,
    longitude: draft.longitude,
    mapsUrl: draft.mapsUrl.trim(),
    placeId: draft.placeId.trim(),
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    maxAdults: draft.maxAdults,
    maxChildren: draft.maxChildren,
    maxGuests: draft.maxGuests,
    unitTypeId: draft.unitTypeId.trim(),
    floors: draft.floors,
    checkInTime: draft.checkInTime,
    checkOutTime: draft.checkOutTime,
    cleaningBufferMinutes: draft.cleaningBufferMinutes,
    selfCheckIn: draft.selfCheckIn,
    media: draft.media,
    enabledAmenities: draft.enabledAmenities,
    customAmenities: draft.customAmenities,
    enabledHouseRules: draft.enabledHouseRules,
    customHouseRules: draft.customHouseRules,
    cancellationPolicy: draft.cancellationPolicy,
    allowPets: draft.allowPets,
    allowParking: draft.allowParking,
    allowSurpriseDecor: draft.allowSurpriseDecor,
    preferredOwnerParkingId: draft.preferredOwnerParkingId.trim(),
    complimentaryOwnerParking: draft.complimentaryOwnerParking,
  };
}

export function propertyProfileDraftToUpdatePayload(
  draft: PropertyProfileDraft,
  propertyId: string
): PropertyProfileUpdatePayload {
  const payload: PropertyProfileUpdatePayload = {
    propertyId,
    status: draft.status,
  };

  const name = draft.name.trim();
  if (name.length >= 2) payload.name = name;

  if (isCondoPropertyType(draft.type) && draft.tower && draft.unitNumber) {
    payload.tower = draft.tower;
    payload.unitNumber = draft.unitNumber;
  }

  if (isCondoPropertyType(draft.type)) {
    const residence = draft.residenceName.trim() || DEFAULT_RESIDENCE_NAME;
    payload.residenceName = residence;
  } else {
    const residenceName = draft.residenceName.trim();
    if (residenceName) payload.residenceName = residenceName;
  }

  const address = draft.address.trim();
  if (address) payload.address = address;

  if (draft.maxGuests > 0) {
    payload.maxGuests = propertyGuestCapacityTotal(draft.maxAdults, draft.maxChildren);
  }

  return payload;
}

/** Tower + unit label synced into building-forms GAF fields from the property profile. */
export function gafTowerUnitFromProfile(profile: PropertyProfileDraft): string {
  if (profile.tower && profile.unitNumber.trim()) {
    return formatTowerAndUnit(profile.tower, profile.unitNumber);
  }
  return '';
}

/** Apply profile-derived GAF tower/unit to operational form values (draft + baseline on load). */
export function applyDerivedGafTowerToOperationalForm<T extends { gafTowerAndUnitNumber: string }>(
  values: T,
  profile: PropertyProfileDraft
): T {
  const derived = gafTowerUnitFromProfile(profile);
  if (values.gafTowerAndUnitNumber === derived) return values;
  return { ...values, gafTowerAndUnitNumber: derived };
}

/** Live slug preview while editing; falls back to saved slug when name is unchanged. */
export function propertySlugPreview(
  draftName: string,
  savedSlug: string,
  baselineName: string
): string {
  if (draftName.trim() === baselineName.trim()) {
    return savedSlug;
  }
  if (draftName.trim().length < 2) {
    return savedSlug;
  }
  return slugifyOrgName(draftName);
}
