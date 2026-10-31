/**
 * Phase 5 — expand retired settings/templates umbrella ids to leaf ids.
 * Keep until every stored row is remapped (migration + normalizePermissionIds).
 */

/** Settings section edit leaves (excl. integrations view — that comes from settings:view). */
export const SETTINGS_SECTION_EDIT_IDS = [
  'settings.basicInfo:edit',
  'settings.media:edit',
  'settings.propertyDetails:edit',
  'settings.amenities:edit',
  'settings.houseRules:edit',
  'settings.guestForm:edit',
  'settings.cancellationPolicy:edit',
  'settings.location:edit',
  'settings.socials:edit',
  'settings.payment:edit',
  'settings.buildingForms:edit',
  'settings.emailAutomations:edit',
  'settings.dangerZone:edit',
] as const;

export const TEMPLATES_PHASE5_LEAF_IDS = [
  'templates.standard:edit',
  'templates.email:edit',
  'templates.custom:add',
  'templates.custom:edit',
  'templates.custom:delete',
  'publicPages:view',
  'publicPages.property:edit',
  'publicPages.stayGuide:edit',
  'publicPages.showcase:edit',
] as const;

/** Old id → leaf ids (access-preserving). */
export const SETTINGS_PHASE5_EXPANSION: Record<string, readonly string[]> = {
  'settings:view': ['settings:view', 'settings.integrations:view'],
  'settings:edit': [...SETTINGS_SECTION_EDIT_IDS],
  'templates:view': ['templates:view', 'publicPages:view'],
  'templates:edit': [
    'templates.standard:edit',
    'templates.email:edit',
    'templates.custom:add',
    'templates.custom:edit',
    'templates.custom:delete',
    'publicPages.property:edit',
    'publicPages.stayGuide:edit',
    'publicPages.showcase:edit',
  ],
};

export const SETTINGS_PHASE5_LEAF_IDS = [
  'settings.integrations:view',
  ...SETTINGS_SECTION_EDIT_IDS,
  ...TEMPLATES_PHASE5_LEAF_IDS,
] as const;

export function expandSettingsPhase5PermissionIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id) continue;
    const expansion = SETTINGS_PHASE5_EXPANSION[id];
    const next = expansion ?? [id];
    for (const leaf of next) {
      if (seen.has(leaf)) continue;
      seen.add(leaf);
      out.push(leaf);
    }
  }
  return out;
}
