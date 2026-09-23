/** Close stale voice-session leases and record one cron summary per affected property. */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { resolveOrganizationIdForProperty } from '../_shared/propertyScope.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import { reapStaleVoiceReceptionistSessions } from '../_shared/voiceReceptionistService.ts';

function verifyVoiceReaperSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'VOICE_RECEPTIONIST_REAPER_SECRET',
    headerName: 'x-voice-receptionist-reaper-secret',
  });
}

serveCronPost('voice-receptionist-reaper', verifyVoiceReaperSecret, async () => {
  const result = await reapStaleVoiceReceptionistSessions();
  for (const stats of result.propertyStats) {
    const organizationId = await resolveOrganizationIdForProperty(stats.propertyId);
    await logActivity({
      action: 'system.cron_run',
      organizationId,
      propertyId: stats.propertyId,
      actor: buildActorContext('cron', { cron: 'voice-receptionist-reaper' }),
      metadata: {
        message: 'Voice receptionist cleanup completed',
        count: stats.reaped + stats.transcriptsDeleted,
        reaped_count: stats.reaped,
        transcripts_deleted_count: stats.transcriptsDeleted,
      },
    });
  }
  return result;
});
