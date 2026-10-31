import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpFromLine, Car, Clock, MoveHorizontal, Ruler } from 'lucide-react';

import {
  developmentDetailPath,
  type ResolvedPublicDevelopment,
} from '@/features/guest/marketing/developments/lib/resolvePublicDevelopment';
import { formatParkingDimensionMeters } from '@/features/guest/marketing/parkings/lib/parkingDimensions';
import { parkingTypeLabel } from '@/features/guest/marketing/parkings/lib/parkingTypeLabel';
import { ListingExpandableText } from '@/features/guest/marketing/shared/components/ListingExpandableText';
import {
  ListingHostCard,
  type ListingHostInfo,
} from '@/features/guest/marketing/shared/components/ListingHostCard';
import { ListingPlaceMeta } from '@/features/guest/marketing/shared/components/ListingPlaceMeta';
import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';
import { buildParkingPlacementLabels } from '@/features/guest/marketing/shared/lib/listingPlacement';

import {
  DEFAULT_PARKING_HEIGHT_CLEARANCE_M,
  DEFAULT_PARKING_SPACE_LENGTH_M,
  DEFAULT_PARKING_SPACE_WIDTH_M,
} from '@/features/dashboard/parking/lib/parkingDimensionDefaults';

type Props = {
  name: string;
  parkingType: string;
  development: ResolvedPublicDevelopment | null;
  tower: string | null;
  level: string | null;
  slotLabel: string;
  description: string | null;
  host: ListingHostInfo | null;
  geoLocation?: string | null;
  spaceLengthM?: number | null;
  spaceWidthM?: number | null;
  heightClearanceM?: number | null;
  checkInTime?: string;
  checkOutTime?: string;
  recommendedBadge?: boolean;
  onContactHost?: () => void;
};

function DimensionChip({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Ruler;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
      <span className="text-foreground text-sm font-medium tabular-nums">{value}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}

export function ParkingOverview({
  name,
  parkingType,
  recommendedBadge = false,
  development,
  tower,
  level,
  description,
  host,
  geoLocation,
  spaceLengthM = DEFAULT_PARKING_SPACE_LENGTH_M,
  spaceWidthM = DEFAULT_PARKING_SPACE_WIDTH_M,
  heightClearanceM = DEFAULT_PARKING_HEIGHT_CLEARANCE_M,
  checkInTime = '2:00 PM',
  checkOutTime = '12:00 PM',
  onContactHost,
}: Props) {
  const reduceMotion = useReducedMotion();
  const placementLabels = buildParkingPlacementLabels(tower, level);
  const resolvedGeo = geoLocation?.trim() || development?.locationLabel || null;

  const lengthLabel = formatParkingDimensionMeters(spaceLengthM)!;
  const widthLabel = formatParkingDimensionMeters(spaceWidthM)!;
  const heightLabel = formatParkingDimensionMeters(heightClearanceM)!;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium">
            <Car className="h-3.5 w-3.5" aria-hidden />
            {parkingTypeLabel(parkingType)}
          </span>
          {recommendedBadge ? <ListingRecommendedBadge size="md" /> : null}
        </div>

        <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
          {name}
        </h1>

        <ListingPlaceMeta
          development={
            development
              ? { name: development.name, href: developmentDetailPath(development.slug) }
              : null
          }
          placementLabels={placementLabels}
          geoLocation={resolvedGeo}
        />
      </div>

      <div className="border-border/70 flex flex-wrap gap-x-6 gap-y-3 border-y py-4">
        <DimensionChip icon={Ruler} value={lengthLabel} label="length" />
        <DimensionChip icon={MoveHorizontal} value={widthLabel} label="width" />
        <DimensionChip icon={ArrowUpFromLine} value={heightLabel} label="clearance" />
        <div
          className="text-muted-foreground bg-border hidden h-5 w-px self-center sm:block"
          aria-hidden
        />
        <div className="flex min-w-0 items-center gap-2">
          <Clock className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          <span className="text-foreground text-sm font-medium">{checkInTime}</span>
          <span className="text-muted-foreground text-sm">in</span>
          <span className="text-muted-foreground text-sm">·</span>
          <span className="text-foreground text-sm font-medium">{checkOutTime}</span>
          <span className="text-muted-foreground text-sm">out</span>
        </div>
      </div>

      {host ? <ListingHostCard host={host} onContactHost={onContactHost} /> : null}

      {description ? (
        <div className="space-y-3">
          <h2 className="text-foreground text-base font-semibold sm:text-lg">About this parking</h2>
          <ListingExpandableText text={description} maxLines={6} />
        </div>
      ) : null}
    </motion.div>
  );
}
