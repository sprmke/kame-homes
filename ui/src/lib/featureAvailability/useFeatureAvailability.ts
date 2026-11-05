import { useQuery, type QueryClient } from '@tanstack/react-query';

import {
  fetchFeatureAvailability,
  type FeatureAvailabilityPublicEntry,
  type FeatureAvailabilitySnapshot,
} from '@/lib/featureAvailability/featureAvailabilityApi';
import {
  featureAvailabilityReasonLabel,
  featureAvailabilityToneForReason,
  formatFeatureExpectedBackLabel,
  resolveFeatureAvailabilityMessage,
  type FeatureAvailabilityTone,
} from '@/lib/featureAvailability/featureAvailabilityCopy';
import {
  getFeatureAvailabilityCatalogEntry,
  isFeatureAvailabilityReason,
  type FeatureAvailabilityKey,
  type FeatureAvailabilityReason,
} from '@/lib/featureAvailability/featureAvailabilityCatalog';

export const FEATURE_AVAILABILITY_QUERY_KEY = ['feature-availability'] as const;

function entriesByKey(
  entries: FeatureAvailabilityPublicEntry[]
): Map<FeatureAvailabilityKey, FeatureAvailabilityPublicEntry> {
  const map = new Map<FeatureAvailabilityKey, FeatureAvailabilityPublicEntry>();
  for (const entry of entries) {
    if (getFeatureAvailabilityCatalogEntry(entry.key)) {
      map.set(entry.key, entry);
    }
  }
  return map;
}

export function useFeatureAvailabilitySnapshot() {
  return useQuery({
    queryKey: FEATURE_AVAILABILITY_QUERY_KEY,
    queryFn: fetchFeatureAvailability,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });
}

export type FeatureAvailabilityView = {
  available: boolean;
  bypassed: boolean;
  reason: FeatureAvailabilityReason | null;
  label: string;
  message: string;
  expectedBackLabel: string | null;
  source: 'self' | 'parent' | null;
  tone: FeatureAvailabilityTone;
  showBanner: boolean;
  updatedAt: string | null;
  isLoading: boolean;
  isFetching: boolean;
};

function buildView(
  key: FeatureAvailabilityKey,
  snapshot: FeatureAvailabilitySnapshot | undefined,
  isLoading: boolean,
  isFetching: boolean
): FeatureAvailabilityView {
  const failOpen: FeatureAvailabilityView = {
    available: true,
    bypassed: false,
    reason: null,
    label: getFeatureAvailabilityCatalogEntry(key)?.label ?? key,
    message: '',
    expectedBackLabel: null,
    source: null,
    tone: 'neutral',
    showBanner: false,
    updatedAt: null,
    isLoading,
    isFetching,
  };

  if (isLoading && !snapshot) {
    return failOpen;
  }

  if (!snapshot) {
    return failOpen;
  }

  const entry = entriesByKey(snapshot.entries).get(key);
  if (!entry) {
    return { ...failOpen, isLoading, isFetching };
  }

  const reason = entry.reason && isFeatureAvailabilityReason(entry.reason) ? entry.reason : null;
  const sourceKey =
    entry.source === 'parent' ? (getFeatureAvailabilityCatalogEntry(key)?.parent ?? key) : key;
  const message = entry.message?.trim()
    ? entry.message.trim()
    : resolveFeatureAvailabilityMessage({
        reason,
        customMessage: null,
        sourceKey,
      });

  const expectedBackLabel = formatFeatureExpectedBackLabel({
    expectedBackAt: entry.expectedBackAt,
    serverSkewMs: snapshot.serverSkewMs,
  });

  return {
    available: entry.available,
    bypassed: entry.bypassed,
    reason,
    label: featureAvailabilityReasonLabel(reason),
    message,
    expectedBackLabel,
    source: entry.source,
    tone: featureAvailabilityToneForReason(reason),
    showBanner: entry.showBanner,
    updatedAt: entry.updatedAt,
    isLoading,
    isFetching,
  };
}

export function useFeatureAvailability(key: FeatureAvailabilityKey): FeatureAvailabilityView {
  const query = useFeatureAvailabilitySnapshot();
  const isInitialLoading = query.isLoading && !query.data;
  return buildView(key, query.data, isInitialLoading, query.isFetching);
}

export function selectFeatureAvailabilityEntry(
  snapshot: FeatureAvailabilitySnapshot | undefined,
  key: FeatureAvailabilityKey
): FeatureAvailabilityView {
  return buildView(key, snapshot, false, false);
}

export function invalidateFeatureAvailability(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: FEATURE_AVAILABILITY_QUERY_KEY });
}
