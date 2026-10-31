import { Building2 } from 'lucide-react';

import { ListingPlaceGroupsFooter } from '@/features/guest/marketing/shared/components/ListingPlaceGroupsFooter';

import { DevelopmentsLocationRow } from './DevelopmentsLocationRow';
import { groupDevelopmentsByLocation } from '../lib/groupDevelopmentsByLocation';

import type { DevelopmentLocationGroup } from '../lib/groupDevelopmentsByLocation';
import type { Development } from '../types';

interface DevelopmentsByLocationProps {
  developments?: Development[];
  groups?: DevelopmentLocationGroup[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  hasLoadMoreError?: boolean;
  onLoadMore?: () => void;
}

export function DevelopmentsByLocation({
  developments = [],
  groups: providedGroups,
  hasMore = false,
  isLoadingMore = false,
  hasLoadMoreError = false,
  onLoadMore,
}: DevelopmentsByLocationProps) {
  const groups = providedGroups ?? groupDevelopmentsByLocation(developments);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-muted mb-4 rounded-full p-5">
          <Building2 className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">No developments found</h3>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-7 md:space-y-12">
      {groups.map((group) => (
        <DevelopmentsLocationRow
          key={group.city}
          title={group.title}
          viewAllTo={`/developments/in/${group.locationSlug}`}
          developments={group.developments}
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
