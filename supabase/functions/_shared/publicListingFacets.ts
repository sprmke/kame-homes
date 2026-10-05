/**
 * Batch facet/aggregate helpers for public list-public-* endpoints.
 * Never call ensurePropertySettings / loadPropertyPricing in a loop — those upsert.
 * Batch reads fail closed: a DB error throws rather than returning default prices or
 * zeroed ratings that would silently mis-sort and mis-filter public listings.
 */

import { createServiceClient } from './orgAuth.ts';
import { AMENITY_LABELS } from './publicPropertyAmenities.ts';
import { loadRowsByKeyChunks } from './publicListingRows.ts';
import { postgrestOrIlikeExactValue } from './publicSearch.ts';

/** Same default as propertyPricing.ts DEFAULT_WEEKDAY — keep in sync. */
export const DEFAULT_LISTING_WEEKDAY_RATE = 2799;

/** Same default as parkingPricing.ts DEFAULT_PARKING_WEEKDAY — keep in sync. */
export const DEFAULT_PARKING_LISTING_WEEKDAY_RATE = 300;

function chunkIds<T>(ids: T[], size = 200): T[][] {
  if (ids.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

/** Single batched read of weekday rates — no ensurePropertySettings side effect. */
export async function batchLoadPropertyPricing(
  propertyIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (propertyIds.length === 0) return result;

  const supabase = createServiceClient();
  for (const chunk of chunkIds(propertyIds)) {
    const { data, error } = await supabase
      .from('app_settings')
      .select('property_id, weekday_nightly_rate')
      .in('property_id', chunk);
    if (error) {
      throw new Error(`pricing batch failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      const id = row.property_id as string | null;
      if (!id) continue;
      const rate =
        row.weekday_nightly_rate != null && Number.isFinite(Number(row.weekday_nightly_rate))
          ? Number(row.weekday_nightly_rate)
          : DEFAULT_LISTING_WEEKDAY_RATE;
      result.set(id, rate);
    }
  }

  for (const id of propertyIds) {
    if (!result.has(id)) result.set(id, DEFAULT_LISTING_WEEKDAY_RATE);
  }
  return result;
}

/** Single batched read of weekday rates — no ensureParkingSettings side effect. */
export async function batchLoadParkingPricing(parkingIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (parkingIds.length === 0) return result;

  const supabase = createServiceClient();
  for (const chunk of chunkIds(parkingIds)) {
    const { data, error } = await supabase
      .from('parking_settings')
      .select('parking_id, weekday_nightly_rate')
      .in('parking_id', chunk);
    if (error) {
      throw new Error(`parking pricing batch failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      const id = row.parking_id as string | null;
      if (!id) continue;
      const rate =
        row.weekday_nightly_rate != null && Number.isFinite(Number(row.weekday_nightly_rate))
          ? Number(row.weekday_nightly_rate)
          : DEFAULT_PARKING_LISTING_WEEKDAY_RATE;
      result.set(id, rate);
    }
  }

  for (const id of parkingIds) {
    if (!result.has(id)) result.set(id, DEFAULT_PARKING_LISTING_WEEKDAY_RATE);
  }
  return result;
}

/**
 * ACTIVE property count per development name, keyed by lower-cased name.
 * Case-insensitive (matches how listings link `residence_name` to developments)
 * and paged so large developments are never truncated by `max_rows`.
 */
export async function batchCountActivePropertiesByResidence(
  names: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) return counts;

  const supabase = createServiceClient();
  const rows = await loadRowsByKeyChunks('property counts', unique, (chunk, from, to) =>
    supabase
      .from('properties')
      .select('id, residence_name')
      .eq('status', 'ACTIVE')
      .or(chunk.map((name) => `residence_name.ilike.${postgrestOrIlikeExactValue(name)}`).join(','))
      .order('id')
      .range(from, to)
  );
  for (const row of rows) {
    const key = (row.residence_name as string | null)?.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function amenityLabelForId(id: string): string {
  return AMENITY_LABELS[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function propertyTypeLabel(type: string): string {
  const normalized = type.trim().toLowerCase();
  const labels: Record<string, string> = {
    apartment: 'Apartment',
    condo: 'Condo',
    house: 'House',
    villa: 'Villa',
    townhouse: 'Townhouse',
    cabin: 'Cabin',
    resort: 'Resort',
    hotel: 'Hotel',
    other: 'Property',
  };
  return (
    labels[normalized] ??
    (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Property')
  );
}
