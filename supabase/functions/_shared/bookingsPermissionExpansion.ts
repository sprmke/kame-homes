/**
 * Phase 3 — expand retired bookings/import umbrella ids to leaf ids.
 * Keep until every stored row is remapped (migration + normalizePermissionIds).
 */

/** Old id → leaf ids (access-preserving). */
export const BOOKINGS_PHASE3_EXPANSION: Record<string, readonly string[]> = {
  'bookings:edit': [
    'bookings.create:add',
    'bookings.detail.stay:edit',
    'bookings.detail.guests:edit',
    'bookings.detail.parking:edit',
    'bookings.detail.pets:edit',
    'bookings.detail.pricing:edit',
  ],
  'bookings:workflow': ['bookings.detail.workflow:edit'],
  'import:manage': ['bookings.import:add'],
};

export const BOOKINGS_PHASE3_LEAF_IDS = [
  'bookings.create:add',
  'bookings.import:add',
  'bookings.detail.stay:edit',
  'bookings.detail.guests:edit',
  'bookings.detail.parking:edit',
  'bookings.detail.pets:edit',
  'bookings.detail.pricing:edit',
  'bookings.detail.workflow:edit',
] as const;

export function expandBookingsPhase3PermissionIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id) continue;
    const expansion = BOOKINGS_PHASE3_EXPANSION[id];
    const next = expansion ?? [id];
    for (const leaf of next) {
      if (seen.has(leaf)) continue;
      seen.add(leaf);
      out.push(leaf);
    }
  }
  return out;
}
