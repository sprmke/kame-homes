import { useMemo } from 'react';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { rejectedExternalReviewCount } from '@/features/dashboard/org/lib/propertyExternalReviews';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { DashboardAttentionItem } from '@/features/dashboard/property/lib/types';

export function usePropertyRejectedExternalReviewsAttentionItem(): DashboardAttentionItem | null {
  const { orgSlug, propertySlug } = useOrgContext();
  const { data: settings, isLoading } = useAppSettings();

  return useMemo(() => {
    if (isLoading) return null;

    const rejectedCount = rejectedExternalReviewCount(settings?.externalReviews ?? []);
    if (rejectedCount === 0) return null;

    return {
      id: 'external-review-rejected',
      label: rejectedCount === 1 ? 'Review rejected' : 'Reviews rejected',
      count: rejectedCount > 1 ? rejectedCount : undefined,
      href: propertySectionPath(orgSlug, propertySlug, 'settings'),
      severity: 'warning',
    };
  }, [isLoading, settings?.externalReviews, orgSlug, propertySlug]);
}
