/**
 * Shared DB helpers for propertySettingsClone groups.
 */

import { createServiceClient } from './orgAuth.ts';
import { invalidateAppSettingsCache } from './appSettings.ts';

export async function loadPropertyRow(propertyId: string): Promise<{
  id: string;
  organization_id: string;
  residence_name: string | null;
  tower: string | null;
  unit_number: string | null;
  max_guests: number | null;
  settings: Record<string, unknown>;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('id, organization_id, residence_name, tower, unit_number, max_guests, settings')
    .eq('id', propertyId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? 'Property not found');
  }
  const settings =
    data.settings && typeof data.settings === 'object'
      ? (data.settings as Record<string, unknown>)
      : {};
  return {
    id: data.id as string,
    organization_id: data.organization_id as string,
    residence_name: (data.residence_name as string | null) ?? null,
    tower: (data.tower as string | null) ?? null,
    unit_number: (data.unit_number as string | null) ?? null,
    max_guests: (data.max_guests as number | null) ?? null,
    settings,
  };
}

export async function patchPropertySettings(
  propertyId: string,
  settingsPatch: Record<string, unknown>,
  columnPatch?: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  const row = await loadPropertyRow(propertyId);
  const nextSettings = { ...row.settings, ...settingsPatch };
  const update: Record<string, unknown> = {
    settings: nextSettings,
    ...(columnPatch ?? {}),
  };
  const { error } = await supabase.from('properties').update(update).eq('id', propertyId);
  if (error) throw new Error(`Failed to update property settings: ${error.message}`);
}

export async function patchAppSettingsColumns(
  propertyId: string,
  columns: Record<string, unknown>
): Promise<void> {
  if (Object.keys(columns).length === 0) return;
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('app_settings')
    .update({ ...columns, updated_at: new Date().toISOString() })
    .eq('property_id', propertyId);
  if (error) throw new Error(`Failed to update app_settings: ${error.message}`);
  invalidateAppSettingsCache(propertyId);
}

export async function loadAppSettingsColumns(
  propertyId: string,
  columns: string[]
): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select(columns.join(','))
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load app_settings: ${error.message}`);
  return (data as Record<string, unknown> | null) ?? {};
}

/** Denylist copy: select *, drop denied keys, update remaining onto target row. */
export async function denylistCopyTableRow(args: {
  table: string;
  sourcePropertyId: string;
  targetPropertyId: string;
  denyKeys: readonly string[];
  includeCredentialKeys?: boolean;
  credentialKeys?: readonly string[];
}): Promise<Record<string, unknown> | null> {
  const {
    table,
    sourcePropertyId,
    targetPropertyId,
    denyKeys,
    includeCredentialKeys = false,
    credentialKeys = [],
  } = args;
  const supabase = createServiceClient();
  const { data: source, error: readError } = await supabase
    .from(table)
    .select('*')
    .eq('property_id', sourcePropertyId)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read ${table}: ${readError.message}`);
  if (!source) return null;

  const deny = new Set<string>(denyKeys);
  if (!includeCredentialKeys) {
    for (const key of credentialKeys) deny.add(key);
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (deny.has(key)) continue;
    patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return patch;

  const { error: writeError } = await supabase
    .from(table)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('property_id', targetPropertyId);
  if (writeError) throw new Error(`Failed to write ${table}: ${writeError.message}`);
  return patch;
}

export function pickKeys(
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

export function settingsHasAny(
  settings: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  return keys.some((key) => {
    const value = settings[key];
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'number') return true;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });
}
