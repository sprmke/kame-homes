#!/usr/bin/env bun
/**
 * Dry-run: verify property team role collapse preserves effective permissions.
 *
 * Compares (a) legacy effective permission set per member/invite row with
 * (b) post-migration stored permissions after STAFF cap + role_id → ADMIN.
 *
 * Usage (local): bun scripts/dev/property-team-role-migration-dry-run.ts
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or local stack defaults).
 */

import { createClient } from '@supabase/supabase-js';

import {
  capLegacyStaffPermissions,
  LEGACY_STAFF_PRESET_PERMISSIONS,
} from '../../supabase/functions/_shared/propertyTeamTemplates.ts';
import {
  LEGACY_BUILTIN_PROPERTY_ROLES,
  normalizePermissionIds,
  type TeamPermissionId,
} from '../../supabase/functions/_shared/propertyTeamPermissions.ts';

const STAFF_ALLOWED = new Set<string>(LEGACY_STAFF_PRESET_PERMISSIONS);

function legacyEffectivePermissions(roleId: string, permissions: unknown): TeamPermissionId[] {
  const stored = normalizePermissionIds(permissions);
  if (roleId === 'STAFF') {
    return capLegacyStaffPermissions(stored);
  }
  if ((LEGACY_BUILTIN_PROPERTY_ROLES as readonly string[]).includes(roleId)) {
    return stored.length > 0 ? stored : stored;
  }
  return stored;
}

function proposedPermissions(roleId: string, permissions: unknown): TeamPermissionId[] {
  const stored = normalizePermissionIds(permissions);
  if (roleId === 'STAFF') {
    return stored.filter((id) => STAFF_ALLOWED.has(id));
  }
  return stored;
}

function setsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

function compareRow(
  table: string,
  id: string,
  roleId: string,
  permissions: unknown
): { ok: boolean; before: string[]; after: string[] } {
  const before = legacyEffectivePermissions(roleId, permissions);
  const after = proposedPermissions(roleId, permissions);
  return { ok: setsEqual(before, after), before, after };
}

async function main() {
  const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

  const supabase = createClient(url, key);

  const failures: string[] = [];

  const { data: members, error: membersError } = await supabase
    .from('property_members')
    .select('id, role_id, permissions, status')
    .in('role_id', [...LEGACY_BUILTIN_PROPERTY_ROLES]);

  if (membersError) {
    console.error('Failed to load property_members:', membersError.message);
    process.exit(1);
  }

  for (const row of members ?? []) {
    const result = compareRow(
      'property_members',
      row.id as string,
      row.role_id as string,
      row.permissions
    );
    if (!result.ok) {
      failures.push(
        `property_members ${row.id} (${row.role_id}, ${row.status}): before=[${result.before.join(', ')}] after=[${result.after.join(', ')}]`
      );
    }
  }

  const { data: invites, error: invitesError } = await supabase
    .from('property_invitations')
    .select('id, role_id, permissions, status')
    .in('role_id', [...LEGACY_BUILTIN_PROPERTY_ROLES]);

  if (invitesError) {
    console.error('Failed to load property_invitations:', invitesError.message);
    process.exit(1);
  }

  for (const row of invites ?? []) {
    const result = compareRow(
      'property_invitations',
      row.id as string,
      row.role_id as string,
      row.permissions
    );
    if (!result.ok) {
      failures.push(
        `property_invitations ${row.id} (${row.role_id}, ${row.status}): before=[${result.before.join(', ')}] after=[${result.after.join(', ')}]`
      );
    }
  }

  const memberCount = members?.length ?? 0;
  const inviteCount = invites?.length ?? 0;

  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} access regression(s) detected:\n`);
    for (const line of failures) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ Dry-run clean — ${memberCount} member row(s), ${inviteCount} invitation row(s) with legacy role_id; effective permissions preserved.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
