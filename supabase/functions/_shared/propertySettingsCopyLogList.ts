/**
 * List recent property_settings_copy_log rows for an org (service role).
 */

import type { SupabaseClient } from './supabaseJs.ts';

export type PropertySettingsCopyLogRow = {
  id: string;
  organization_id: string;
  source_property_id: string;
  actor_user_id: string | null;
  groups: string[];
  target_property_ids: string[];
  results: unknown;
  created_at: string;
};

export async function listPropertySettingsCopyLogs(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 20
): Promise<PropertySettingsCopyLogRow[]> {
  const capped = Math.min(Math.max(1, limit), 50);
  const { data, error } = await supabase
    .from('property_settings_copy_log')
    .select(
      'id, organization_id, source_property_id, actor_user_id, groups, target_property_ids, results, created_at'
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(capped);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as PropertySettingsCopyLogRow[];
}
