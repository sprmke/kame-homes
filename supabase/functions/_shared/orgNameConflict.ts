import type { SupabaseClient } from './supabaseJs.ts';

export const DUPLICATE_ORGANIZATION_NAME_MESSAGE = 'An organization with this name already exists';

export function normalizeOrganizationNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function findOrganizationNameConflict(
  supabase: SupabaseClient,
  name: string,
  excludeOrgId?: string
): Promise<{ id: string; name: string } | null> {
  const key = normalizeOrganizationNameKey(name);
  if (!key) return null;

  const { data, error } = await supabase.from('organizations').select('id, name');

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (excludeOrgId && row.id === excludeOrgId) continue;
    if (normalizeOrganizationNameKey(String(row.name ?? '')) === key) {
      return { id: row.id as string, name: row.name as string };
    }
  }

  return null;
}
