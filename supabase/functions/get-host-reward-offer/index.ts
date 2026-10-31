/**
 * get-host-reward-offer — Current org's Recommended-verification reward offer.
 * Auth: JWT + any active org member.
 */

import { verifyOrgAccess } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { getHostRewardOfferForOrg } from '../_shared/hostVerificationReward.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-host-reward-offer', async (req) => {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  let orgId = '';
  if (method === 'GET') {
    const url = new URL(req.url);
    orgId = (url.searchParams.get('orgId') ?? '').trim();
  } else {
    const body = await readJsonBody(req);
    orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  }
  if (!orgId) return jsonError(req, 'orgId is required');

  await verifyOrgAccess(req, { orgId });
  const offer = await getHostRewardOfferForOrg(orgId);
  return jsonSuccess(req, { offer });
});
