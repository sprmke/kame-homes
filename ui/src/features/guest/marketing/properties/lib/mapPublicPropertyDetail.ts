import type { Property } from '@/features/guest/marketing/properties/components/PropertyCard';
import type { PropertyDetail } from '@/features/guest/marketing/properties/data/mockPropertyDetail';
import type {
  PublicPropertyDetailDto,
  ResolvedPropertyDetail,
} from '@/features/guest/marketing/properties/types/publicProperty';
import { MOCK_HOST_AVATAR_URL } from '@/features/guest/marketing/shared/lib/mockListingImages';

import {
  DEFAULT_CANCELLATION_POLICY,
  resolveCancellationPolicyDisplay,
} from '@/features/dashboard/org/lib/propertyCancellationPolicy';
import {
  INITIAL_ENABLED_HOUSE_RULES,
  resolveHouseRulesForDisplay,
} from '@/features/dashboard/org/lib/propertyHouseRulesConstants';

/** Same default as guest forms / org settings preview */
export const DEFAULT_ORG_LOGO_URL = '/images/logo.png';

const MOCK_CANCELLATION_POLICY = resolveCancellationPolicyDisplay(DEFAULT_CANCELLATION_POLICY);

const MOCK_HOUSE_RULES = resolveHouseRulesForDisplay({
  enabledIds: INITIAL_ENABLED_HOUSE_RULES,
  customRules: [],
  checkInTime: '2:00 PM',
  checkOutTime: '11:00 AM',
});

function mockListingGuestCapacity(guests: number): { maxAdults: number; maxChildren: number } {
  const total = Math.max(1, guests);
  const maxAdults = Math.min(6, Math.max(1, total - 1));
  return { maxAdults, maxChildren: Math.max(0, total - maxAdults) };
}

export function mapApiPropertyToResolved(dto: PublicPropertyDetailDto): ResolvedPropertyDetail {
  return {
    source: 'api',
    brandColor: dto.host.brandColor,
    slug: dto.slug,
    id: dto.id,
    name: dto.name,
    type: dto.type.toUpperCase(),
    description: dto.description,
    location: dto.locationLabel,
    address: dto.address,
    city: dto.city,
    state: dto.province,
    country: dto.country,
    zipCode: dto.zipCode,
    latitude: dto.latitude,
    longitude: dto.longitude,
    placeId: dto.placeId,
    mapsUrl: dto.mapsUrl,
    residenceName: dto.residenceName,
    developmentSlug: dto.development?.slug ?? null,
    development: dto.development ?? null,
    tower: dto.tower,
    unitNumber: dto.unitNumber,
    towerAndUnit: dto.towerAndUnit,
    floors: dto.floors,
    houseRules: dto.houseRules,
    cancellationPolicy: dto.cancellationPolicy,
    checkInTime: dto.checkInTime,
    checkOutTime: dto.checkOutTime,
    selfCheckIn: dto.selfCheckIn,
    bedrooms: dto.bedrooms,
    bathrooms: dto.bathrooms,
    guests: dto.maxGuests,
    maxAdults: dto.maxAdults,
    maxChildren: dto.maxChildren,
    amenities: dto.amenities,
    images: dto.images.length > 0 ? dto.images : dto.media.map((item) => item.url),
    media: dto.media,
    rating: dto.rating ?? undefined,
    reviews: dto.reviewCount > 0 ? dto.reviewCount : undefined,
    guestReviews: dto.guestReviews,
    isSuperhost: dto.isSuperhost,
    verifiedBadge: dto.verifiedBadge,
    recommendedBadge: dto.recommendedBadge,
    host: {
      unitName: dto.host.unitName,
      organizationName: dto.host.organizationName,
      organizationSlug: dto.host.organizationSlug,
      ownerName: dto.host.ownerName,
      ownerAvatarUrl: dto.host.ownerAvatarUrl,
      organizationLogoUrl: dto.host.organizationLogoUrl,
    },
    hostName: dto.host.organizationName,
    hostImage: dto.host.ownerAvatarUrl || dto.host.organizationLogoUrl || DEFAULT_ORG_LOGO_URL,
    pricing: {
      baseRate: dto.pricing.weekdayNightlyRate,
      currency: dto.pricing.currency,
      cleaningFee: null,
      securityDeposit: dto.pricing.securityDeposit,
      parkingRate: dto.pricing.parkingRateGuest,
      petFee: dto.pricing.petFee,
    },
    sectionConfig: dto.sectionConfig,
  };
}

