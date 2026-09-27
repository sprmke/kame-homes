import type { AnalyticsAiReviewRecord } from '@/features/dashboard/analytics/lib/aiReviewTypes';
import type {
  AnalyticsQuery,
  AnalyticsSummaryResponse,
  OrgAnalyticsSummary,
} from '@/features/dashboard/analytics/lib/types';
import { appendPropertyId } from '@/features/dashboard/org/lib/adminApiScope';

import { adminEdgeFetchJson } from '@/lib/api/adminEdgeFetch';

export async function fetchAnalyticsSummary(
  query: AnalyticsQuery,
  propertyId: string | null
): Promise<AnalyticsSummaryResponse> {
  const params = appendPropertyId(
    new URLSearchParams({ from: query.from, to: query.to }),
    propertyId
  );
  const json = await adminEdgeFetchJson<{ data: AnalyticsSummaryResponse }>(
    `/analytics-summary?${params.toString()}`,
    undefined,
    propertyId,
    'Failed to load analytics'
  );
  return json.data;
}

export async function fetchAnalyticsAiReview(
  propertyId: string | null
): Promise<AnalyticsAiReviewRecord | null> {
  const params = appendPropertyId(new URLSearchParams(), propertyId);
  const json = await adminEdgeFetchJson<{ data: { review: AnalyticsAiReviewRecord | null } }>(
    `/analytics-ai-review?${params.toString()}`,
    undefined,
    propertyId,
    'Failed to load the AI performance review'
  );
  return json.data.review;
}

export async function fetchOrgAnalyticsSummary(
  query: AnalyticsQuery,
  orgSlug: string
): Promise<OrgAnalyticsSummary> {
  const params = new URLSearchParams({ from: query.from, to: query.to, org_slug: orgSlug });
  const json = await adminEdgeFetchJson<{ data: OrgAnalyticsSummary }>(
    `/analytics-org-summary?${params.toString()}`,
    undefined,
    null,
    'Failed to load org analytics'
  );
  return json.data;
}

export async function regenerateAnalyticsAiReview(
  propertyId: string | null,
  period: { from: string; to: string }
): Promise<{ review: AnalyticsAiReviewRecord | null; available: boolean }> {
  const params = appendPropertyId(
    new URLSearchParams({ from: period.from, to: period.to }),
    propertyId
  );
  const json = await adminEdgeFetchJson<{
    data: { review: AnalyticsAiReviewRecord | null; available: boolean };
  }>(
    `/analytics-ai-review?${params.toString()}`,
    { method: 'POST' },
    propertyId,
    'Failed to regenerate the AI performance review'
  );
  return json.data;
}
