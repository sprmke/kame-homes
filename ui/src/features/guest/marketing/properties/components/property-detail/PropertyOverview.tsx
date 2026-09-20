import { motion } from 'framer-motion';
import { Star, Users, Bed, Bath, Building2, Award, Shield, Clock, Home } from 'lucide-react';

import { resolveOrgDisplayName } from '@/features/guest/form/lib/guestFormBranding';
import {
  developmentDetailPath,
  resolvePublicDevelopment,
} from '@/features/guest/marketing/developments/lib/resolvePublicDevelopment';
import { shouldShowPropertyFloors } from '@/features/guest/marketing/properties/lib/propertyOverviewStats';
import type { ResolvedPropertyHost } from '@/features/guest/marketing/properties/types/publicProperty';
import { ListingCheckInOutTimes } from '@/features/guest/marketing/shared/components/ListingCheckInOutTimes';
import { ListingExpandableText } from '@/features/guest/marketing/shared/components/ListingExpandableText';
import { ListingFeatureItem } from '@/features/guest/marketing/shared/components/ListingFeatureItem';
import {
  ListingHostCard,
  type ListingHostInfo,
} from '@/features/guest/marketing/shared/components/ListingHostCard';
import { ListingPlaceMeta } from '@/features/guest/marketing/shared/components/ListingPlaceMeta';
import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';
import { ListingStatItem } from '@/features/guest/marketing/shared/components/ListingStatItem';
import { buildPropertyPlacementLabels } from '@/features/guest/marketing/shared/lib/listingPlacement';

import type { ResolvedCancellationPolicyDisplay } from '@/features/dashboard/org/lib/propertyCancellationPolicy';

interface PropertyOverviewProps {
  name: string;
  type: string;
  description: string | null;
  location: {
    address: string;
    city: string;
    state?: string | null;
    country: string;
  };
  stats: {
    bedrooms?: number | null;
    bathrooms?: number | null;
    maxGuests?: number | null;
    floors?: number | null;
  };
  residenceName?: string | null;
  developmentSlug?: string | null;
  tower?: string | null;
  unitNumber?: string | null;
  towerAndUnit?: string | null;
  checkInTime?: string;
  checkOutTime?: string;
  rating?: number | null;
  reviews?: number | null;
  isSuperhost?: boolean;
  /** Host-wide badge — shown on the host card. */
  verifiedBadge?: boolean;
  /** This listing's badge — shown next to the listing type. */
  recommendedBadge?: boolean;
  host?: ResolvedPropertyHost;
  selfCheckIn?: boolean;
  showMarketingFeatures?: boolean;
  cancellationPolicy?: ResolvedCancellationPolicyDisplay;
  onContactHost?: () => void;
}

const propertyTypeLabels: Record<string, string> = {
  APARTMENT: 'Apartment',
  CONDO: 'Condo',
  HOUSE: 'House',
  VILLA: 'Villa',
  RESORT: 'Resort',
  HOTEL: 'Hotel',
  OTHER: 'Property',
};

