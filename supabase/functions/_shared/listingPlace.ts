/**
 * Place / city grouping for public location rows.
 * Keep in sync with ui/.../groupPropertiesByLocation.ts and locationSlug.ts.
 */

export function asSettings(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

export function readSettingsString(settings: unknown, key: string): string {
  const value = asSettings(settings)[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Strip trailing " City" for city-based families (developments / parkings). */
export function normalizeCityPlace(value: unknown): string {
  const place = typeof value === 'string' ? value.trim() : '';
  return place.replace(/\s+City$/i, '').trim() || 'Other';
}

/**
 * Derive a place label from a property location string for grouping.
 * Examples: "Tagaytay, Cavite" → "Tagaytay"; "Makati City, Metro Manila" → "Makati";
 * "Bonifacio Global City, Taguig" → "Taguig".
 */
export function placeLabelFromPropertyLocation(location: string): string {
  const parts = location
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'Other';

  const primary = parts[0] ?? 'Other';
  const secondary = parts[1];

  if (secondary && /bonifacio|fort bonifacio|\bbgc\b/i.test(primary)) {
    return secondary.replace(/\s+City$/i, '').trim() || secondary;
  }

  return primary.replace(/\s+City$/i, '').trim() || primary;
}

/** Build the same location label guests see on property cards. */
export function buildPropertyLocationLabel(
  city: string | null | undefined,
  residenceName: string | null | undefined,
  settings?: unknown
): string {
  const settingsCity = readSettingsString(settings, 'city');
  const resolvedCity = (city ?? '').trim() || settingsCity || null;
  const residence = (residenceName ?? '').trim() || null;
  const parts = [resolvedCity, residence].filter((part) => Boolean(part && String(part).trim()));
  return parts.length > 0 ? parts.join(', ') : 'Philippines';
}

export function propertyPlaceLabel(row: {
  city?: string | null;
  residence_name?: string | null;
  settings?: unknown;
}): string {
  return placeLabelFromPropertyLocation(
    buildPropertyLocationLabel(row.city, row.residence_name, row.settings)
  );
}

export function toLocationSlug(place: string): string {
  return (
    place
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'other'
  );
}
