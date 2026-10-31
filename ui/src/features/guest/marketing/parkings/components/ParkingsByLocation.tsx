import { Car } from 'lucide-react';

import { ListingPlaceGroupsFooter } from '@/features/guest/marketing/shared/components/ListingPlaceGroupsFooter';

import { ParkingsLocationRow } from './ParkingsLocationRow';
import { groupParkingsByLocation } from '../lib/groupParkingsByLocation';

import type { ParkingLocationGroup } from '../lib/groupParkingsByLocation';
import type { ParkingListEntry } from '../lib/parkingListEntries';

interface ParkingsByLocationProps {
  entries?: ParkingListEntry[];
  groups?: ParkingLocationGroup[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  hasLoadMoreError?: boolean;
  onLoadMore?: () => void;
}

export function ParkingsByLocation({
  entries = [],
  groups: providedGroups,
  hasMore = false,
  isLoadingMore = false,
  hasLoadMoreError = false,
  onLoadMore,
}: ParkingsByLocationProps) {
  const groups = providedGroups ?? groupParkingsByLocation(entries);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-muted mb-4 rounded-full p-5">
          <Car className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">No parking found</h3>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-7 md:space-y-12">
      {groups.map((group) => (
        <ParkingsLocationRow
          key={group.city}
          title={group.title}
          viewAllTo={`/parkings/in/${group.locationSlug}`}
          entries={group.entries}
        />
      ))}
      {onLoadMore ? (
        <ListingPlaceGroupsFooter
          hasMore={hasMore}
          isLoading={isLoadingMore}
          hasError={hasLoadMoreError}
          onLoadMore={onLoadMore}
        />
      ) : null}
    </div>
  );
}
