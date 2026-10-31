/**
 * Client mirror of supabase/functions/_shared/legacyPermissionExpansion.ts
 */

import { expandAccessPhase6PermissionIds } from '@/features/dashboard/team/lib/accessPermissionExpansion';
import { expandBookingsPhase3PermissionIds } from '@/features/dashboard/team/lib/bookingsPermissionExpansion';
import { expandOpsPhase4PermissionIds } from '@/features/dashboard/team/lib/opsPermissionExpansion';
import { expandSettingsPhase5PermissionIds } from '@/features/dashboard/team/lib/settingsPermissionExpansion';

export function expandLegacyPropertyPermissionIds(ids: readonly string[]): string[] {
  return expandAccessPhase6PermissionIds(
    expandSettingsPhase5PermissionIds(
      expandOpsPhase4PermissionIds(expandBookingsPhase3PermissionIds(ids))
    )
  );
}
