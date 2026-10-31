/**
 * reassess-org-superhost — Super-admin manual Superhost re-assessment for one org.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { assessOrganizationSuperhost } from '../_shared/superhostAssessment.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('reassess-org-superhost', async (req) => {
  requireHttpMethod(req, 'POST');
  await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  if (!orgId) return jsonError(req, 'orgId is required');

  const supabase = createServiceClient();
  const result = await assessOrganizationSuperhost(supabase, orgId, {
    trigger: 'manual',
    force: true,
  });

  return jsonSuccess(req, result);
});
