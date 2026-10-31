import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import {
  FEATURE_AVAILABILITY_CATALOG,
  type FeatureAvailabilityCatalogEntry,
  type FeatureAvailabilityKey,
  type FeatureAvailabilityModule,
} from '@/lib/featureAvailability/featureAvailabilityCatalog';
import type { ResolvedFeatureAvailability } from '@/lib/featureAvailability/resolveFeatureAvailability';

dayjs.extend(utc);
dayjs.extend(timezone);

const MANILA = 'Asia/Manila';

export const FEATURE_AVAILABILITY_MODULE_LABELS: Record<FeatureAvailabilityModule, string> = {
  inbox: 'Inbox',
  pricing: 'Pricing',
  marketing: 'Marketing',
  analytics: 'Analytics',
  notifications: 'Notifications',
};

export function countFeaturesOff(resolved: Record<string, ResolvedFeatureAvailability>): number {
  return Object.values(resolved).filter((row) => !row.available).length;
}

export function groupCatalogByModule(): Map<
  FeatureAvailabilityModule,
  FeatureAvailabilityCatalogEntry[]
> {
  const map = new Map<FeatureAvailabilityModule, FeatureAvailabilityCatalogEntry[]>();
  for (const entry of FEATURE_AVAILABILITY_CATALOG) {
    const list = map.get(entry.module) ?? [];
    list.push(entry);
    map.set(entry.module, list);
  }
  return map;
}

export function isoToManilaDateTimeParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const parsed = dayjs(iso).tz(MANILA);
  if (!parsed.isValid()) return { date: '', time: '' };
  return { date: parsed.format('YYYY-MM-DD'), time: parsed.format('HH:mm') };
}

export function manilaDateTimeToIso(date: string, time: string): string | null {
  if (!date.trim() || !time.trim()) return null;
  const parsed = dayjs.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', MANILA);
  if (!parsed.isValid()) return null;
  return parsed.toISOString();
}

export function isFutureIso(iso: string, now = new Date()): boolean {
  const ms = new Date(iso).getTime();
  return !Number.isNaN(ms) && ms > now.getTime();
}

export function catalogEntryDepth(key: FeatureAvailabilityKey): number {
  let depth = 0;
  let current = FEATURE_AVAILABILITY_CATALOG.find((entry) => entry.key === key);
  while (current?.parent) {
    depth += 1;
    current = FEATURE_AVAILABILITY_CATALOG.find((entry) => entry.key === current!.parent);
  }
  return depth;
}
