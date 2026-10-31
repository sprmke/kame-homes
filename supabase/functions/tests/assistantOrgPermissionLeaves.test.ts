import './_localSupabaseEnv.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/**
 * D14 guard — org granular RBAC: assistant tool re-checks must use leaf ids
 * (`org.settings.basic:edit`), not legacy coarse umbrellas (`org:settings:edit`).
 * Checking a multi-leaf legacy id via hasOrgPermission expands required to ALL
 * children and passes if the caller has ANY one — too permissive for writes.
 */
const ASSISTANT_SHARED_FILES = [
  '../_shared/dashboardAssistantTools.ts',
  '../_shared/dashboardAssistantHostMediaTools.ts',
  '../_shared/dashboardAssistantGuidanceTools.ts',
  '../_shared/dashboardAssistantPhase4Tools.ts',
  '../_shared/dashboardAssistantVerificationTools.ts',
] as const;

/** Coarse org ids that expand to multiple leaves (or are obsolete in tool checks). */
const FORBIDDEN_LEGACY_ORG_IDS = [
  'org:settings:edit',
  'org:settings:view',
  'org:team:manage',
  'org:team:invite',
  'org:team:view',
  'org:dashboard:view',
  'org:bookings:view',
  'org:parkings:view',
  'org:parkings:manage',
  'org:parkings:create',
  'org:properties:view',
  'org:properties:create',
  'org:properties:manage',
] as const;

Deno.test('assistant org tool RBAC uses granular leaves (no legacy coarse org: ids)', async () => {
  const hits: string[] = [];
  for (const rel of ASSISTANT_SHARED_FILES) {
    const url = new URL(rel, import.meta.url);
    const text = await Deno.readTextFile(url);
    for (const id of FORBIDDEN_LEGACY_ORG_IDS) {
      if (text.includes(`'${id}'`) || text.includes(`"${id}"`)) {
        hits.push(`${rel}: ${id}`);
      }
    }
  }
  assertEquals(
    hits,
    [],
    `Forbidden legacy org permission ids in assistant tools:\n${hits.join('\n')}`
  );
});
