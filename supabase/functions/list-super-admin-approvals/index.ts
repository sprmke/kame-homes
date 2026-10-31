/**
 * list-super-admin-approvals — GET unified super-admin queue (org verifications +
 * listing verifications + external reviews). Queue loading + filter predicates live in
 * `_shared/superAdminApprovalsQueue.ts` (also used by `super-admin-overview`).
 */

import { jsonSuccess, parsePageLimit, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import {
  loadApprovalQueue,
  summarizeApprovalQueue,
  type ApprovalStatusFilter,
  type ApprovalTypeFilter,
} from '../_shared/superAdminApprovalsQueue.ts';

export type {
  ApprovalRow,
  ExternalReviewApprovalRow,
} from '../_shared/superAdminApprovalsQueue.ts';

serveAuthenticated('list-super-admin-approvals', async (req) => {
  requireHttpMethod(req, 'GET');
  await verifySuperAdminJwt(req);

  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p, { maxLimit: 500 });
  const type = (p.get('type') ?? 'all') as ApprovalTypeFilter;
  const status = (p.get('status') ?? 'all') as ApprovalStatusFilter;
  const search = (p.get('search') ?? '').trim().toLowerCase();
  const organizationId = p.get('organizationId')?.trim() || undefined;

  if (p.get('summary') === 'true') {
    return jsonSuccess(req, { summary: await summarizeApprovalQueue(organizationId) });
  }

  const filtered = await loadApprovalQueue({ type, status, search, organizationId });

  const total = filtered.length;
  const fromIdx = (page - 1) * limit;
  const paged = filtered.slice(fromIdx, fromIdx + limit);

  return jsonSuccess(req, {
    approvals: paged,
    total,
    page,
    limit,
  });
});
