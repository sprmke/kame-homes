/**
 * Public host (organization) profile for guest marketing pages.
 */

import { loadAuthUserProfile } from './authUserProfile.ts';
import { createServiceClient } from './orgAuth.ts';
import { isOrgSuperhostEarned } from './orgSuperhost.ts';
import { isOrgVerifiedBadge, readOrgVerificationFromSettings } from './orgVerification.ts';
import { isListingRecommendedBadge, resolveListingAuthorization } from './listingAuthorization.ts';
import { resolveOrgSettings } from './orgSettings.ts';
import { resolveOrgBrandColorFromSettings } from './orgSettingsValidation.ts';
import {
  batchLoadParkingPricing,
  batchLoadPropertyPricing,
  DEFAULT_LISTING_WEEKDAY_RATE,
  DEFAULT_PARKING_LISTING_WEEKDAY_RATE,
} from './publicListingFacets.ts';
import { normalizePropertyMediaItems } from './propertyMedia.ts';

/** Per-listing Recommended badge (listing Tier 2) — independent of the host badge. */
export type PublicListingBadgeDto = {
  recommendedBadge: boolean;
};

export type PublicHostPropertyCardDto = {
  slug: string;
  name: string;
  type: string;
  locationLabel: string;
  imageUrl: string | null;
  weekdayNightlyRate: number;
  recommendedBadge: boolean;
};

export type PublicHostParkingCardDto = {
  slug: string;
  name: string;
  parkingType: string;
  locationLabel: string;
  imageUrl: string | null;
  weekdayNightlyRate: number;
  recommendedBadge: boolean;
};

export type PublicHostSocialLinksDto = {
  facebookUrl: string | null;
  airbnbUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
};

export type PublicHostReviewSummaryDto = {
  count: number;
  avgOverall: number | null;
};

export type PublicHostReviewDto = {
  id: string;
  propertySlug: string;
  propertyName: string;
  guestName: string;
  starRating: number;
  reviewText: string | null;
  responseText: string | null;
  publishedAt: string | null;
};

export type PublicHostProfileDto = {
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  tagline: string | null;
  description: string | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  /** Host-wide Recommended badge (org Tier 2). Listings carry their own `recommendedBadge`. */
  verifiedBadge: boolean;
  /** Earned Superhost badge (org performance criteria). */
  isSuperhost: boolean;
  socialLinks: PublicHostSocialLinksDto;
  properties: PublicHostPropertyCardDto[];
  parkings: PublicHostParkingCardDto[];
  reviewSummary: PublicHostReviewSummaryDto;
  recentReviews: PublicHostReviewDto[];
};

type OrganizationRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  settings: Record<string, unknown> | null;
};

function readString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}

type PropertyListRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  settings: Record<string, unknown>;
};

type ParkingListRow = {
  id: string;
  slug: string;
  name: string;
  parking_type: string;
  residence_name: string | null;
  tower: string | null;
  level: string | null;
  slot_label: string;
  status: string;
  settings: Record<string, unknown> | null;
};

function readOrgSettingsString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}

function buildLocationLabel(city: string, province: string, country: string): string {
  return [city, province, country].filter(Boolean).join(', ');
}

function nullableSocialUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePropertyTypeLabel(type: string): string {
  const normalized = type.trim().toUpperCase();
  const labels: Record<string, string> = {
    APARTMENT: 'Apartment',
    CONDO: 'Condo',
    HOUSE: 'House',
    VILLA: 'Villa',
    RESORT: 'Resort',
    HOTEL: 'Hotel',
  };
  return labels[normalized] ?? 'Property';
}

function normalizeParkingTypeLabel(type: string): string {
  if (type === 'inside_tower') return 'Inside tower';
  if (type === 'outside_tower') return 'Outside tower';
  if (type === 'motorcycle') return 'Motorcycle';
  return type.trim() || 'Parking';
}

function firstParkingImageUrl(settings: Record<string, unknown>): string | null {
  const cover = settings.coverImage;
  if (typeof cover === 'string' && cover.trim()) return cover.trim();

  const images = settings.images;
  if (!Array.isArray(images)) return null;
  for (const item of images) {
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const url = (item as { url?: unknown }).url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
  }
  return null;
}

function buildParkingLocationLabel(
  settings: Record<string, unknown>,
  row: Pick<ParkingListRow, 'residence_name' | 'tower' | 'level' | 'slot_label'>
): string {
  const city = readString(settings, 'city');
  const province = readString(settings, 'province');
  const country = readString(settings, 'country') || 'Philippines';
  const geo = buildLocationLabel(city, province, country);
  if (geo) return geo;

  return [row.residence_name, row.tower, row.level, row.slot_label]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' · ');
}

