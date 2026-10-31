import { useQuery } from '@tanstack/react-query';

import {
  defaultUnitTypesForResidence,
  type DevelopmentUnitType,
} from '@/features/dashboard/bookings/lib/unitTypes';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export function residenceUnitTypesQueryKey(residenceName: string) {
  return ['residence-unit-types', residenceName.trim()] as const;
}

export function useResidenceUnitTypes(residenceName: string) {
  const normalized = residenceName.trim();

  return useQuery({
    queryKey: residenceUnitTypesQueryKey(normalized),
    enabled: Boolean(normalized),
    queryFn: async (): Promise<DevelopmentUnitType[]> => {
      try {
        const data = await callEdgeFunction<{ unitTypes: DevelopmentUnitType[] }>(
          `get-residence-unit-types?residenceName=${encodeURIComponent(normalized)}`
        );
        return data.unitTypes;
      } catch {
        return defaultUnitTypesForResidence(normalized);
      }
    },
    placeholderData: () => defaultUnitTypesForResidence(normalized),
    // Matches the server's `publicStatic` class (max-age=300) — reference-data
    // vocabulary that only changes on a super-admin development edit. Doc 11 Phase 11.6.
    staleTime: 5 * 60_000,
  });
}
