/**
 * get-team-invite-preview — public invite branding for /accept-invite.
 * GET ?token=&scope=org|property|parking (scope optional)
 */

import { getTeamInvitePreview } from '../_shared/teamInvitePreview.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

servePublic('get-team-invite-preview', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }


  const limited = await publicGetRateLimitGate(req, 'get-team-invite-preview');
  if (limited) return limited;

  const url = new URL(req.url);
  const token = url.searchParams.get('token')?.trim() ?? '';
  const scope = url.searchParams.get('scope');

  if (!token) {
    return jsonError(req, 'token is required', 400);
  }

  try {
    const preview = await getTeamInvitePreview(token, scope);
    return jsonSuccess(req, { preview });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Preview failed';
    const status = msg.includes('not found')
      ? 404
      : msg.includes('expired') || msg.includes('no longer valid')
        ? 410
        : 400;
    return jsonError(req, msg, status);
  }
});
