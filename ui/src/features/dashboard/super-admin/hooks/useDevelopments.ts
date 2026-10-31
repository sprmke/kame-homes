import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Development } from '@/features/dashboard/super-admin/types/development';

import { ADMIN_DEFAULT_PAGE_SIZE } from '@/lib/table/pagination';

export const DEVELOPMENTS_QUERY_KEY = ['super-admin', 'developments'] as const;

export function developmentQueryKey(slug: string) {
  return ['super-admin', 'development', slug] as const;
}

type DevelopmentsResult = {
  rows: Development[];
  total: number;
};

export function useDevelopments(params?: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  type?: string;
}) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? ADMIN_DEFAULT_PAGE_SIZE;
  const q = params?.q?.trim() ?? '';
  const status = params?.status ?? 'all';
  const type = params?.type ?? 'all';

  return useQuery({
    queryKey: [...DEVELOPMENTS_QUERY_KEY, page, limit, q, status, type] as const,
    queryFn: () => {
      const search = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) search.set('q', q);
      if (status !== 'all') search.set('status', status);
      if (type !== 'all') search.set('type', type);
      return callEdgeFunction<{ developments: Development[]; total: number }>(
        `list-developments?${search.toString()}`
      ).then((data): DevelopmentsResult => ({ rows: data.developments, total: data.total }));
    },
    placeholderData: keepPreviousData,
  });
}

export function useDevelopment(slug: string | undefined) {
  return useQuery({
    queryKey: developmentQueryKey(slug ?? ''),
    enabled: Boolean(slug),
    queryFn: () =>
      callEdgeFunction<{ development: Development }>(
        `get-development?slug=${encodeURIComponent(slug!)}`
      ).then((data) => data.development),
  });
}

export function useCreateDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type?: string }) =>
      callEdgeFunction<{ development: Development }>('create-development', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((data) => data.development),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: DEVELOPMENTS_QUERY_KEY });
    },
  });
}

export function useUpdateDevelopment(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown> & { developmentId: string }) =>
      callEdgeFunction<{ development: Development }>('update-development', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).then((data) => data.development),
    onSuccess: async (development) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: DEVELOPMENTS_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: developmentQueryKey(slug) }),
        qc.invalidateQueries({ queryKey: ['host-announcements'] }),
        qc.setQueryData(developmentQueryKey(development.slug), development),
      ]);
    },
  });
}

export function useDeleteDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (developmentId: string) =>
      callEdgeFunction<{ deleted: boolean }>('delete-development', {
        method: 'POST',
        body: JSON.stringify({ developmentId }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: DEVELOPMENTS_QUERY_KEY });
    },
  });
}
