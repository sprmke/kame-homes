/**
 * Phase 4 — expand retired finance/maintenance/pricing umbrella edit ids to leaf ids.
 * Keep until every stored row is remapped (migration + normalizePermissionIds).
 */

/** Old id → leaf ids (access-preserving). */
export const OPS_PHASE4_EXPANSION: Record<string, readonly string[]> = {
  'finance:edit': [
    'finance.transactions:add',
    'finance.transactions:edit',
    'finance.transactions:delete',
    'finance.export:view',
  ],
  'maintenance:edit': [
    'maintenance.reminders:add',
    'maintenance.reminders:edit',
    'maintenance.reminders:delete',
    'maintenance.export:view',
  ],
  'pricing:edit': ['pricing.rates:edit', 'pricing.blocks:add', 'pricing.blocks:delete'],
};

export const OPS_PHASE4_LEAF_IDS = [
  'finance.transactions:add',
  'finance.transactions:edit',
  'finance.transactions:delete',
  'finance.export:view',
  'maintenance.reminders:add',
  'maintenance.reminders:edit',
  'maintenance.reminders:delete',
  'maintenance.export:view',
  'pricing.rates:edit',
  'pricing.blocks:add',
  'pricing.blocks:delete',
] as const;

export function expandOpsPhase4PermissionIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id) continue;
    const expansion = OPS_PHASE4_EXPANSION[id];
    const next = expansion ?? [id];
    for (const leaf of next) {
      if (seen.has(leaf)) continue;
      seen.add(leaf);
      out.push(leaf);
    }
  }
  return out;
}
