/**
 * Shared Supabase client for social inbox modules — kept separate so lifecycle,
 * scope, and Graph helpers can import the DB without importing socialInboxService
 * (avoids circular module graphs).
 */

import { createServiceClient } from './orgAuth.ts';
import type { SocialChannelConnectionRow, SocialPlatform } from './socialInboxTypes.ts';

export function socialInboxDb() {
  return createServiceClient();
}

export async function upsertChannelConnection(
  fields: Partial<SocialChannelConnectionRow> & {
    organization_id: string;
    platform: SocialPlatform;
    external_account_id: string;
  }
): Promise<SocialChannelConnectionRow> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .upsert(
      { ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id,platform,external_account_id' }
    )
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to upsert connection');
  return data as SocialChannelConnectionRow;
}
