import {
  parseHostAnnouncementDrafts,
  validateHostAnnouncements,
  type HostAnnouncementDraft,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import {
  mergeDocumentRequirements,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  mergeUnitTypes,
  validateUnitTypes,
  type DevelopmentUnitType,
} from '@/features/dashboard/bookings/lib/unitTypes';
import { documentRequirementLabelFieldErrors } from '@/features/dashboard/org/lib/propertyDocumentRequirements';
import { AZURE_PMO_EMAIL } from '@/features/dashboard/org/lib/propertyEmailAutomationDefaults';
import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';
import {
  mergeDevelopmentPoolSettings,
  parseGuestGuides,
  validateGuestGuides,
  type DevelopmentGuestGuide,
} from '@/features/dashboard/super-admin/lib/developmentGuestInfo';
import {
  developmentMediaToLegacyFields,
  readDevelopmentMedia,
} from '@/features/dashboard/super-admin/lib/developmentMedia';
import {
  normalizeDevelopmentParkingLevels,
  readDevelopmentParkingLevels,
} from '@/features/dashboard/super-admin/lib/developmentParking';
import type { Development } from '@/features/dashboard/super-admin/types/development';

function readStringArray(settings: Record<string, unknown>, key: string): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim());
}

function readNumber(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value : '';
}

export type DevelopmentProfileDraft = {
  name: string;
  slug: string;
  developerName: string;
  type: string;
  status: string;
  location: string;
  city: string;
  description: string;
  media: PropertyMediaItem[];
  coverImageUrl: string;
  images: string[];
  amenities: string[];
  propertyTowers: string[];
  parkingTowers: string[];
  parkingLevels: string[];
  address: string;
  province: string;
  country: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string;
  placeId: string;
  pmoEmail: string;
  documentRequirements: DocumentRequirement[];
  unitTypes: DevelopmentUnitType[];
  poolFee: number | null;
  poolSchedule: string;
  guestRequirements: string;
  guestGuides: DevelopmentGuestGuide[];
  importantInfo: string;
  announcements: HostAnnouncementDraft[];
};

export function developmentProfileDraftFromDevelopment(
  development: Development
): DevelopmentProfileDraft {
  const settings = development.settings ?? {};
  const media = readDevelopmentMedia(development);
  const legacy = developmentMediaToLegacyFields(media);
  const storedParkingLevels = readStringArray(settings, 'parkingLevels').filter(Boolean);
  const workflowDefaults =
    settings.workflowDefaults && typeof settings.workflowDefaults === 'object'
      ? (settings.workflowDefaults as Record<string, unknown>)
      : null;

  return {
    name: development.name,
    slug: development.slug,
    developerName: development.developerName ?? '',
    type: development.type,
    status: development.status,
    location: development.location ?? '',
    city: development.city ?? '',
    description: development.description ?? '',
    media: legacy.media,
    coverImageUrl: legacy.coverImageUrl,
    images: legacy.images,
    amenities: readStringArray(settings, 'amenities'),
    propertyTowers: readStringArray(settings, 'propertyTowers'),
    parkingTowers: readStringArray(settings, 'parkingTowers'),
    parkingLevels: readDevelopmentParkingLevels(development.name, storedParkingLevels),
    address: readString(settings, 'address'),
    province: readString(settings, 'province'),
    country: readString(settings, 'country'),
    zipCode: readString(settings, 'zipCode'),
    latitude: readNumber(settings, 'latitude'),
    longitude: readNumber(settings, 'longitude'),
    mapsUrl: readString(settings, 'mapsUrl'),
    placeId: readString(settings, 'placeId'),
    pmoEmail: readString(settings, 'pmoEmail'),
    documentRequirements: mergeDocumentRequirements(workflowDefaults?.documentRequirements),
    unitTypes: mergeUnitTypes(settings.unitTypes, development.name),
    ...mergeDevelopmentPoolSettings(
      development.name,
      readNumber(settings, 'poolFee'),
      readString(settings, 'poolSchedule')
    ),
    guestRequirements: readString(settings, 'guestRequirements'),
    guestGuides: parseGuestGuides(settings.guestGuides),
    importantInfo: readString(settings, 'importantInfo'),
    announcements: parseHostAnnouncementDrafts(settings.announcements),
  };
}

export function developmentProfileDraftIsDirty(
  baseline: DevelopmentProfileDraft,
  draft: DevelopmentProfileDraft
): boolean {
  return JSON.stringify(baseline) !== JSON.stringify(draft);
}

export function buildDevelopmentUpdatePayload(draft: DevelopmentProfileDraft) {
  const legacy = developmentMediaToLegacyFields(draft.media);
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    developerName: draft.developerName.trim() || null,
    type: draft.type,
    status: draft.status,
    location: draft.location.trim() || null,
    city: draft.city.trim() || null,
    description: draft.description.trim() || null,
    coverImageUrl: legacy.coverImageUrl.trim() || null,
    images: legacy.images,
    media: legacy.media,
    amenities: draft.amenities,
    propertyTowers: draft.propertyTowers,
    parkingTowers: draft.parkingTowers,
    parkingLevels: normalizeDevelopmentParkingLevels(draft.parkingLevels),
    address: draft.address.trim() || null,
    province: draft.province.trim() || null,
    country: draft.country.trim() || null,
    zipCode: draft.zipCode.trim() || null,
    latitude: draft.latitude,
    longitude: draft.longitude,
    mapsUrl: draft.mapsUrl.trim() || null,
    placeId: draft.placeId.trim() || null,
    pmoEmail: draft.pmoEmail.trim() || null,
    documentRequirements: draft.documentRequirements,
    unitTypes: draft.unitTypes,
    poolFee: draft.poolFee,
    poolSchedule: draft.poolSchedule.trim() || null,
    guestRequirements: draft.guestRequirements.trim() || null,
    guestGuides: draft.guestGuides,
    importantInfo: draft.importantInfo.trim() || null,
    announcements: draft.announcements,
  };
}

export function validateDevelopmentProfileDraft(draft: DevelopmentProfileDraft): string | null {
  const email = draft.pmoEmail.trim();
  if (!email) return 'PMO email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid PMO email';
  const labelErrors = documentRequirementLabelFieldErrors(draft.documentRequirements);
  const firstLabelError = Object.values(labelErrors)[0];
  if (firstLabelError) return firstLabelError;
  const unitTypeError = validateUnitTypes(draft.unitTypes);
  if (unitTypeError) return unitTypeError;
  const guideError = validateGuestGuides(draft.guestGuides);
  if (guideError) return guideError;
  const announcementError = validateHostAnnouncements(draft.announcements);
  if (announcementError) return announcementError;
  if (draft.poolFee != null && draft.poolFee < 0) return 'Pool fee cannot be negative';
  return null;
}

export function developmentPmoEmailPlaceholder(developmentName: string): string {
  if (developmentName.trim().toLowerCase().includes('azure north')) {
    return AZURE_PMO_EMAIL;
  }
  return 'documents@yourcompany.com';
}
