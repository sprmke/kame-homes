/**
 * get-platform-host-settings — GET platform host dashboard settings (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

serveSuperAdmin('get-platform-host-settings', async (req) => {
  requireHttpMethod(req, 'GET');

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('platform_host_settings')
    .select('announcements, updated_at')
    .eq('id', true)
    .maybeSingle();

  if (error) {
    console.error('[get-platform-host-settings]', error.message);
    throw new Error('Failed to load platform host settings');
  }

  if (!data) {
    return jsonSuccess(req, { announcements: [], updatedAt: null });
  }

  return jsonSuccess(req, {
    announcements: data.announcements ?? [],
    updatedAt: data.updated_at ?? null,
  });
});
