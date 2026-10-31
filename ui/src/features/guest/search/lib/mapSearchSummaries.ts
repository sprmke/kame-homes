import type {
  Development,
  DevelopmentType,
  ParkingSlot,
  ParkingType,
} from '@/features/guest/marketing/developments/types';
import type { Property } from '@/features/guest/marketing/properties/components/PropertyCard';
import {
  resolveListingCoverImage,
  resolveListingImages,
} from '@/features/guest/marketing/shared/lib/mockListingImages';
import { formatAmenityLabels } from '@/features/guest/search/lib/amenityLabels';
import type {
  DevelopmentSearchSummary,
  ParkingSearchSummary,
  PropertySearchSummary,
} from '@/features/guest/search/types/search';

const DEVELOPMENT_TYPES = new Set<DevelopmentType>([
  'CONDOMINIUM',
  'SUBDIVISION',
  'MIXED_USE',
  'TOWNHOUSE',
  'COMMERCIAL',
]);

const PARKING_TYPES = new Set<ParkingType>(['inside_tower', 'outside_tower', 'motorcycle']);

export function mapPropertySummaryToCard(summary: PropertySearchSummary): Property {
  const images = resolveListingImages(
    summary.images.length > 0 ? summary.images : summary.coverImage ? [summary.coverImage] : [],
    'property',
    summary.slug
  );

  return {
    id: summary.id,
    slug: summary.slug,
    name: summary.name,
    location: summary.locationLabel || summary.city || 'Philippines',
    price: summary.price ?? 0,
    rating: summary.rating ?? 0,
    reviews: summary.reviewCount,
    images,
    type: summary.type,
    guests: summary.maxGuests ?? 2,
    bedrooms: summary.bedrooms ?? 1,
    bathrooms: summary.bathrooms ?? 1,
    amenities: formatAmenityLabels(summary.amenities),
    developmentName: summary.residenceName ?? undefined,
    latitude: summary.latitude,
    longitude: summary.longitude,
  };
}

export function mapDevelopmentSummaryToCard(summary: DevelopmentSearchSummary): Development {
  const type = DEVELOPMENT_TYPES.has(summary.type as DevelopmentType)
    ? (summary.type as DevelopmentType)
    : 'CONDOMINIUM';

  const images = resolveListingImages(
    summary.images.length > 0 ? summary.images : summary.coverImage ? [summary.coverImage] : [],
    'development',
    summary.slug
  );

  return {
    id: summary.id,
    slug: summary.slug,
    name: summary.name,
    developerName: summary.developerName ?? '',
    type,
    location: summary.locationLabel || summary.location || summary.city || '',
    city: summary.city ?? '',
    description: '',
    coverImage: resolveListingCoverImage(
      summary.images,
      summary.coverImage,
      'development',
      summary.slug
    ),
    images,
    amenities: [],
    propertyCount: summary.propertyCount,
    priceRange: {
      min: summary.priceRangeMin ?? 0,
      max: summary.priceRangeMax ?? summary.priceRangeMin ?? 0,
    },
    propertyIds: [],
  };
}

export function mapParkingSummaryToSlot(summary: ParkingSearchSummary): {
  slot: ParkingSlot;
  developmentSlug: string;
  developmentName: string;
  city: string;
  detailSlug: string;
} {
  const parkingType = PARKING_TYPES.has(summary.parkingType as ParkingType)
    ? (summary.parkingType as ParkingType)
    : 'inside_tower';

  return {
    slot: {
      id: summary.id,
      developmentId: summary.residenceName ?? summary.id,
      slotLabel: summary.slotLabel || summary.name,
      type: parkingType,
      tower: summary.tower ?? '',
      level: summary.level ?? '',
      isAvailable: true,
      ratePerNight: summary.ratePerNight ?? undefined,
      features: summary.features,
      imageUrl: resolveListingCoverImage(
        summary.images,
        summary.coverImage ?? summary.images[0],
        'parking',
        summary.slug
      ),
      notes: undefined,
    },
    developmentSlug: summary.residenceName
      ? summary.residenceName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : 'parking',
    developmentName: summary.residenceName ?? summary.name,
    city: summary.city ?? '',
    detailSlug: summary.slug,
  };
}
