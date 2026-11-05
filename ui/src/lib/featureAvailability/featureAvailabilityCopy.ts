import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import {
  FEATURE_AVAILABILITY_REASON_COPY,
  getFeatureAvailabilityCatalogEntry,
  type FeatureAvailabilityKey,
  type FeatureAvailabilityReason,
  type FeatureAvailabilityReasonIcon,
} from '@/lib/featureAvailability/featureAvailabilityCatalog';

dayjs.extend(utc);
dayjs.extend(timezone);

const MANILA = 'Asia/Manila';

export type FeatureAvailabilityTone = 'amber' | 'neutral';

export function featureAvailabilityToneForReason(
  reason: FeatureAvailabilityReason | null
): FeatureAvailabilityTone {
  if (!reason) return 'neutral';
  if (reason === 'maintenance' || reason === 'provider_issue' || reason === 'paused') {
    return 'amber';
  }
  return 'neutral';
}

export function resolveFeatureAvailabilityMessage(options: {
  reason: FeatureAvailabilityReason | null;
  customMessage: string | null;
  sourceKey: FeatureAvailabilityKey | null;
}): string {
  if (options.customMessage?.trim()) return options.customMessage.trim();
  if (!options.reason) return 'This feature is temporarily unavailable.';
  const copy = FEATURE_AVAILABILITY_REASON_COPY[options.reason];
  const provider = options.sourceKey
    ? getFeatureAvailabilityCatalogEntry(options.sourceKey)?.provider
    : undefined;
  const template = copy.defaultMessage ?? 'This feature is temporarily unavailable.';
  return provider ? template.replace('{provider}', provider) : template;
}

export function featureAvailabilityReasonLabel(reason: FeatureAvailabilityReason | null): string {
  if (!reason) return 'Unavailable';
  return FEATURE_AVAILABILITY_REASON_COPY[reason].label;
}

export function featureAvailabilityReasonIcon(
  reason: FeatureAvailabilityReason | null
): FeatureAvailabilityReasonIcon {
  if (!reason) return 'Info';
  return FEATURE_AVAILABILITY_REASON_COPY[reason].icon;
}

/**
 * Expected-back line for host copy. Uses `serverSkewMs` so a wrong device clock
 * does not show a past time as "Back by …".
 */
export function formatFeatureExpectedBackLabel(options: {
  expectedBackAt: string | null;
  serverSkewMs: number;
  /** When true, the blocking row had auto_restore and the time passed (feature is available again). */
  restoredAutomatically?: boolean;
}): string | null {
  const { expectedBackAt, serverSkewMs, restoredAutomatically } = options;
  if (!expectedBackAt || restoredAutomatically) return null;

  const effectiveNowMs = Date.now() + serverSkewMs;
  const backMs = new Date(expectedBackAt).getTime();
  if (Number.isNaN(backMs)) return null;

  if (backMs <= effectiveNowMs) {
    return 'Taking longer than expected';
  }

  const back = dayjs(expectedBackAt).tz(MANILA);
  const nowManila = dayjs(effectiveNowMs).tz(MANILA);
  const sameDay = back.format('YYYY-MM-DD') === nowManila.format('YYYY-MM-DD');
  const timePart = back.format('h:mm A');
  if (sameDay) return `Back by ${timePart}`;
  return `Back by ${back.format('MMM D')}, ${timePart}`;
}
