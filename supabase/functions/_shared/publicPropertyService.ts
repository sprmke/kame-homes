/**
 * Public property catalog — load ACTIVE properties for guest marketing pages.
 * Excludes operator secrets (OAuth tokens, Telegram, contact email/phone).
 */

import { loadAuthUserProfile } from './authUserProfile.ts';
import { createServiceClient } from './orgAuth.ts';
import { resolveOrgSettings } from './orgSettings.ts';
import { normalizePropertyMediaItems } from './propertyMedia.ts';
import { loadPropertyPricing } from './propertyPricing.ts';
import { loadResolvedBrandColorByPropertyId } from './propertyBranding.ts';
import { resolveAmenityLabels } from './publicPropertyAmenities.ts';
import { resolvePublicHouseRules, type PublicHouseRuleDto } from './publicPropertyHouseRules.ts';
import {
  readCancellationPolicyFromSettings,
  resolveCancellationPolicyDisplay,
  type ResolvedCancellationPolicyDisplay,
} from './propertyCancellationPolicy.ts';
import { resolvePropertyIdBySlug } from './propertyScope.ts';
import {
  averageGuestReviewRating,
  listPublicGuestReviews,
  sortPublicGuestReviewsNewestFirst,
  type PublicGuestReviewDto,
} from './guestReviewService.ts';
import { listApprovedPublicExternalReviews } from './propertyExternalReviews.ts';
import { isOrgSuperhostEarned } from './orgSuperhost.ts';
import { loadGuestFacingContactInfo } from './guestContactInfo.ts';
import { resolveAppSettings } from './appSettings.ts';
import { isOrgVerifiedBadge, readOrgVerificationFromSettings } from './orgVerification.ts';
import { isListingRecommendedBadge, resolveListingAuthorization } from './listingAuthorization.ts';
import { getPublicPageConfigOrDefault, type PropertyLandingConfig } from './publicPageConfigs.ts';

export type PublicPropertyMediaDto = {
  id: string;
  url: string;
  type: 'image' | 'video';
  caption?: string;
  isPrimary?: boolean;
  order: number;
};

export type PublicPropertyPricingDto = {
  weekdayNightlyRate: number;
  weekendNightlyRate: number;
  securityDeposit: number | null;
  petFee: number | null;
  parkingRateGuest: number | null;
  currency: 'PHP';
};

export type PublicPropertyDetailDto = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: 'ACTIVE';
  description: string | null;
  locationLabel: string;
  address: string;
  city: string;
  province: string | null;
  country: string;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  placeId: string | null;
  residenceName: string | null;
  towerAndUnit: string | null;
  tower: string | null;
  unitNumber: string | null;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  maxGuests: number;
  maxAdults: number;
  maxChildren: number;
  checkInTime: string;
  checkOutTime: string;
  selfCheckIn: boolean;
  amenities: string[];
  media: PublicPropertyMediaDto[];
  images: string[];
  pricing: PublicPropertyPricingDto;
  houseRules: PublicHouseRuleDto[];
  cancellationPolicy: ResolvedCancellationPolicyDisplay;
  host: {
    unitName: string;
    organizationName: string;
    organizationSlug: string;
    organizationLogoUrl: string | null;
    ownerName: string;
    ownerAvatarUrl: string | null;
    brandColor: string;
  };
  rating: number | null;
  reviewCount: number;
  guestReviews: PublicGuestReviewDto[];
  isSuperhost: boolean;
  /** Host-wide Recommended badge (org Tier 2). */
  verifiedBadge: boolean;
  /** This listing's Recommended badge (listing Tier 2) — independent of the host badge. */
  recommendedBadge: boolean;
  updatedAt: string;
  /** Section visibility/order — defaults when no host config row exists. */
  sectionConfig: PropertyLandingConfig;
};

const DEFAULT_ENABLED_HOUSE_RULES = [
  'check_in_after',
  'check_out_before',
  'no_smoking',
  'no_parties',
  'quiet_hours',
  'pets_allowed',
  'suitable_for_children',
  'security_cameras',
];

