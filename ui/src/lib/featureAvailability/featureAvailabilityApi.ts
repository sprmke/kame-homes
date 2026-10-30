import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import type { FeatureAvailabilityKey } from '@/lib/featureAvailability/featureAvailabilityCatalog';

export type FeatureAvailabilityPublicEntry = {
  key: FeatureAvailabilityKey;
  available: boolean;
  bypassed: boolean;
  reason: string | null;
  message: string;
  expectedBackAt: string | null;
  source: 'self' | 'parent' | null;
  showBanner: boolean;
  updatedAt: string | null;
};

export type FeatureAvailabilitySnapshot = {
  serverNow: string;
  entries: FeatureAvailabilityPublicEntry[];
  /** Milliseconds to add to `Date.now()` for server-aligned comparisons. */
  serverSkewMs: number;
};

export async function fetchFeatureAvailability(): Promise<FeatureAvailabilitySnapshot> {
  const data = await callEdgeFunction<{
    serverNow: string;
    entries: FeatureAvailabilityPublicEntry[];
  }>('get-feature-availability');
  const serverNowMs = new Date(data.serverNow).getTime();
  const serverSkewMs = Number.isNaN(serverNowMs) ? 0 : serverNowMs - Date.now();
  return {
    serverNow: data.serverNow,
    entries: data.entries ?? [],
    serverSkewMs,
  };
}
