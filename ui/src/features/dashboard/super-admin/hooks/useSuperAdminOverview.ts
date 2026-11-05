import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SuperAdminOverviewRange = '30d' | '90d' | '12mo';

export type SuperAdminOverviewGrowthPoint = {
  label: string;
  month: string;
  newOrgs: number;
  newSubscriptions: number;
  cumulativeOrgs: number;
  cumulativeSubscriptions: number;
};

export type SuperAdminOverview = {
  range: SuperAdminOverviewRange;
  generatedAt: string;
  kpis: {
    organizations: number;
    hosts: number;
    properties: number;
    parkings: number;
    developments: number;
    liveSubscriptions: number;
    trialingSubscriptions: number;
    mrrPhp: number;
    openTickets: number;
    pendingApprovals: number;
    undisbursedParkingPayouts: number;
    aiSpendUsd: number;
  };
  growthSeries: SuperAdminOverviewGrowthPoint[];
  planMix: { code: string; label: string; count: number }[];
  aiCostByFeature: { feature: string; costUsd: number }[];
  attention: {
    pendingApprovals: number;
    pendingApprovalsBreakdown: {
      orgVerification: number;
      listingVerification: number;
      externalReview: number;
    };
    openTickets: number;
    undisbursedParkingPayouts: number;
    unassignedSubscriptions: number;
  };
  recent: {
    organizations: { id: string; name: string; slug: string; createdAt: string }[];
    subscriptions: {
      planLabel: string;
      status: string;
      createdAt: string;
      pricePhp: number;
    }[];
    tickets: {
      id: string;
      subject: string;
      submittedByName: string;
      status: string;
      createdAt: string;
    }[];
  };
};

export function useSuperAdminOverview(range: SuperAdminOverviewRange) {
  return useQuery({
    queryKey: ['super-admin', 'overview', range],
    queryFn: () => callEdgeFunction<SuperAdminOverview>(`super-admin-overview?range=${range}`),
    staleTime: 60_000,
  });
}
