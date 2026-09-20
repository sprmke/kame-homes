import { useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { useOrgIdParam, useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { resolveDashboardPeriod } from '@/features/dashboard/property/lib/dashboardPeriod';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { refetchIntervalWhenVisibleMs } from '@/lib/query/refetchWhenVisible';
import { supabase } from '@/lib/supabase/client';

const ORG_DASHBOARD_STATS_KEY = ['org-dashboard-stats'] as const;

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function fetchOrgDashboardStats(
  from: string,
  to: string,
  orgSlug: string | null,
  orgId: string | null
): Promise<DashboardStats> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) throw new Error('No admin session');

  const params = new URLSearchParams({ from, to });
  if (orgId) params.set('org_id', orgId);
  else if (orgSlug) params.set('org_slug', orgSlug);

  const res = await fetch(`${FUNCTIONS_URL}/dashboard-stats?${params.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const text = await res.text();
  let json: { success?: boolean; error?: string; data?: DashboardStats };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(text.trim() || 'Failed to load org dashboard');
  }
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load org dashboard');
  }
  const data = json.data as DashboardStats;
  return {
    ...data,
    parkingCount: data.parkingCount ?? 0,
    parkingPerformance: data.parkingPerformance ?? [],
    recentBookings: (data.recentBookings ?? []).map((booking) => ({
      ...booking,
      bookingKind: booking.bookingKind ?? (booking.parkingId ? 'parking' : 'property'),
      parkingId: booking.parkingId ?? '',
      parkingName: booking.parkingName ?? '',
      parkingSlug: booking.parkingSlug ?? '',
      propertyId: booking.propertyId ?? '',
      propertyName: booking.propertyName ?? '',
      propertySlug: booking.propertySlug ?? '',
    })),
  };
}

export function useOrgDashboardStats() {
  const [searchParams] = useSearchParams();
  const orgSlug = useOrgSlugParam();
  const orgId = useOrgIdParam();

  const period = useMemo(() => resolveDashboardPeriod(searchParams), [searchParams]);

  const query = useQuery({
    queryKey: [...ORG_DASHBOARD_STATS_KEY, orgSlug, orgId, period] as const,
    queryFn: () => fetchOrgDashboardStats(period.from, period.to, orgSlug, orgId),
    enabled: Boolean(orgSlug || orgId),
    staleTime: 30_000,
    refetchInterval: refetchIntervalWhenVisibleMs(60_000),
  });

  return { ...query, period };
}
