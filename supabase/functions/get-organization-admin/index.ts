/**
 * get-organization-admin — GET one organization's full picture for the `/admin/orgs/:slug` hub:
 * identity, owner, asset + member counts, live plan, verification status, and open work
 * (pending approvals + open support tickets) scoped to this org. Super-admin only.
 */

import { loadAuthUserProfile } from '../_shared/authUserProfile.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { readOrgVerificationFromSettings } from '../_shared/orgVerification.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { countPendingApprovals } from '../_shared/superAdminApprovalsQueue.ts';

const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'suspended'];

serveSuperAdmin('get-organization-admin', async (req) => {
  requireHttpMethod(req, 'GET');
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug')?.trim();
  const orgId = url.searchParams.get('organizationId')?.trim();
  if (!slug && !orgId) return jsonError(req, 'slug or organizationId is required', 400);

  const orgQuery = supabase.from('organizations').select(
    `id, name, slug, owner_id, created_at, settings,
       org_subscriptions ( id, status, price_php_snapshot, current_period_end,
         pricing_plans ( code, name ) )`
  );
  const { data: org, error } = await (
    slug ? orgQuery.eq('slug', slug) : orgQuery.eq('id', orgId)
  ).maybeSingle();

  if (error) return jsonError(req, error.message, 500);
  if (!org) return jsonError(req, 'Organization not found', 404);

  const organizationId = org.id as string;

  const [owner, propertyCount, parkingCount, memberCount, openTickets, pendingApprovals] =
    await Promise.all([
      loadAuthUserProfile(supabase, org.owner_id as string),
      supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      supabase
        .from('parkings')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .neq('status', 'closed'),
      countPendingApprovals(organizationId),
    ]);

  const subs = (org.org_subscriptions ?? []) as Record<string, unknown>[];
  const live = subs.find((s) => LIVE_SUBSCRIPTION_STATUSES.includes(String(s.status ?? '')));
  const planJoin = live?.pricing_plans as Record<string, unknown> | undefined;
  const verification = readOrgVerificationFromSettings(
    org.settings as Record<string, unknown> | null | undefined
  );

  return jsonSuccess(req, {
    organization: {
      id: organizationId,
      name: org.name as string,
      slug: org.slug as string,
      createdAt: org.created_at as string,
      owner: { name: owner.name, email: owner.email, avatarUrl: owner.avatarUrl },
      counts: {
        properties: propertyCount.count ?? 0,
        parkings: parkingCount.count ?? 0,
        members: memberCount.count ?? 0,
      },
      plan: live
        ? {
            code: (planJoin?.code as string | undefined) ?? null,
            name: (planJoin?.name as string | undefined) ?? null,
            status: live.status as string,
            mrrPhp: live.price_php_snapshot == null ? 0 : Number(live.price_php_snapshot),
            currentPeriodEnd: (live.current_period_end as string | undefined) ?? null,
          }
        : null,
      verification: {
        baseStatus: verification.baseStatus,
        enhancedStatus: verification.enhancedStatus,
      },
      openWork: {
        pendingApprovals: pendingApprovals.total,
        openTickets: openTickets.count ?? 0,
      },
    },
  });
});