function readString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(settings: Record<string, unknown>, key: string, fallback: number): number {
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function readBoolean(settings: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = settings[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readStringArray(settings: Record<string, unknown>, key: string): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readCustomHouseRules(
  settings: Record<string, unknown>
): Array<{ id: string; name: string }> {
  const value = settings.customHouseRules;
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { id: string; name: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id: string }).id === 'string' &&
        typeof (entry as { name: string }).name === 'string'
    )
    .map((entry) => ({ id: entry.id, name: entry.name.trim() }));
}

function readEnabledHouseRules(settings: Record<string, unknown>): string[] {
  const value = settings.enabledHouseRules;
  if (!Array.isArray(value)) return DEFAULT_ENABLED_HOUSE_RULES;
  const ids = value.filter((entry): entry is string => typeof entry === 'string');
  return ids.length > 0 ? ids : [];
}

function readCustomAmenities(
  settings: Record<string, unknown>
): Array<{ id: string; name: string }> {
  const value = settings.customAmenities;
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { id: string; name: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id: string }).id === 'string' &&
        typeof (entry as { name: string }).name === 'string'
    )
    .map((entry) => ({ id: entry.id, name: entry.name.trim() }));
}

function readNullableCoord(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** 24h "14:00" → guest-facing "2:00 PM" */
export function formatCheckTime12h(time24: string): string {
  const trimmed = time24.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return trimmed || '2:00 PM';

  let hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  return `${hours}:${minutes} ${period}`;
}

function buildLocationLabel(city: string, province: string, country: string): string {
  const parts = [city, province].filter(Boolean);
  if (parts.length === 0) return country || 'Philippines';
  return parts.join(', ');
}

function normalizePropertyTypeLabel(type: string): string {
  const normalized = type.trim().toLowerCase();
  const labels: Record<string, string> = {
    apartment: 'Apartment',
    condo: 'Condo',
    house: 'House',
    villa: 'Villa',
    townhouse: 'Townhouse',
    cabin: 'Cabin',
    resort: 'Resort',
    hotel: 'Hotel',
    other: 'Property',
  };
  return (
    labels[normalized] ??
    (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Property')
  );
}

function sortMedia(media: PublicPropertyMediaDto[]): PublicPropertyMediaDto[] {
  return [...media].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.order - b.order;
  });
}

type PropertyRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  address: string | null;
  tower_and_unit: string | null;
  residence_name: string | null;
  tower: string | null;
  unit_number: string | null;
  max_guests: number | null;
  settings: Record<string, unknown>;
  updated_at: string;
};

type OrganizationRow = {
  name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string;
};

function resolvePublicUnitName(row: PropertyRow): string {
  return row.tower_and_unit?.trim() || row.name.trim() || 'this property';
}

export async function loadPublicPropertyBySlug(
  slug: string
): Promise<PublicPropertyDetailDto | null> {
  const propertyId = await resolvePropertyIdBySlug(slug.trim());
  if (!propertyId) return null;
  return loadPublicPropertyById(propertyId);
}

