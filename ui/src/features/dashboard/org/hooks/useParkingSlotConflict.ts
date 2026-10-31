import { useMemo } from 'react';

import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { useAllOrgParkings } from '@/features/dashboard/org/hooks/useParkings';
import { DEFAULT_PARKING_RESIDENCE_NAME } from '@/features/dashboard/org/lib/parkingResidences';
import { findParkingSlotConflict } from '@/features/dashboard/org/lib/parkingSlotConflict';

export function useParkingSlotConflict(
  tower: string,
  level: string,
  slotLabel: string,
  residenceName: string = DEFAULT_PARKING_RESIDENCE_NAME,
  excludeParkingId?: string
) {
  const { data: orgData, isLoading: orgsLoading } = useOrganizations();
  const organizations = orgData?.organizations ?? [];
  const { byOrgSlug, isLoading: parkingsLoading } = useAllOrgParkings(organizations);

  const parkings = useMemo(
    () =>
      organizations.flatMap((org) =>
        (byOrgSlug.get(org.slug) ?? []).map((parking) => ({
          ...parking,
          orgName: org.name,
          orgSlug: org.slug,
        }))
      ),
    [organizations, byOrgSlug]
  );

  const conflict = useMemo(
    () =>
      findParkingSlotConflict(parkings, residenceName, tower, level, slotLabel, excludeParkingId),
    [parkings, residenceName, tower, level, slotLabel, excludeParkingId]
  );

  return {
    conflict,
    hasDuplicate: conflict !== null,
    isChecking: orgsLoading || parkingsLoading,
  };
}
