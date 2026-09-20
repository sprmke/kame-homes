import type { ResolvedCancellationPolicyDisplay } from '@/features/dashboard/org/lib/propertyCancellationPolicy';

export type PublicPropertyMedia = {
  id: string;
  url: string;
  type: 'image' | 'video';
  caption?: string;
  isPrimary?: boolean;
  order: number;
};

export type PublicPropertyPricing = {
  weekdayNightlyRate: number;
  weekendNightlyRate: number;
  securityDeposit: number | null;
  petFee: number | null;
  parkingRateGuest: number | null;
  currency: 'PHP';
};

export type PublicPropertyHost = {
  unitName: string;
  organizationName: string;
  organizationSlug: string;
  organizationLogoUrl: string | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  brandColor: string;
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
  media: PublicPropertyMedia[];
  images: string[];
  pricing: PublicPropertyPricing;
  houseRules: Array<{
    id: string;
    text: string;
    type: 'info' | 'prohibited' | 'allowed';
  }>;
  cancellationPolicy: ResolvedCancellationPolicyDisplay;
  host: PublicPropertyHost;
  rating: number | null;
  reviewCount: number;
  guestReviews: PublicGuestReview[];
  isSuperhost?: boolean;
  /** Host-wide Recommended badge (org Tier 2). */
  verifiedBadge?: boolean;
  /** This listing's Recommended badge (listing Tier 2). */
  recommendedBadge?: boolean;
  updatedAt: string;
  /** Present once public-page-configs ships; optional for older responses. */
  sectionConfig?: PropertyLandingSectionConfig;
};

export type PropertyLandingSectionId =
  'gallery' | 'overview' | 'amenities' | 'location' | 'rules' | 'reviews';

export type PropertyLandingSectionConfig = {
  version: 1;
  sections: Array<{
    id: PropertyLandingSectionId;
    visible: boolean;
    order: number;
  }>;
};

export type PublicGuestReview = {
  id: string;
  author: string;
  date: string;
  rating: number;
  comment: string;
  feedbackTags: string[];
  media: Array<{ url: string; type: 'image' | 'video' }>;
  source?: 'kame' | 'facebook' | 'airbnb';
  createdAt?: string | null;
};

export type PublicHouseRule = PublicPropertyDetailDto['houseRules'][number];

export type PublicPropertySource = 'api' | 'mock';

export type ResolvedPropertyHost = {
  unitName: string;
  organizationName: string;
  organizationSlug: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  organizationLogoUrl: string | null;
};

export type ResolvedPropertyDetail = {
  source: PublicPropertySource;
  brandColor?: string;
  slug: string;
  id: string;
  name: string;
  type: string;
  description: string | null;
  location: string;
  address: string;
  city: string;
  state: string | null;
  country: string;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  mapsUrl: string | null;
  residenceName: string | null;
  tower: string | null;
  unitNumber: string | null;
  towerAndUnit: string | null;
  developmentSlug?: string | null;
  floors: number;
  houseRules: PublicHouseRule[];
  cancellationPolicy: ResolvedCancellationPolicyDisplay;
  checkInTime: string;
  checkOutTime: string;
  selfCheckIn: boolean;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  maxAdults: number;
  maxChildren: number;
  amenities: string[];
  images: string[];
  media: PublicPropertyMedia[];
  rating?: number | null;
  reviews?: number | null;
  guestReviews?: PublicGuestReview[];
  isSuperhost?: boolean;
  /** Host-wide Recommended badge (org Tier 2). */
  verifiedBadge?: boolean;
  /** This listing's Recommended badge (listing Tier 2). */
  recommendedBadge?: boolean;
  host?: ResolvedPropertyHost;
  /** @deprecated Use host.organizationName — kept for mock marketing copy */
  hostName?: string;
  /** @deprecated Use host.ownerAvatarUrl */
  hostImage?: string | null;
  pricing: {
    baseRate: number;
    currency: string;
    cleaningFee: number | null;
    securityDeposit: number | null;
    parkingRate: number | null;
    petFee: number | null;
  };
  sectionConfig?: PropertyLandingSectionConfig;
};