export function mapMockPropertyToResolved(detail: PropertyDetail): ResolvedPropertyDetail {
  const houseRules = resolveHouseRulesForDisplay({
    enabledIds: INITIAL_ENABLED_HOUSE_RULES,
    customRules: [],
    checkInTime: detail.checkInTime,
    checkOutTime: detail.checkOutTime,
  });

  return {
    source: 'mock',
    slug: detail.slug,
    id: detail.id,
    name: detail.name,
    type: detail.type,
    description: detail.description,
    location: detail.location,
    address: detail.address,
    city: detail.location.split(',')[0]?.trim() ?? '',
    state: detail.state,
    country: detail.country,
    zipCode: detail.zipCode,
    latitude: detail.latitude,
    longitude: detail.longitude,
    placeId: null,
    mapsUrl: null,
    residenceName: detail.residenceName ?? null,
    developmentSlug: detail.developmentSlug ?? null,
    tower: detail.tower ?? null,
    unitNumber: detail.unitNumber ?? null,
    towerAndUnit: detail.towerAndUnit ?? null,
    floors: detail.floors ?? 1,
    houseRules,
    cancellationPolicy: MOCK_CANCELLATION_POLICY,
    checkInTime: detail.checkInTime,
    checkOutTime: detail.checkOutTime,
    selfCheckIn: false,
    bedrooms: detail.bedrooms,
    bathrooms: detail.bathrooms,
    guests: detail.guests,
    ...mockListingGuestCapacity(detail.guests),
    amenities: detail.amenities,
    images: detail.images,
    media: detail.images.map((url, index) => ({
      id: `mock-image-${index}`,
      url,
      type: 'image' as const,
      order: index,
      isPrimary: index === 0,
    })),
    rating: detail.rating,
    reviews: detail.reviews,
    isSuperhost: detail.isSuperhost,
    host: {
      unitName: detail.name,
      organizationName: 'Demo Host Co.',
      organizationSlug: 'demo-host',
      ownerName: 'Demo Host Co.',
      ownerAvatarUrl: MOCK_HOST_AVATAR_URL,
      organizationLogoUrl: MOCK_HOST_AVATAR_URL,
    },
    hostName: 'Demo Host Co.',
    hostImage: MOCK_HOST_AVATAR_URL,
    pricing: {
      baseRate: detail.pricing.baseRate,
      currency: detail.pricing.currency,
      cleaningFee: detail.pricing.cleaningFee,
      securityDeposit: detail.pricing.securityDeposit,
      parkingRate: detail.pricing.parkingRate,
      petFee: detail.pricing.petFee,
    },
  };
}

export function mapBasicMockToResolved(basic: Property): ResolvedPropertyDetail {
  return {
    source: 'mock',
    slug: basic.slug,
    id: basic.id,
    name: basic.name,
    type: basic.type,
    description: null,
    location: basic.location,
    address: '',
    city: basic.location.split(',')[0]?.trim() ?? '',
    state: basic.location.split(', ')[1] ?? null,
    country: 'Philippines',
    zipCode: null,
    latitude: null,
    longitude: null,
    placeId: null,
    mapsUrl: null,
    residenceName: basic.developmentName ?? null,
    developmentSlug: basic.developmentSlug ?? null,
    development:
      basic.developmentSlug && basic.developmentName
        ? {
            slug: basic.developmentSlug,
            name: basic.developmentName,
            locationLabel: basic.location,
          }
        : null,
    tower: basic.tower ?? null,
    unitNumber: basic.unitNumber ?? null,
    towerAndUnit: basic.towerAndUnit ?? null,
    floors: 1,
    houseRules: MOCK_HOUSE_RULES,
    cancellationPolicy: MOCK_CANCELLATION_POLICY,
    checkInTime: '2:00 PM',
    checkOutTime: '11:00 AM',
    selfCheckIn: false,
    bedrooms: basic.bedrooms,
    bathrooms: basic.bathrooms,
    guests: basic.guests,
    ...mockListingGuestCapacity(basic.guests),
    amenities: basic.amenities,
    images: basic.images,
    media: basic.images.map((url, index) => ({
      id: `mock-image-${index}`,
      url,
      type: 'image' as const,
      order: index,
      isPrimary: index === 0,
    })),
    rating: basic.rating,
    reviews: basic.reviews,
    isSuperhost: basic.isSuperhost,
    host: {
      unitName: basic.name,
      organizationName: 'Demo Host Co.',
      organizationSlug: 'demo-host',
      ownerName: 'Demo Host Co.',
      ownerAvatarUrl: MOCK_HOST_AVATAR_URL,
      organizationLogoUrl: MOCK_HOST_AVATAR_URL,
    },
    hostName: 'Demo Host Co.',
    hostImage: MOCK_HOST_AVATAR_URL,
    pricing: {
      baseRate: basic.price,
      currency: 'PHP',
      cleaningFee: null,
      securityDeposit: null,
      parkingRate: null,
      petFee: null,
    },
  };
}
