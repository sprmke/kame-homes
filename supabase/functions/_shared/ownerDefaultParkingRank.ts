/**
 * Pure ranking / date helpers for owner-default parking (no Supabase imports).
 */

export type OwnerDefaultParkingSlot = {
  id: string;
  slug: string;
  name: string;
  residenceName: string | null;
  createdAt: string | null;
};

export function ownerDefaultDateToYmd(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const [mm, dd, yyyy] = trimmed.split('-');
  if (!mm || !dd || !yyyy) return '';
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Rank available own slots. Preferred listing id (property setting) wins when still
 * available; else residence match, then earliest created_at, then name.
 */
export function rankOwnerDefaultParkingSlots(
  slots: OwnerDefaultParkingSlot[],
  propertyResidenceName: string | null,
  preferredParkingId?: string | null
): OwnerDefaultParkingSlot[] {
  const preferred = (preferredParkingId ?? '').trim();
  const residence = (propertyResidenceName ?? '').trim().toLowerCase();
  return [...slots].sort((a, b) => {
    if (preferred) {
      const aPref = a.id === preferred ? 0 : 1;
      const bPref = b.id === preferred ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
    }
    if (residence) {
      const aMatch = (a.residenceName ?? '').trim().toLowerCase() === residence ? 0 : 1;
      const bMatch = (b.residenceName ?? '').trim().toLowerCase() === residence ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    const aCreated = a.createdAt ?? '';
    const bCreated = b.createdAt ?? '';
    if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
    return a.name.localeCompare(b.name);
  });
}
