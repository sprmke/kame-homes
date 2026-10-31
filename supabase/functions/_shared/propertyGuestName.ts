/**
 * Guest-facing property label — Basic Information "Property Name" (`properties.name`).
 * Never substitutes tower + unit (unit identity is separate).
 */

export const PROPERTY_GUEST_NAME_FALLBACK = 'this property';

type PropertyGuestNameSource = {
  name?: string | null;
};

/**
 * Spoken / guest-facing name for AI voice (preview + Live session intro).
 * Optional override (e.g. unsaved settings draft) wins over the DB column.
 */
export function resolvePropertyGuestName(
  property: PropertyGuestNameSource,
  overrideName?: string | null
): string {
  const override = String(overrideName ?? '').trim();
  if (override.length >= 2) return override.slice(0, 120);

  const name = String(property.name ?? '').trim();
  return name || PROPERTY_GUEST_NAME_FALLBACK;
}
