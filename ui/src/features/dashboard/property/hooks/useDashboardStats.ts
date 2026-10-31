import { useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { appendPropertyId, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { resolveDashboardPeriod } from '@/features/dashboard/property/lib/dashboardPeriod';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { refetchIntervalWhenVisibleMs } from '@/lib/query/refetchWhenVisible';
import { supabase } from '@/lib/supabase/client';

const DASHBOARD_STATS_KEY = ['dashboard-stats'] as const;

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function fetchDashboardStats(
  from: string,
  to: string,
  propertyId: string | null
): Promise<DashboardStats> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) throw new Error('No admin session');

  const params = appendPropertyId(new URLSearchParams({ from, to }), propertyId);
  const res = await fetch(`${FUNCTIONS_URL}/dashboard-stats?${params.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load dashboard');
  }
  return json.data as DashboardStats;
}

export function useDashboardStats() {
  const [searchParams] = useSearchParams();
  const propertyId = usePropertyIdParam();

  const period = useMemo(() => resolveDashboardPeriod(searchParams), [searchParams]);

  const query = useQuery({
    queryKey: [...DASHBOARD_STATS_KEY, propertyId, period] as const,
    queryFn: () => fetchDashboardStats(period.from, period.to, propertyId),
    staleTime: 30_000,
    refetchInterval: refetchIntervalWhenVisibleMs(60_000),
  });

  return { ...query, period };
}
