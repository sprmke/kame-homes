/**
 * Idempotent org_settings row on organization create.
 */

import { ensureOrgSettingsRow } from './orgSettings.ts';

export async function seedOrgSettings(organizationId: string): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error('organizationId required');
  await ensureOrgSettingsRow(orgId);
}
