import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchFinanceBookings } from '@/features/dashboard/finance/hooks/useFinanceApi';
import type { FinanceQuery } from '@/features/dashboard/finance/lib/types';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

const FINANCE_BOOKINGS_KEY = ['finance-bookings'] as const;

export function useFinanceBookings(query: FinanceQuery, options?: { enabled?: boolean }) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: [...FINANCE_BOOKINGS_KEY, scopeKey, query] as const,
    queryFn: () => fetchFinanceBookings(query, scope),
    placeholderData: keepPreviousData,
    enabled: (options?.enabled ?? true) && !scope.parkingId,
  });
}
