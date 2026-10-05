import { useMemo } from 'react';

import { LazyListingMapView as ListingMapView } from '@/features/guest/marketing/shared/components/LazyListingMapView';
import {
  markersFromCoords,
  type MapBbox,
} from '@/features/guest/marketing/shared/lib/listingMapMarkers';

import type { Development } from '../types';

interface DevelopmentsMapProps {
  developments: Development[];
  totalInView?: number;
  /** Bounds currently applied from the URL. */
  bbox?: MapBbox | null;
  loading?: boolean;
  onViewportChange?: (bbox: MapBbox) => void;
  onResetViewport?: () => void;
}

export function DevelopmentsMap({
  developments,
  totalInView,
  bbox = null,
  loading = false,
  onViewportChange,
  onResetViewport,
}: DevelopmentsMapProps) {
  const markers = useMemo(
    () =>
      markersFromCoords(developments, (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        price: row.priceRange.min > 0 ? row.priceRange.min : null,
        rating: row.rating ?? null,
        images: row.images,
        href: `/developments/${row.slug}`,
        family: 'development' as const,
      })),
    [developments]
  );

  return (
    <ListingMapView
      markers={markers}
      totalInView={totalInView ?? developments.length}
      nounSingular="development"
      nounPlural="developments"
      initialBbox={bbox}
      loading={loading}
      onViewportChange={onViewportChange}
      onResetViewport={onResetViewport}
    />
  );
}
