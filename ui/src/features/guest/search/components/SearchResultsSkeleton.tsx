import type { SearchViewMode } from '@/features/guest/search/components/SearchResultsToolbar';
import type { SearchListingsType } from '@/features/guest/search/types/search';

import {
  ListingCardListSkeleton,
  ListingGridSkeleton,
  ListingMapSkeleton,
  ListingRowSkeleton,
} from '@/components/skeletons/ListingGridSkeleton';

type Props = {
  viewMode?: SearchViewMode;
  /** Active results category — picks the right card shape (image aspect ratio, row vs. card list). */
  category?: SearchListingsType;
};

/** Real per-category grid card aspect ratios: PropertyCard/ParkingSlotCard 4:3, DevelopmentCard 16:9. */
const GRID_ASPECT_BY_CATEGORY: Record<SearchListingsType, string> = {
  all: 'aspect-[4/3]',
  properties: 'aspect-[4/3]',
  developments: 'aspect-[16/9]',
  parkings: 'aspect-[4/3]',
};

export function SearchResultsSkeleton({ viewMode = 'grid', category = 'all' }: Props) {
  if (viewMode === 'list') {
    // Developments/parkings list mode renders a single column of the same vertical
    // card used in grid mode; only properties render the wide PropertyListItem row.
    if (category === 'developments' || category === 'parkings') {
      return (
        <ListingCardListSkeleton
          count={6}
          maxWidthClassName="max-w-3xl"
          imageAspectClassName={category === 'developments' ? 'aspect-[16/9]' : 'aspect-[4/3]'}
        />
      );
    }
    return <ListingRowSkeleton count={6} maxWidthClassName="max-w-3xl" />;
  }

  if (viewMode === 'map') {
    return <ListingMapSkeleton />;
  }

  return (
    <ListingGridSkeleton
      count={8}
      columnsClassName="grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      imageAspectClassName={GRID_ASPECT_BY_CATEGORY[category]}
    />
  );
}
