import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { PlatformProperty } from '@/features/dashboard/super-admin/types/platformProperty';

import { ADMIN_DEFAULT_PAGE_SIZE } from '@/lib/table/pagination';

export const PLATFORM_PROPERTIES_QUERY_KEY = ['super-admin', 'platform-properties'] as const;

type PlatformPropertiesResult = {
  rows: PlatformProperty[];
  total: number;
};

export function usePlatformProperties(params?: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  type?: string;
  development?: string;
}) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? ADMIN_DEFAULT_PAGE_SIZE;
  const q = params?.q?.trim() ?? '';
  const status = params?.status ?? 'all';
  const type = params?.type ?? 'all';
  const development = params?.development ?? 'all';

  return useQuery({
    queryKey: [
      ...PLATFORM_PROPERTIES_QUERY_KEY,
      page,
      limit,
      q,
      status,
      type,
      development,
    ] as const,
    queryFn: () => {
      const search = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) search.set('q', q);
      if (status !== 'all') search.set('status', status);
      if (type !== 'all') search.set('type', type);
      if (development !== 'all') search.set('development', development);
      return callEdgeFunction<{ properties: PlatformProperty[]; total: number }>(
        `list-platform-properties?${search.toString()}`
      ).then((data): PlatformPropertiesResult => ({ rows: data.properties, total: data.total }));
    },
    placeholderData: keepPreviousData,
  });
}
