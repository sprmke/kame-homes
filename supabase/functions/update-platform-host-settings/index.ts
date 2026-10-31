/**
 * update-platform-host-settings — PATCH platform host dashboard settings (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  parseHostAnnouncements,
  stampHostAnnouncementsForSave,
  validateHostAnnouncements,
} from '../_shared/hostAnnouncements.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

serveSuperAdmin('update-platform-host-settings', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'platform_host_settings');
  if (stepUp) return stepUp;

  requireHttpMethod(req, 'PATCH');

  const body = await readJsonBody(req);
  if (!Array.isArray(body.announcements)) {
    return jsonError(req, 'announcements must be an array');
  }

  const parsed = parseHostAnnouncements(body.announcements);
  if (parsed.length !== body.announcements.length) {
    return jsonError(req, 'Each announcement needs an id, title, and message');
  }

  const validationError = validateHostAnnouncements(parsed);
  if (validationError) {
    return jsonError(req, validationError);
  }

  const supabase = createServiceClient();
  const { data: existing, error: loadError } = await supabase
    .from('platform_host_settings')
    .select('announcements')
    .eq('id', true)
    .maybeSingle();

  if (loadError) {
    console.error('[update-platform-host-settings]', loadError.message);
    throw new Error('Failed to load platform host settings');
  }

  const announcements = stampHostAnnouncementsForSave(
    parsed,
    parseHostAnnouncements(existing?.announcements)
  );

  const { data, error } = await supabase
    .from('platform_host_settings')
    .upsert({
      id: true,
      announcements,
      updated_at: new Date().toISOString(),
    })
    .select('announcements, updated_at')
    .single();

  if (error) {
    console.error('[update-platform-host-settings]', error.message);
    throw new Error('Failed to update platform host settings');
  }

  await logSuperAdminAction(user, {
    action: 'platform.host_settings_update',
    targetType: 'platform',
    targetId: 'platform_host_settings',
    summary: 'Updated platform host announcements',
    metadata: { count: announcements.length },
  });

  return jsonSuccess(req, {
    announcements: data.announcements ?? [],
    updatedAt: data.updated_at ?? null,
  });
});
