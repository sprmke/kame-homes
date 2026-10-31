/**
 * get-org-superhost-progress — Live Superhost criteria snapshot for org settings Superhost section.
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  allSuperhostCriteriaMet,
  loadAndComputeOrgSuperhostCriteria,
  superhostProgressSummary,
} from '../_shared/superhostMetrics.ts';
import { readOrgSuperhostFromSettings } from '../_shared/orgSuperhost.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-org-superhost-progress', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('org_id')?.trim() ?? '';
  const orgSlug = url.searchParams.get('org_slug')?.trim() ?? '';

  const ctx = await verifyOrgAccess(req, {
    orgId: orgId || undefined,
    orgSlug: orgSlug || undefined,
  });
  const supabase = createServiceClient();
  const criteria = await loadAndComputeOrgSuperhostCriteria(supabase, ctx.org.id);
  const stored = readOrgSuperhostFromSettings(ctx.org.settings);
  const calendar = superhostProgressSummary();

  return jsonSuccess(req, {
    earned: stored.earned === true,
    earnedAt: stored.earnedAt ?? null,
    lastAssessmentAt: stored.lastAssessmentAt ?? null,
    nextAssessmentAt: stored.nextAssessmentAt ?? calendar.nextAssessmentAt,
    assessmentKey: calendar.assessmentKey,
    criteria,
    allCriteriaMet: allSuperhostCriteriaMet(criteria),
  });
});