export async function loadPublicPropertyById(
  propertyId: string
): Promise<PublicPropertyDetailDto | null> {
  const supabase = createServiceClient();

  const { data: property, error } = await supabase
    .from('properties')
    .select(
      'id, organization_id, name, slug, type, status, address, tower_and_unit, residence_name, tower, unit_number, max_guests, settings, updated_at'
    )
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.error('[publicPropertyService] load property:', error.message);
    throw new Error('Failed to load property');
  }

  const row = property as PropertyRow | null;
  if (!row || row.status !== 'ACTIVE') return null;

  const settings = (row.settings ?? {}) as Record<string, unknown>;
  const enabledAmenities = readStringArray(settings, 'enabledAmenities');
  const customAmenities = readCustomAmenities(settings);
  const amenityLabels = resolveAmenityLabels(enabledAmenities, customAmenities);
  const enabledHouseRules = readEnabledHouseRules(settings);

  const mediaRecords = normalizePropertyMediaItems(settings.media);
  const media: PublicPropertyMediaDto[] = sortMedia(
    mediaRecords.map((item) => ({
      id: item.id,
      url: item.url,
      type: item.type,
      caption: item.caption,
      isPrimary: item.isPrimary,
      order: item.order,
    }))
  );
  const images = media.filter((item) => item.type === 'image').map((item) => item.url);

  const city = readString(settings, 'city');
  const province = readString(settings, 'province') || null;
  const country = readString(settings, 'country') || 'Philippines';
  const zipCode = readString(settings, 'zipCode') || null;

  const maxAdults = readNumber(settings, 'maxAdults', row.max_guests ?? 4);
  const maxChildren = Math.max(readNumber(settings, 'maxChildren', 0), 0);
  const maxGuests =
    row.max_guests && row.max_guests > 0 ? row.max_guests : Math.max(maxAdults + maxChildren, 1);

  const [
    pricing,
    brandColor,
    orgResult,
    orgSettingsResolved,
    guestReviews,
    appSettings,
    appSettingsRowResult,
  ] = await Promise.all([
    loadPropertyPricing(propertyId),
    loadResolvedBrandColorByPropertyId(propertyId),
    supabase
      .from('organizations')
      .select('name, slug, logo_url, owner_id, settings')
      .eq('id', row.organization_id)
      .maybeSingle(),
    resolveOrgSettings(row.organization_id),
    listPublicGuestReviews(propertyId),
    resolveAppSettings(propertyId),
    supabase
      .from('app_settings')
      .select('external_reviews')
      .eq('property_id', propertyId)
      .maybeSingle(),
  ]);

  const externalReviews = listApprovedPublicExternalReviews(
    appSettingsRowResult.data?.external_reviews
  );
  const mergedReviews = sortPublicGuestReviewsNewestFirst([...guestReviews, ...externalReviews]);
  const reviewRating = averageGuestReviewRating(mergedReviews);

  const contact = await loadGuestFacingContactInfo(propertyId, appSettings);

  const org = orgResult.data as (OrganizationRow & { settings?: unknown }) | null;
  const orgSettings =
    org?.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  const isSuperhost = isOrgSuperhostEarned(orgSettings);
  const verifiedBadge = isOrgVerifiedBadge(readOrgVerificationFromSettings(orgSettings));
  const recommendedBadge = isListingRecommendedBadge(
    resolveListingAuthorization(settings, orgSettings, 'property')
  );
  const organizationName = org?.name?.trim() || contact.contactName || 'Host';
  const orgLogoUrl = orgSettingsResolved.emailLogoUrl.trim() || org?.logo_url?.trim() || null;
  const unitName = resolvePublicUnitName(row);
  const ownerProfile = org?.owner_id
    ? await loadAuthUserProfile(supabase, org.owner_id)
    : { name: organizationName, email: '', avatarUrl: orgLogoUrl };
  const hostDisplayName = contact.contactName || ownerProfile.name || organizationName;

  const checkInRaw = readString(settings, 'checkInTime') || '14:00';
  const checkOutRaw = readString(settings, 'checkOutTime') || '12:00';
  const checkInTime = formatCheckTime12h(checkInRaw);
  const checkOutTime = formatCheckTime12h(checkOutRaw);

  const customHouseRules = readCustomHouseRules(settings);
  const houseRules = resolvePublicHouseRules(
    enabledHouseRules,
    customHouseRules,
    checkInTime,
    checkOutTime
  );
  const cancellationPolicy = resolveCancellationPolicyDisplay(
    readCancellationPolicyFromSettings(settings)
  );
  const sectionConfig = (await getPublicPageConfigOrDefault(
    propertyId,
    'property_landing'
  )) as PropertyLandingConfig;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: normalizePropertyTypeLabel(row.type),
    status: 'ACTIVE',
    description: readString(settings, 'description') || null,
    locationLabel: buildLocationLabel(city, province ?? '', country),
    address: (row.address ?? readString(settings, 'address')) || '',
    city,
    province,
    country,
    zipCode,
    latitude: readNullableCoord(settings, 'latitude'),
    longitude: readNullableCoord(settings, 'longitude'),
    mapsUrl: readString(settings, 'mapsUrl') || null,
    placeId: readString(settings, 'placeId') || null,
    residenceName: row.residence_name?.trim() || null,
    towerAndUnit: row.tower_and_unit?.trim() || null,
    tower: row.tower?.trim() || null,
    unitNumber: row.unit_number?.trim() || null,
    bedrooms: readNumber(settings, 'bedrooms', 1),
    bathrooms: readNumber(settings, 'bathrooms', 1),
    floors: readNumber(settings, 'floors', 1),
    maxGuests,
    maxAdults,
    maxChildren,
    checkInTime,
    checkOutTime,
    selfCheckIn: readBoolean(settings, 'selfCheckIn', false),
    amenities: amenityLabels,
    media,
    images,
    pricing: {
      weekdayNightlyRate: pricing.weekdayNightlyRate,
      weekendNightlyRate: pricing.weekendNightlyRate,
      securityDeposit: pricing.securityDeposit,
      petFee: pricing.petFee,
      parkingRateGuest: pricing.parkingRateGuest,
      currency: 'PHP',
    },
    houseRules,
    cancellationPolicy,
    host: {
      unitName,
      organizationName,
      organizationSlug: org?.slug?.trim() || '',
      organizationLogoUrl: orgLogoUrl,
      ownerName: hostDisplayName,
      ownerAvatarUrl: ownerProfile.avatarUrl || orgLogoUrl,
      brandColor,
    },
    rating: reviewRating,
    reviewCount: mergedReviews.length,
    guestReviews: mergedReviews,
    isSuperhost,
    verifiedBadge,
    recommendedBadge,
    updatedAt: row.updated_at,
    sectionConfig,
  };
}
