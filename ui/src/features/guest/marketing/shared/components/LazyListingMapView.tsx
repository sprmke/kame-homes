import { lazy, Suspense, type ComponentProps } from 'react';

import { ListingMapSkeleton } from '@/components/skeletons/ListingGridSkeleton';

const ListingMapViewImpl = lazy(() =>
  import('@/features/guest/marketing/shared/components/ListingMapView').then((m) => ({
    default: m.ListingMapView,
  }))
);

type Props = ComponentProps<typeof ListingMapViewImpl>;

/**
 * Map view loaded on demand: grid/list visitors never download the map module or the
 * Google Maps loader. Shows the map skeleton while the chunk loads.
 */
export function LazyListingMapView(props: Props) {
  return (
    <Suspense fallback={<ListingMapSkeleton />}>
      <ListingMapViewImpl {...props} />
    </Suspense>
  );
}
