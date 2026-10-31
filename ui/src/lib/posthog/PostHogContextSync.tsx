import { useEffect } from 'react';

import { useParams } from 'react-router-dom';

import { setAnalyticsScope } from '@/lib/posthog/context';

/**
 * Mirrors route params into analytics scope so captureAppEvent can attach org/property ids.
 * Mount inside dashboard shells that know resolved UUIDs via parent context when available.
 */
export function PostHogContextSync(props: {
  orgId?: string | null;
  propertyId?: string | null;
  parkingId?: string | null;
  planTier?: 'free' | 'starter' | 'growth' | 'pro' | 'managed';
}) {
  const params = useParams();

  useEffect(() => {
    setAnalyticsScope({
      orgId: props.orgId ?? undefined,
      propertyId: props.propertyId ?? undefined,
      parkingId: props.parkingId ?? undefined,
      orgSlug: params.orgSlug,
      propertySlug: params.propertySlug,
      parkingSlug: params.parkingSlug,
      planTier: props.planTier,
    });
  }, [
    props.orgId,
    props.propertyId,
    props.parkingId,
    props.planTier,
    params.orgSlug,
    params.propertySlug,
    params.parkingSlug,
  ]);

  return null;
}