export async function loadPublicHostByOrgSlug(
  orgSlugInput: string
): Promise<PublicHostProfileDto | null> {
  const orgSlug = orgSlugInput.trim().toLowerCase();
  if (!orgSlug) return null;

  const supabase = createServiceClient();

  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('id, slug, name, description, logo_url, owner_id, settings')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (orgError || !orgRow) return null;

  const org = orgRow as OrganizationRow;
  const [
    orgSettingsResolved,
    ownerProfile,
    ownerMemberResult,
    propertiesResult,
    parkingsResult,
    reviewsResult,
    summaryResult,
  ] = await Promise.all([
    resolveOrgSettings(org.id),
    loadAuthUserProfile(supabase, org.owner_id),
    supabase
      .from('organization_members')
      .select('display_name')
      .eq('organization_id', org.id)
      .eq('user_id', org.owner_id)
      .maybeSingle(),
    supabase
      .from('properties')
      .select('id, slug, name, type, status, settings')
      .eq('organization_id', org.id)
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase
      .from('parkings')
      .select(
        'id, slug, name, parking_type, residence_name, tower, level, slot_label, status, settings'
      )
      .eq('organization_id', org.id)
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase
      .from('guest_reviews')
      .select(
        'id, property_id, star_rating, review_text, guest_display_name, response_text, published_at'
      )
      .eq('organization_id', org.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(6),
    supabase.rpc('org_review_summary', { p_organization_id: org.id }),
  ]);

  const orgLogoUrl = orgSettingsResolved.emailLogoUrl.trim() || org.logo_url?.trim() || null;
  const orgSettings =
    org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
      ? org.settings
      : {};
  const tagline = readOrgSettingsString(orgSettings, 'tagline') || null;
  const description = org.description?.trim() || null;
  const ownerMemberRow = ownerMemberResult.data as { display_name?: string | null } | null;
  const ownerDisplayName =
    typeof ownerMemberRow?.display_name === 'string' && ownerMemberRow.display_name.trim()
      ? ownerMemberRow.display_name.trim()
      : ownerProfile.name;
  const ownerName = ownerDisplayName.trim() || org.name.trim() || 'Host';
  const ownerAvatarUrl = ownerProfile.avatarUrl || orgLogoUrl;

  const propertyRows = (propertiesResult.data ?? []) as PropertyListRow[];
  const parkingRows = (parkingsResult.data ?? []) as ParkingListRow[];

  const [propertyRates, parkingRates] = await Promise.all([
    batchLoadPropertyPricing(propertyRows.map((row) => row.id)),
    batchLoadParkingPricing(parkingRows.map((row) => row.id)),
  ]);

  const properties = propertyRows.map((row) => {
    const settings = row.settings ?? {};
    const city = readString(settings, 'city');
    const province = readString(settings, 'province');
    const country = readString(settings, 'country') || 'Philippines';
    const media = normalizePropertyMediaItems(settings);
    const images = media.filter((item) => item.type === 'image').map((item) => item.url);

    return {
      slug: row.slug,
      name: row.name,
      type: normalizePropertyTypeLabel(row.type),
      locationLabel: buildLocationLabel(city, province, country),
      imageUrl: images[0] ?? null,
      weekdayNightlyRate: propertyRates.get(row.id) ?? DEFAULT_LISTING_WEEKDAY_RATE,
      recommendedBadge: isListingRecommendedBadge(
        resolveListingAuthorization(settings, orgSettings, 'property')
      ),
    } satisfies PublicHostPropertyCardDto;
  });

  const propertyNameById = new Map(
    propertyRows.map((row) => [row.id, { slug: row.slug, name: row.name }])
  );
  const rpcSummary =
    (summaryResult.data as { count?: number; avgOverall?: number | null } | null) ?? null;
  const reviewSummary: PublicHostReviewSummaryDto = {
    count: typeof rpcSummary?.count === 'number' ? rpcSummary.count : 0,
    avgOverall: typeof rpcSummary?.avgOverall === 'number' ? rpcSummary.avgOverall : null,
  };
  const recentReviews: PublicHostReviewDto[] = (reviewsResult.data ?? []).map((row) => {
    const property = propertyNameById.get(row.property_id as string);
    return {
      id: row.id as string,
      propertySlug: property?.slug ?? '',
      propertyName: property?.name ?? 'Property',
      guestName: (row.guest_display_name as string | null)?.trim() || 'Guest',
      starRating: Number(row.star_rating) || 0,
      reviewText: (row.review_text as string | null) ?? null,
      responseText: (row.response_text as string | null) ?? null,
      publishedAt: (row.published_at as string | null) ?? null,
    };
  });

  const parkings = parkingRows.map((row) => {
    const settings =
      row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
        ? row.settings
        : {};

    return {
      slug: row.slug,
      name: row.name,
      parkingType: normalizeParkingTypeLabel(row.parking_type),
      locationLabel: buildParkingLocationLabel(settings, row),
      imageUrl: firstParkingImageUrl(settings),
      weekdayNightlyRate: parkingRates.get(row.id) ?? DEFAULT_PARKING_LISTING_WEEKDAY_RATE,
      recommendedBadge: isListingRecommendedBadge(
        resolveListingAuthorization(settings, orgSettings, 'parking')
      ),
    } satisfies PublicHostParkingCardDto;
  });

  return {
    slug: org.slug,
    name: org.name.trim() || 'Host',
    logoUrl: orgLogoUrl,
    brandColor: resolveOrgBrandColorFromSettings(orgSettings),
    tagline,
    description,
    ownerName,
    ownerAvatarUrl,
    verifiedBadge: isOrgVerifiedBadge(readOrgVerificationFromSettings(orgSettings)),
    isSuperhost: isOrgSuperhostEarned(orgSettings),
    socialLinks: {
      facebookUrl: nullableSocialUrl(orgSettingsResolved.facebookPageUrl),
      airbnbUrl: nullableSocialUrl(orgSettingsResolved.airbnbUrl),
      instagramUrl: nullableSocialUrl(orgSettingsResolved.instagramUrl),
      tiktokUrl: nullableSocialUrl(orgSettingsResolved.tiktokUrl),
    },
    properties,
    parkings,
    reviewSummary,
    recentReviews,
  };
}
