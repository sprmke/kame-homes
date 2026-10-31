/**
 * voice-receptionist-usage — Org-scoped read-only usage/cost summary for AI voice
 * receptionist sessions across the org's properties (last 30 days).
 * Auth: org member (org.settings:view).
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  listPropertyIdsForOrganization,
  resolveOrgAccessContext,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { getVoiceReceptionistUsageSummary } from '../_shared/voiceReceptionistService.ts';

serveAuthenticated('voice-receptionist-usage', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const ctx = await resolveOrgAccessContext(req, 'org.settings:view');
  const propertyIds = await listPropertyIdsForOrganization(ctx.org.id);
  const data = await getVoiceReceptionistUsageSummary(propertyIds);
  return jsonSuccess(req, data);
});
