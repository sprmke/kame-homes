import type { SupabaseClient } from './supabaseJs.ts';

export const DUPLICATE_PROPERTY_NAME_MESSAGE = 'A property with this name already exists';

export function normalizePropertyNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Global property display-name check (slugs are globally unique on public `/properties/:slug`). */
export async function findPropertyNameConflict(
  supabase: SupabaseClient,
  name: string,
  excludePropertyId?: string
): Promise<{ id: string; name: string } | null> {
  const key = normalizePropertyNameKey(name);
  if (!key) return null;

  const { data, error } = await supabase.from('properties').select('id, name');

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (excludePropertyId && row.id === excludePropertyId) continue;
    if (normalizePropertyNameKey(String(row.name ?? '')) === key) {
      return { id: row.id as string, name: row.name as string };
    }
  }

  return null;
}
