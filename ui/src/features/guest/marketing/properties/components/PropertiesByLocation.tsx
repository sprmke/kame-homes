import { Home } from 'lucide-react';

import { ListingPlaceGroupsFooter } from '@/features/guest/marketing/shared/components/ListingPlaceGroupsFooter';

import { PropertiesLocationRow } from './PropertiesLocationRow';
import { groupPropertiesByLocation } from '../lib/groupPropertiesByLocation';

import type { Property } from './PropertyCard';
import type { PropertyLocationGroup } from '../lib/groupPropertiesByLocation';

interface PropertiesByLocationProps {
  properties?: Property[];
  groups?: PropertyLocationGroup[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  hasLoadMoreError?: boolean;
  onLoadMore?: () => void;
}

export function PropertiesByLocation({
  properties = [],
  groups: providedGroups,
  hasMore = false,
  isLoadingMore = false,
  hasLoadMoreError = false,
  onLoadMore,
}: PropertiesByLocationProps) {
  const groups = providedGroups ?? groupPropertiesByLocation(properties);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-muted mb-4 rounded-full p-5">
          <Home className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">No properties found</h3>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 md:space-y-12">
      {groups.map((group) => (
        <PropertiesLocationRow
          key={group.place}
          title={group.title}
          viewAllTo={`/properties/in/${group.locationSlug}`}
          properties={group.properties}
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
