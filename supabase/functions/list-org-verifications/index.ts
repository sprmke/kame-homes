/**
 * list-org-verifications — GET orgs with a submitted Tier 1 (host) verification (super admin).
 * Attaches unitConflicts[] / hasActiveUnitConflict for tower+unit succession UX.
 */

import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { listOrgVerificationApprovalRows } from '../_shared/superAdminOrgVerifications.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('list-org-verifications', async (req) => {
  requireHttpMethod(req, 'GET');
  await verifySuperAdminJwt(req);

  const approvals = await listOrgVerificationApprovalRows();
  return jsonSuccess(req, {
    approvals: approvals.map(({ type: _type, ...row }) => row),
  });
});
