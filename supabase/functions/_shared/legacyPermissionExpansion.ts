/**
 * Chain Phase 3–6 legacy umbrella → leaf expansions for stored permission arrays.
 */

import { expandAccessPhase6PermissionIds } from './accessPermissionExpansion.ts';
import { expandBookingsPhase3PermissionIds } from './bookingsPermissionExpansion.ts';
import { expandOpsPhase4PermissionIds } from './opsPermissionExpansion.ts';
import { expandSettingsPhase5PermissionIds } from './settingsPermissionExpansion.ts';

export function expandLegacyPropertyPermissionIds(ids: readonly string[]): string[] {
  return expandAccessPhase6PermissionIds(
    expandSettingsPhase5PermissionIds(
      expandOpsPhase4PermissionIds(expandBookingsPhase3PermissionIds(ids))
    )
  );
}
