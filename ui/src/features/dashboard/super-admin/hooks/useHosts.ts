import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  HostOrganization,
  HostProperty,
  HostsSummary,
  HostSummary,
} from '@/features/dashboard/super-admin/types/host';

import { ADMIN_DEFAULT_PAGE_SIZE } from '@/lib/table/pagination';

export const HOSTS_QUERY_KEY = ['super-admin', 'hosts'] as const;

export function hostQueryKey(hostId: string) {
  return ['super-admin', 'host', hostId] as const;
}

export function hostOrganizationsQueryKey(hostId: string) {
  return ['super-admin', 'host', hostId, 'organizations'] as const;
}

export function hostPropertiesQueryKey(hostId: string) {
  return ['super-admin', 'host', hostId, 'properties'] as const;
}

export function useHosts(params?: { page?: number; limit?: number; q?: string }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? ADMIN_DEFAULT_PAGE_SIZE;
  const q = params?.q?.trim() ?? '';

  return useQuery({
    queryKey: [...HOSTS_QUERY_KEY, page, limit, q] as const,
    queryFn: () => {
      const search = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) search.set('q', q);
      return callEdgeFunction<{ hosts: HostSummary[]; total: number; summary: HostsSummary }>(
        `list-hosts?${search.toString()}`
      ).then((data) => ({ rows: data.hosts, total: data.total, summary: data.summary }));
    },
    placeholderData: keepPreviousData,
  });
}

export function useHost(hostId: string | undefined) {
  return useQuery({
    queryKey: hostQueryKey(hostId ?? ''),
    enabled: Boolean(hostId),
    queryFn: () =>
      callEdgeFunction<{ host: HostSummary }>(
        `get-host?hostId=${encodeURIComponent(hostId!)}`
      ).then((data) => data.host),
  });
}

export function useHostOrganizations(
  hostId: string | undefined,
  page = 1,
  limit: number = ADMIN_DEFAULT_PAGE_SIZE,
  q = ''
) {
  const trimmedQ = q.trim();
  return useQuery({
    queryKey: [...hostOrganizationsQueryKey(hostId ?? ''), page, limit, trimmedQ] as const,
    enabled: Boolean(hostId),
    queryFn: () => {
      const search = new URLSearchParams({
        hostId: hostId!,
        page: String(page),
        limit: String(limit),
      });
      if (trimmedQ) search.set('q', trimmedQ);
      return callEdgeFunction<{ organizations: HostOrganization[]; total: number }>(
        `list-host-organizations?${search.toString()}`
      ).then((data) => ({ rows: data.organizations, total: data.total }));
    },
    placeholderData: keepPreviousData,
  });
}

export function useHostProperties(
  hostId: string | undefined,
  params?: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    type?: string;
    orgId?: string;
  }
) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? ADMIN_DEFAULT_PAGE_SIZE;
  const q = params?.q?.trim() ?? '';
  const status = params?.status ?? 'all';
  const type = params?.type ?? 'all';
  const orgId = params?.orgId ?? 'all';

  return useQuery({
    queryKey: [
      ...hostPropertiesQueryKey(hostId ?? ''),
      page,
      limit,
      q,
      status,
      type,
      orgId,
    ] as const,
    enabled: Boolean(hostId),
    queryFn: () => {
      const search = new URLSearchParams({
        hostId: hostId!,
        page: String(page),
        limit: String(limit),
      });
      if (q) search.set('q', q);
      if (status !== 'all') search.set('status', status);
      if (type !== 'all') search.set('type', type);
      if (orgId !== 'all') search.set('orgId', orgId);
      return callEdgeFunction<{ properties: HostProperty[]; total: number }>(
        `list-host-properties?${search.toString()}`
      ).then((data) => ({ rows: data.properties, total: data.total }));
    },
    placeholderData: keepPreviousData,
  });
}
