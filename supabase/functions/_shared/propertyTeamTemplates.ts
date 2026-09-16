/**
 * Property team permission templates — seeded presets (Full Access / Operations / Read Only).
 * Mirrors ui/.../propertyTeamConstants.ts SEEDED_TEMPLATE_* exports.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import {
  normalizePermissionIds,
  type TeamPermissionId,
  TEAM_PERMISSION_IDS,
} from './propertyTeamPermissions.ts';

export const SEEDED_PROPERTY_TEMPLATE_NAMES = {
  FULL_ACCESS: 'Full Access',
  OPERATIONS: 'Operations',
  READ_ONLY: 'Read Only',
} as const;

export type SeededPropertyTemplateKey = keyof typeof SEEDED_PROPERTY_TEMPLATE_NAMES;

/** Coarse-catalog grants expanded for Phase 3–6 leaves. */
export const SEEDED_TEMPLATE_PERMISSIONS: Record<SeededPropertyTemplateKey, TeamPermissionId[]> = {
  FULL_ACCESS: [...TEAM_PERMISSION_IDS],
  OPERATIONS: [
    'bookings:view',
    'bookings.create:add',
    'bookings.detail.stay:edit',
    'bookings.detail.guests:edit',
    'bookings.detail.parking:edit',
    'bookings.detail.pets:edit',
    'bookings.detail.pricing:edit',
    'bookings.detail.workflow:edit',
    'maintenance:view',
    'maintenance.reminders:add',
    'maintenance.reminders:edit',
    'maintenance.reminders:delete',
    'maintenance.export:view',
    'notifications:view',
    'templates:view',
    'publicPages:view',
    'pricing:view',
    'pricing.channels:view',
    'pricing.channels:edit',
    'inbox:view',
    'inbox.messages:edit',
    'marketing:view',
    'marketing.content:add',
    'marketing.content:edit',
    'marketing.templates:add',
    'marketing.templates:edit',
    'marketing.templates:delete',
    'marketing.generate:add',
    'marketing.publish:add',
  ],
  READ_ONLY: [
    'bookings:view',
    'maintenance:view',
    'notifications:view',
    'templates:view',
    'publicPages:view',
    'pricing:view',
    'pricing.channels:view',
    'team:view',
    'inbox:view',
  ],
};

export const SEEDED_TEMPLATE_ENTRIES = (
  Object.entries(SEEDED_PROPERTY_TEMPLATE_NAMES) as [SeededPropertyTemplateKey, string][]
).map(([key, name]) => ({
  key,
  name,
  permissions: SEEDED_TEMPLATE_PERMISSIONS[key],
}));

/** Legacy STAFF preset — used by migration dry-run to compute access-preserving effective sets. */
export const LEGACY_STAFF_PRESET_PERMISSIONS = SEEDED_TEMPLATE_PERMISSIONS.OPERATIONS;

export function capLegacyStaffPermissions(permissions: readonly string[]): TeamPermissionId[] {
  const allowed = new Set<string>(LEGACY_STAFF_PRESET_PERMISSIONS);
  return normalizePermissionIds(permissions.filter((id) => allowed.has(id)));
}

export function isSeededTemplateName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return SEEDED_TEMPLATE_ENTRIES.some((entry) => entry.name.toLowerCase() === normalized);
}

/** Idempotent — skips names that already exist on the property (case-insensitive). */
export async function seedPropertyTeamTemplates(
  supabase: SupabaseClient,
  propertyId: string
): Promise<void> {
  const { data: existing, error: listError } = await supabase
    .from('property_custom_roles')
    .select('name')
    .eq('property_id', propertyId);

  if (listError) {
    throw new Error(`Failed to list property templates: ${listError.message}`);
  }

  const existingNames = new Set(
    (existing ?? []).map((row) => (row.name as string).trim().toLowerCase())
  );

  const toInsert = SEEDED_TEMPLATE_ENTRIES.filter(
    (entry) => !existingNames.has(entry.name.toLowerCase())
  );

  if (toInsert.length === 0) return;

  const { error: insertError } = await supabase.from('property_custom_roles').insert(
    toInsert.map((entry) => ({
      property_id: propertyId,
      name: entry.name,
      permissions: entry.permissions,
    }))
  );

  if (insertError) {
    throw new Error(`Failed to seed property team templates: ${insertError.message}`);
  }
}

export async function findSeededTemplateId(
  supabase: SupabaseClient,
  propertyId: string,
  key: SeededPropertyTemplateKey
): Promise<string | null> {
  const targetName = SEEDED_PROPERTY_TEMPLATE_NAMES[key];
  const { data, error } = await supabase
    .from('property_custom_roles')
    .select('id, name')
    .eq('property_id', propertyId);

  if (error) {
    throw new Error(`Failed to load property templates: ${error.message}`);
  }

  const match = (data ?? []).find(
    (row) => (row.name as string).trim().toLowerCase() === targetName.toLowerCase()
  );
  return (match?.id as string | undefined) ?? null;
}
