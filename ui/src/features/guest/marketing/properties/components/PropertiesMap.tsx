import { useMemo } from 'react';

import { LazyListingMapView as ListingMapView } from '@/features/guest/marketing/shared/components/LazyListingMapView';
import {
  markersFromCoords,
  type MapBbox,
} from '@/features/guest/marketing/shared/lib/listingMapMarkers';

import type { Property } from './PropertyCard';

interface PropertiesMapProps {
  properties: Property[];
  totalInView?: number;
  /** Bounds currently applied from the URL. */
  bbox?: MapBbox | null;
  loading?: boolean;
  onViewportChange?: (bbox: MapBbox) => void;
  onResetViewport?: () => void;
}

export function PropertiesMap({
  properties,
  totalInView,
  bbox = null,
  loading = false,
  onViewportChange,
  onResetViewport,
}: PropertiesMapProps) {
  const markers = useMemo(
    () =>
      markersFromCoords(properties, (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        price: row.price,
        rating: row.rating,
        images: row.images,
        href: `/properties/${row.slug}`,
        family: 'property' as const,
      })),
    [properties]
  );

  return (
    <ListingMapView
      markers={markers}
      totalInView={totalInView ?? properties.length}
      nounSingular="property"
      nounPlural="properties"
      initialBbox={bbox}
      loading={loading}
      onViewportChange={onViewportChange}
      onResetViewport={onResetViewport}
    />
  );
}
