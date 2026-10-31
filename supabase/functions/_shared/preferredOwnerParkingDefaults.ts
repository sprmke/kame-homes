/**
 * Keep `properties.settings.preferredOwnerParkingId` filled when an org has
 * ACTIVE parkings — default is the earliest-created listing.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { readPreferredOwnerParkingId } from './ownerDefaultParking.ts';

/** Earliest ACTIVE parking for the org, or null. */
export async function resolveFirstOrgParkingId(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('parkings')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`resolveFirstOrgParkingId: ${error.message}`);
  }
  const id = data?.[0]?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * For every property in the org with no preferred parking (or a preferred id
 * that is no longer an ACTIVE org parking), set preferred to the first listing.
 * Called after `create-parking` so new orgs/slots get a sensible default.
 */
export async function syncPreferredOwnerParkingDefaults(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ firstParkingId: string | null; updatedPropertyCount: number }> {
  const firstParkingId = await resolveFirstOrgParkingId(supabase, organizationId);
  if (!firstParkingId) {
    return { firstParkingId: null, updatedPropertyCount: 0 };
  }

  const { data: activeParkings, error: activeError } = await supabase
    .from('parkings')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE');

  if (activeError) {
    throw new Error(`syncPreferredOwnerParkingDefaults: ${activeError.message}`);
  }

  const activeIds = new Set((activeParkings ?? []).map((row) => String(row.id)));

  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('id, settings')
    .eq('organization_id', organizationId);

  if (propsError) {
    throw new Error(`syncPreferredOwnerParkingDefaults: ${propsError.message}`);
  }

  let updatedPropertyCount = 0;
  for (const prop of properties ?? []) {
    const current = readPreferredOwnerParkingId(prop.settings);
    if (current && activeIds.has(current)) continue;

    const prev =
      prop.settings && typeof prop.settings === 'object' && !Array.isArray(prop.settings)
        ? (prop.settings as Record<string, unknown>)
        : {};
    const nextSettings = { ...prev, preferredOwnerParkingId: firstParkingId };
    const { error: updateError } = await supabase
      .from('properties')
      .update({ settings: nextSettings })
      .eq('id', prop.id);

    if (updateError) {
      throw new Error(`syncPreferredOwnerParkingDefaults: ${updateError.message}`);
    }
    updatedPropertyCount += 1;
  }

  return { firstParkingId, updatedPropertyCount };
}
