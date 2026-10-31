/**
 * Parking broadcast — price ranking, guest-rate-cap exclusion, and multi-spot host dedupe.
 * Mirrors `parkingBroadcast.ts` conventions; kept as a sibling file per the match-engine
 * ticket's own instruction rather than growing that file further.
 */

import { createServiceClient } from './orgAuth.ts';
import type { ParkingBroadcastCandidate } from './parkingBroadcast.ts';
import { loadParkingPricing } from './parkingPricing.ts';
import { resolveParkingPlatformSettings } from './parkingPlatformSettings.ts';

/** D15 (locked): fixed batch size, not admin-configurable in v1. */
export const PARKING_BATCH_SIZE = 3;

/** D15 (locked): fixed same-day turnover buffer, not admin-configurable in v1. */
export const PARKING_TURNOVER_BUFFER_MINUTES = 30;

function parseMmDdYyyyUtc(value: string): Date {
  const [mm, dd, yyyy] = value.split('-');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
}

function toIsoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Fri/Sat/Sun — mirrors ui/src/features/dashboard/pricing/lib/pricingCalendarUtils.ts#isWeekendRateDay. */
function isWeekendRateDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 5 || day === 6;
}

/** Each occupied night [checkIn, checkOut) as a UTC midnight Date, walked one day at a time. */
function nightsInRange(checkInMmDdYyyy: string, checkOutMmDdYyyy: string): Date[] {
  const start = parseMmDdYyyyUtc(checkInMmDdYyyy);
  const end = parseMmDdYyyyUtc(checkOutMmDdYyyy);
  const nights: Date[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

/** Average nightly host_gross for the request's stay (weekday/weekend mix + date overrides). */
export async function computeParkingHostGross(
  parkingId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<number> {
  const pricing = await loadParkingPricing(parkingId);
  const nights = nightsInRange(checkInDate, checkOutDate);
  if (nights.length === 0) return pricing.weekdayNightlyRate;

  const total = nights.reduce((sum, night) => {
    const override = pricing.dateOverrides[toIsoDateKey(night)];
    if (override !== undefined) return sum + override;
    return (
      sum + (isWeekendRateDay(night) ? pricing.weekendNightlyRate : pricing.weekdayNightlyRate)
    );
  }, 0);

  return total / nights.length;
}

/** D5/D2: excluded from the pool entirely (not just ranked last) if priced above the guest rate cap. */
export function isPriceCappedOut(
  hostGross: number,
  checkInDate: string,
  checkOutDate: string,
  guestRates: { weekday: number; weekend: number }
): boolean {
  const nights = nightsInRange(checkInDate, checkOutDate);
  if (nights.length === 0) return hostGross > guestRates.weekday;
  return nights.some((night) => {
    const cap = isWeekendRateDay(night) ? guestRates.weekend : guestRates.weekday;
    return hostGross > cap;
  });
}

/**
 * Dedupe key for "a host with multiple parking spots is only offered once" (decision #6):
 * the earliest active parking_members row with edit access for this parking (same predicate
 * `resolveParkingHostRecipients` uses), else the org owner. Two candidates sharing a key
 * collapse to the cheaper one in `rankAndDedupeParkingCandidates`.
 */
export async function resolvePrimaryHostKey(
  candidate: Pick<ParkingBroadcastCandidate, 'id' | 'organization_id'>
): Promise<string> {
  const supabase = createServiceClient();

  const { data: members } = await supabase
    .from('parking_members')
    .select('user_id, role_id, permissions, created_at')
    .eq('parking_id', candidate.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  for (const row of members ?? []) {
    const permissions = Array.isArray(row.permissions) ? (row.permissions as string[]) : [];
    if (row.role_id === 'STAFF' || permissions.includes('bookings:edit')) {
      return `member:${String(row.user_id)}`;
    }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', candidate.organization_id)
    .maybeSingle();

  return `owner:${String(org?.owner_id ?? candidate.organization_id)}`;
}

export type RankedParkingCandidate = {
  candidate: ParkingBroadcastCandidate;
  hostGross: number;
};

/**
 * Price-ranks conflict-safe candidates ascending by host_gross, drops any priced above the
 * guest rate cap, and collapses multi-spot hosts to their cheapest eligible spot. Tie-break:
 * ascending `parkings.created_at` (earliest-listed spot wins) — documented per the ticket's
 * "pick one" ask, not left to insertion order.
 */
export async function rankAndDedupeParkingCandidates(
  candidates: ParkingBroadcastCandidate[],
  checkInDate: string,
  checkOutDate: string
): Promise<RankedParkingCandidate[]> {
  const [priced, platformSettings] = await Promise.all([
    Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        hostGross: await computeParkingHostGross(candidate.id, checkInDate, checkOutDate),
      }))
    ),
    resolveParkingPlatformSettings(),
  ]);
  const guestRates = {
    weekday: platformSettings.guestRateWeekday,
    weekend: platformSettings.guestRateWeekend,
  };

  const withinCap = priced.filter(
    ({ hostGross }) => !isPriceCappedOut(hostGross, checkInDate, checkOutDate, guestRates)
  );

  const hostKeys = await Promise.all(
    withinCap.map(({ candidate }) => resolvePrimaryHostKey(candidate))
  );

  const bestPerHost = new Map<string, RankedParkingCandidate>();
  withinCap.forEach((entry, index) => {
    const hostKey = hostKeys[index];
    const existing = bestPerHost.get(hostKey);
    if (
      !existing ||
      entry.hostGross < existing.hostGross ||
      (entry.hostGross === existing.hostGross &&
        entry.candidate.created_at < existing.candidate.created_at)
    ) {
      bestPerHost.set(hostKey, entry);
    }
  });

  return [...bestPerHost.values()].sort((a, b) => {
    if (a.hostGross !== b.hostGross) return a.hostGross - b.hostGross;
    return a.candidate.created_at < b.candidate.created_at ? -1 : 1;
  });
}
