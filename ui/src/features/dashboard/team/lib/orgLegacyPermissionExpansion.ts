/**
 * Maps legacy coarse org permission ids to granular hub leaves (client mirror).
 */

const LEGACY_ORG_EXPANSION: Record<string, readonly string[]> = {
  'org:dashboard:view': ['org.dashboard:view'],
  'org:bookings:view': ['org.bookings:view'],
  'org:properties:view': ['org.properties:view'],
  'org:properties:create': ['org.properties:create'],
  'org:properties:manage': ['org.properties:manage'],
  'org:parkings:view': ['org.parkings:view'],
  'org:parkings:create': ['org.parkings:create'],
  'org:parkings:manage': ['org.parkings:manage'],
  'org:settings:view': ['org.settings:view'],
  'org:settings:edit': [
    'org.settings.basic:edit',
    'org.settings.socials:edit',
    'org.settings.aiPlatform:edit',
    'org.settings.aiAssistant:edit',
  ],
  'org:team:view': ['org.team:view'],
  'org:team:invite': ['org.team.invitations:add'],
  'org:team:manage': [
    'org.team.invitations:edit',
    'org.team.invitations:delete',
    'org.team.members:edit',
    'org.team.members:delete',
  ],
  /** Dropped — booking import is property-scoped (`bookings.import:add`) only. */
  'org:import:manage': [],
  'org.import:manage': [],
  'org:delete': [],
};

export function expandLegacyOrgPermissionIds(ids: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    if (LEGACY_ORG_EXPANSION[id]) {
      for (const leaf of LEGACY_ORG_EXPANSION[id]) {
        out.add(leaf);
      }
    } else {
      out.add(id);
    }
  }
  return [...out];
}
