import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SuperAdminOrgRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  propertyCount: number;
  parkingCount: number;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  mrrPhp: number;
};

export type SuperAdminOrgsSummary = {
  total: number;
  subscribed: number;
  unsubscribed: number;
  properties: number;
  parkings: number;
};

type OrgsListResponse = {
  organizations: SuperAdminOrgRow[];
  total: number;
  page: number;
  limit: number;
};

export function useSuperAdminOrgs(params: {
  q: string;
  plan: string;
  page: number;
  limit: number;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.plan && params.plan !== 'all') search.set('plan', params.plan);
  search.set('page', String(params.page));
  search.set('limit', String(params.limit));

  return useQuery({
    queryKey: ['super-admin', 'orgs', params],
    queryFn: () =>
      callEdgeFunction<OrgsListResponse>(`list-organizations-admin?${search.toString()}`),
    staleTime: 30_000,
  });
}

export function useSuperAdminOrgsSummary() {
  return useQuery({
    queryKey: ['super-admin', 'orgs', 'summary'],
    queryFn: () =>
      callEdgeFunction<{ summary: SuperAdminOrgsSummary }>(
        'list-organizations-admin?summary=true'
      ).then((d) => d.summary),
    staleTime: 60_000,
  });
}

export type SuperAdminOrgDetail = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  owner: { name: string; email: string; avatarUrl: string | null };
  counts: { properties: number; parkings: number; members: number };
  plan: {
    code: string | null;
    name: string | null;
    status: string;
    mrrPhp: number;
    currentPeriodEnd: string | null;
  } | null;
  verification: { baseStatus: string; enhancedStatus: string };
  openWork: { pendingApprovals: number; openTickets: number };
};

export function useSuperAdminOrgDetail(slug: string | undefined) {
  return useQuery({
    queryKey: ['super-admin', 'org-detail', slug],
    enabled: Boolean(slug),
    queryFn: () =>
      callEdgeFunction<{ organization: SuperAdminOrgDetail }>(
        `get-organization-admin?slug=${encodeURIComponent(slug ?? '')}`
      ).then((d) => d.organization),
  });
}
