/**
 * Pure `properties.settings` readers for owner-default parking.
 * No Supabase imports, so they are safe to unit test.
 */

/** `properties.settings.preferredOwnerParkingId` — UUID of preferred org listing. */
export function readPreferredOwnerParkingId(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const raw = (settings as Record<string, unknown>).preferredOwnerParkingId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * `properties.settings.complimentaryOwnerParking` — skip PayMongo for same-org own pins.
 * Requires `allowParking` too: the toggle is inert while parking is off, even if a stale
 * saved value is still `true`.
 */
export function readComplimentaryOwnerParking(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const record = settings as Record<string, unknown>;
  return record.allowParking === true && record.complimentaryOwnerParking === true;
}
