import { useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { appendParkingId, useParkingIdParam } from '@/features/dashboard/org/lib/adminParkingScope';
import { resolveDashboardPeriod } from '@/features/dashboard/property/lib/dashboardPeriod';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { refetchIntervalWhenVisibleMs } from '@/lib/query/refetchWhenVisible';
import { supabase } from '@/lib/supabase/client';

const PARKING_DASHBOARD_STATS_KEY = ['parking-dashboard-stats'] as const;

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function fetchParkingDashboardStats(
  from: string,
  to: string,
  parkingId: string
): Promise<DashboardStats> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) throw new Error('No admin session');

  const params = new URLSearchParams({ from, to });
  appendParkingId(params, parkingId);
  const res = await fetch(`${FUNCTIONS_URL}/dashboard-stats?${params.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load dashboard');
  }
  return json.data as DashboardStats;
}

export function useParkingDashboardStats() {
  const [searchParams] = useSearchParams();
  const parkingId = useParkingIdParam();

  const period = useMemo(() => resolveDashboardPeriod(searchParams), [searchParams]);

  const query = useQuery({
    queryKey: [...PARKING_DASHBOARD_STATS_KEY, parkingId, period] as const,
    queryFn: () => fetchParkingDashboardStats(period.from, period.to, parkingId!),
    enabled: Boolean(parkingId),
    staleTime: 30_000,
    refetchInterval: refetchIntervalWhenVisibleMs(60_000),
  });

  return { ...query, period };
}