export function PropertyOverview({
  name,
  type,
  description,
  location,
  stats,
  residenceName = null,
  developmentSlug = null,
  tower = null,
  unitNumber = null,
  towerAndUnit = null,
  checkInTime = '2:00 PM',
  checkOutTime = '11:00 AM',
  rating,
  reviews,
  isSuperhost = false,
  verifiedBadge = false,
  recommendedBadge = false,
  host,
  selfCheckIn = false,
  showMarketingFeatures = true,
  cancellationPolicy,
  onContactHost,
}: PropertyOverviewProps) {
  const locationString = [location.city, location.state, location.country]
    .filter(Boolean)
    .join(', ');

  const development = resolvePublicDevelopment(residenceName, developmentSlug);
  const placementLabels = buildPropertyPlacementLabels({ tower, unitNumber, towerAndUnit });

  const showFloors = shouldShowPropertyFloors(type, residenceName);
  const floorCount = stats.floors ?? 1;

  const hostLabel = host?.ownerName || 'Host';
  const rawOrg = host?.organizationName?.trim() || '';
  const orgLabel = resolveOrgDisplayName(rawOrg, 'Host');
  const hostAvatar = host?.ownerAvatarUrl || host?.organizationLogoUrl || null;

  const listingHost: ListingHostInfo | null = host
    ? {
        organizationName: orgLabel,
        organizationSlug: host.organizationSlug,
        ownerName: hostLabel,
        ownerAvatarUrl: hostAvatar,
        organizationLogoUrl: host.organizationLogoUrl,
        isSuperhost,
        verifiedBadge,
      }
    : null;

  return (
    <div className="@container min-w-0 space-y-6">
      {/* Header */}
      <div className="min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 flex flex-wrap items-center gap-2"
        >
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium">
            <Home className="h-3.5 w-3.5" />
            {propertyTypeLabels[type] || type}
          </span>
          {isSuperhost ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              <Award className="h-3.5 w-3.5" />
              Superhost
            </span>
          ) : null}
          {recommendedBadge ? <ListingRecommendedBadge size="md" /> : null}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-foreground @xl:text-3xl @5xl:text-4xl mb-2 break-words text-xl font-bold sm:text-2xl"
        >
          {name}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="min-w-0 space-y-2"
        >
          {rating != null && reviews != null ? (
            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              <span className="text-foreground font-semibold">{rating}</span>
              <span>·</span>
              <span className="underline">{reviews} reviews</span>
            </div>
          ) : null}

          <ListingPlaceMeta
            development={
              development
                ? { name: development.name, href: developmentDetailPath(development.slug) }
                : null
            }
            placementLabels={placementLabels}
            geoLocation={locationString || null}
            motionDelay={0}
          />
        </motion.div>
      </div>

      {/* Stats Grid — container-aware so narrow preview/content columns never crush cells */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="border-border bg-card @md:gap-4 @md:px-4 @2xl:grid-cols-4 @2xl:px-6 grid grid-cols-2 gap-3 rounded-2xl border px-3 py-3"
      >
        {stats.maxGuests ? (
          <ListingStatItem icon={Users} value={stats.maxGuests} label="guests" />
        ) : null}
        {stats.bedrooms ? (
          <ListingStatItem
            icon={Bed}
            value={stats.bedrooms}
            label={stats.bedrooms === 1 ? 'bedroom' : 'bedrooms'}
          />
        ) : null}
        {stats.bathrooms ? (
          <ListingStatItem
            icon={Bath}
            value={stats.bathrooms}
            label={stats.bathrooms === 1 ? 'bathroom' : 'bathrooms'}
          />
        ) : null}
        {showFloors ? (
          <ListingStatItem
            icon={Building2}
            value={floorCount}
            label={floorCount === 1 ? 'floor' : 'floors'}
          />
        ) : null}
      </motion.div>

      {/* Host Info */}
      {listingHost ? (
        <ListingHostCard host={listingHost} motionDelay={0.2} onContactHost={onContactHost} />
      ) : null}

      {selfCheckIn || cancellationPolicy?.showListingHighlight || showMarketingFeatures ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col items-start justify-start gap-5 sm:flex-row sm:gap-10"
        >
          {selfCheckIn ? (
            <ListingFeatureItem
              icon={Clock}
              title="Self check-in"
              description="Check yourself in with the lockbox."
            />
          ) : null}
          {cancellationPolicy?.showListingHighlight ? (
            <ListingFeatureItem
              icon={Shield}
              title={cancellationPolicy.title}
              description={cancellationPolicy.description}
            />
          ) : null}
          {showMarketingFeatures ? (
            <ListingFeatureItem
              icon={Award}
              title={isSuperhost ? 'Superhost' : 'Experienced host'}
              description={
                isSuperhost
                  ? `${orgLabel} is a Superhost with excellent reviews.`
                  : `${hostLabel} has been hosting for over a year.`
              }
            />
          ) : null}
        </motion.div>
      ) : null}

      <ListingCheckInOutTimes
        checkInTime={checkInTime}
        checkOutTime={checkOutTime}
        motionDelay={0.3}
      />

      {/* Description */}
      {description && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-4"
        >
          <h2 className="text-foreground text-lg font-semibold sm:text-xl">About this place</h2>
          <ListingExpandableText text={description} maxLines={8} />
        </motion.div>
      )}
    </div>
  );
}
