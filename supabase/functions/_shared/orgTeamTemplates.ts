/** Seeded org hub template names — server mirror of ui/.../orgTeamTemplates.ts */

import type { SupabaseClient } from './supabaseJs.ts';

import { ORG_PERMISSION_IDS, type OrgPermissionId } from './orgTeamPermissions.ts';

export const SEEDED_ORG_TEMPLATE_NAMES = {
  FULL_ACCESS: 'Full Access',
  OPERATIONS: 'Operations',
  READ_ONLY: 'Read Only',
} as const;

export type SeededOrgTemplateKey = keyof typeof SEEDED_ORG_TEMPLATE_NAMES;

export type SeededOrgTemplateName =
  (typeof SEEDED_ORG_TEMPLATE_NAMES)[keyof typeof SEEDED_ORG_TEMPLATE_NAMES];

export const SEEDED_ORG_TEMPLATE_NAME_SET = new Set<string>(
  Object.values(SEEDED_ORG_TEMPLATE_NAMES).map((name) => name.toLowerCase())
);

/** Default org hub grants per seeded template — keep in sync with org team migration seeds. */
export const SEEDED_ORG_TEMPLATE_PERMISSIONS: Record<SeededOrgTemplateKey, OrgPermissionId[]> = {
  FULL_ACCESS: [...ORG_PERMISSION_IDS],
  OPERATIONS: [
    'org.dashboard:view',
    'org.bookings:view',
    'org.properties:view',
    'org.properties:manage',
    'org.parkings:view',
    'org.parkings:manage',
    'org.team:view',
    'org.team.invitations:add',
    'org.team.invitations:edit',
    'org.team.invitations:delete',
    'org.team.members:edit',
    'org.team.members:delete',
  ],
  READ_ONLY: [
    'org.dashboard:view',
    'org.bookings:view',
    'org.properties:view',
    'org.parkings:view',
    'org.team:view',
    'org.plans:view',
  ],
};

export const SEEDED_ORG_TEMPLATE_ENTRIES = (
  Object.entries(SEEDED_ORG_TEMPLATE_NAMES) as [SeededOrgTemplateKey, string][]
).map(([key, name]) => ({
  key,
  name,
  permissions: SEEDED_ORG_TEMPLATE_PERMISSIONS[key],
  allListings: key === 'FULL_ACCESS',
}));

export function isSeededOrgTemplateName(name: string): boolean {
  return SEEDED_ORG_TEMPLATE_NAME_SET.has(name.trim().toLowerCase());
}

export function findOrgTemplateIdByName(
  rows: { id: string; name: string }[],
  templateName: SeededOrgTemplateName
): string | undefined {
  const target = templateName.toLowerCase();
  return rows.find((role) => role.name.trim().toLowerCase() === target)?.id;
}

/** Idempotent — skips names that already exist on the org (case-insensitive). */
export async function seedOrgTeamTemplates(
  supabase: SupabaseClient,
  organizationId: string
): Promise<void> {
  const { data: existing, error: listError } = await supabase
    .from('organization_custom_roles')
    .select('name')
    .eq('organization_id', organizationId);

  if (listError) {
    throw new Error(`Failed to list org templates: ${listError.message}`);
  }

  const existingNames = new Set(
    (existing ?? []).map((row) => (row.name as string).trim().toLowerCase())
  );

  const toInsert = SEEDED_ORG_TEMPLATE_ENTRIES.filter(
    (entry) => !existingNames.has(entry.name.toLowerCase())
  );

  if (toInsert.length === 0) return;

  const { error: insertError } = await supabase.from('organization_custom_roles').insert(
    toInsert.map((entry) => ({
      organization_id: organizationId,
      name: entry.name,
      permissions: entry.permissions,
      all_listings: entry.allListings,
      listing_assignments: entry.allListings ? null : { properties: [], parkings: [] },
    }))
  );

  if (insertError) {
    throw new Error(`Failed to seed org team templates: ${insertError.message}`);
  }
}
