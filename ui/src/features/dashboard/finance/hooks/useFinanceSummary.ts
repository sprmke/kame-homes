import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchFinanceSummary } from '@/features/dashboard/finance/hooks/useFinanceApi';
import type { FinanceQuery } from '@/features/dashboard/finance/lib/types';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

export const FINANCE_SUMMARY_KEY = ['finance-summary'] as const;

export function useFinanceSummary(query: FinanceQuery) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: [...FINANCE_SUMMARY_KEY, scopeKey, query] as const,
    queryFn: () => fetchFinanceSummary(query, scope),
    placeholderData: keepPreviousData,
  });
}
