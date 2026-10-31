import { useParams } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';

import { PARKINGS_QUERY_KEY } from '@/features/dashboard/org/hooks/useParkings';
import {
  defaultOrgListingViewMode,
  type OrgListingViewMode,
} from '@/features/dashboard/org/lib/orgListingViewMode';
import type { Parking, Property } from '@/features/dashboard/org/types';

import { useIsBelowLg } from '@/hooks/useMediaQuery';

type ListingSource = 'properties' | 'parkings' | 'listings';

/**
 * Default org listing view for a loading skeleton, from the cached property / parking
 * lists (the sidebar loads both). Read-only: never starts a fetch.
 */
export function useOrgListingSkeletonView(source: ListingSource): OrgListingViewMode {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const queryClient = useQueryClient();
  const hideTable = useIsBelowLg();

  const propertyCount =
    source === 'parkings'
      ? 0
      : (queryClient.getQueryData<{ properties: Property[] }>(['properties', orgSlug])?.properties
          .length ?? 0);
  const parkingCount =
    source === 'properties'
      ? 0
      : (queryClient.getQueryData<{ parkings: Parking[] }>([...PARKINGS_QUERY_KEY, orgSlug])
          ?.parkings.length ?? 0);

  return defaultOrgListingViewMode(propertyCount + parkingCount, { hideTable });
}
