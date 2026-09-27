/**
 * org-subscriptions-admin — Super-admin list/search org subscriptions + manual assign/override.
 * Billing is org-level only — see planEntitlements.ts.
 */

import {
  changeOrgSubscription,
  createOrgSubscription,
  getActiveOrgSubscription,
} from '../_shared/planEntitlements.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  adminExtendOrgSubscription,
  runPlatformBillingCycle,
} from '../_shared/subscriptionOrchestrator.ts';
import { revokeHostVerificationReward } from '../_shared/hostVerificationReward.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
  parsePageLimit,
} from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

// Statuses that count as an org's current ("live") subscription — mirrors the partial unique
// index (org_subscriptions_one_live_per_org_idx) plus 'suspended', which can still be the
// most-recent active assignment.
const LIVE_ORG_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'suspended'];

async function enrolledPropertyIds(
  supabase: ReturnType<typeof createServiceClient>,
  orgSubscriptionId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('org_subscription_properties')
    .select('property_id')
    .eq('org_subscription_id', orgSubscriptionId);
  return (data ?? []).map((r) => r.property_id as string);
}

serveSuperAdmin('org-subscriptions-admin', async (req, admin) => {
  const stepUp = await requireSuperAdminStepUp(req, admin, 'org_subscription');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();
  const url = new URL(req.url);
  const organizationIdParam = url.searchParams.get('organizationId')?.trim() || null;
  const summaryRequested = url.searchParams.get('summary') === 'true';

  if (req.method === 'GET') {
    if (summaryRequested) {
      const [totalRes, assignedRes, activeRes, propertiesRes] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase
          .from('organizations')
          .select('id, org_subscriptions!inner(id)', { count: 'exact', head: true })
          .in('org_subscriptions.status', LIVE_ORG_SUBSCRIPTION_STATUSES),
        supabase
          .from('org_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('properties').select('id', { count: 'exact', head: true }),
      ]);

      const queryError =
        totalRes.error ?? assignedRes.error ?? activeRes.error ?? propertiesRes.error ?? null;
      if (queryError) return jsonError(req, queryError.message, 500);

      const total = totalRes.count ?? 0;
      const assigned = assignedRes.count ?? 0;

      return jsonSuccess(req, {
        summary: {
          total,
          assigned,
          unassigned: total - assigned,
          activeSubscriptions: activeRes.count ?? 0,
          properties: propertiesRes.count ?? 0,
        },
      });
    }

    if (url.searchParams.get('rewards') === 'true') {
      const { data, error } = await supabase
        .from('org_subscriptions')
        .select(
          `
          id,
          organization_id,
          status,
          current_period_start,
          current_period_end,
          created_at,
          organizations ( id, name, slug ),
          pricing_plans ( code, name )
        `
        )
        .eq('source', 'reward')
        .in('status', ['trialing', 'active'])
        .order('current_period_end', { ascending: true })
        .limit(50);
      if (error) return jsonError(req, error.message, 500);

      const grants = (data ?? []).map((row) => {
        const org = row.organizations as Record<string, unknown> | null | undefined;
        const plan = row.pricing_plans as Record<string, unknown> | null | undefined;
        return {
          orgSubscriptionId: row.id as string,
          organizationId: row.organization_id as string,
          organizationName: (org?.name as string | undefined) ?? 'Unknown org',
          organizationSlug: (org?.slug as string | undefined) ?? null,
          status: row.status as string,
          planCode: (plan?.code as string | undefined) ?? null,
          planName: (plan?.name as string | undefined) ?? null,
          periodStart: (row.current_period_start as string | null) ?? null,
          periodEnd: (row.current_period_end as string | null) ?? null,
          createdAt: row.created_at as string,
        };
      });

      return jsonSuccess(req, { grants });
    }

    if (organizationIdParam) {
      const subscription = await getActiveOrgSubscription(organizationIdParam);
      const events = subscription
        ? await supabase
            .from('org_subscription_events')
            .select('*')
            .eq('org_subscription_id', subscription.id)
            .order('created_at', { ascending: false })
            .limit(20)
        : { data: [] };

      const { data: transactions } = await supabase
        .from('org_payment_transactions')
        .select('id, amount, currency, status, created_at, paid_at, checkout_url')
        .eq('organization_id', organizationIdParam)
        .order('created_at', { ascending: false })
        .limit(20);

      return jsonSuccess(req, {
        subscription,
        enrolledPropertyIds: subscription
          ? await enrolledPropertyIds(supabase, subscription.id)
          : [],
        recentEvents: events.data ?? [],
        transactions: transactions ?? [],
      });
    }

    const search = url.searchParams.get('search')?.trim() || '';
    const planCode = url.searchParams.get('planCode')?.trim() || '';
    const hasPlanCodeFilter = Boolean(planCode) && planCode !== 'all';
    const { page, limit } = parsePageLimit(url.searchParams);
    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit - 1;

    // planCode filters on the org's *live* subscription's plan code, which lives two joins deep
    // (org_subscriptions -> pricing_plans). PostgREST only lets us filter an embedded resource
    // with `!inner`, so the join shape — and therefore which subscriptions/plans are embedded per
    // row — differs depending on whether a plan filter is active.
    const subscriptionsSelect = hasPlanCodeFilter
      ? `org_subscriptions!inner (
          id,
          plan_id,
          pricing_model,
          status,
          price_php_snapshot,
          updated_at,
          pricing_plans!inner ( code, name )
        )`
      : `org_subscriptions (
          id,
          plan_id,
          pricing_model,
          status,
          price_php_snapshot,
          updated_at,
          pricing_plans ( code, name )
        )`;

    let query = supabase
      .from('organizations')
      .select(
        `
        id,
        name,
        slug,
        properties ( id ),
        ${subscriptionsSelect}
      `,
        { count: 'exact' }
      )
      .order('name', { ascending: true });

    if (search) {
      const pattern = postgrestOrIlikeValue(search);
      query = query.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
    }

    if (hasPlanCodeFilter) {
      query = query
        .in('org_subscriptions.status', LIVE_ORG_SUBSCRIPTION_STATUSES)
        .eq('org_subscriptions.pricing_plans.code', planCode);
    }

    const { data, error, count } = await query.range(fromIdx, toIdx);
    if (error) return jsonError(req, error.message, 500);

    const rows = (data ?? []).map((row) => {
      const properties = ((row as Record<string, unknown>).properties ?? []) as Record<
        string,
        unknown
      >[];
      const subs = ((row as Record<string, unknown>).org_subscriptions ?? []) as Record<
        string,
        unknown
      >[];
      const live = subs.find((s) =>
        LIVE_ORG_SUBSCRIPTION_STATUSES.includes(String(s.status ?? ''))
      );
      const planJoin = live?.pricing_plans as Record<string, unknown> | undefined;

      return {
        organizationId: row.id as string,
        organizationName: row.name as string,
        organizationSlug: row.slug as string,
        propertyCount: properties.length,
        subscription: live
          ? {
              id: live.id as string,
              planId: live.plan_id as string,
              planCode: (planJoin?.code as string | undefined) ?? null,
              planName: (planJoin?.name as string | undefined) ?? null,
              pricingModel: live.pricing_model as string,
              status: live.status as string,
              pricePhpSnapshot:
                live.price_php_snapshot == null ? null : Number(live.price_php_snapshot),
              updatedAt: live.updated_at as string,
            }
          : null,
      };
    });

    return jsonSuccess(req, { organizations: rows, total: count ?? 0, page, limit });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    const body = await readJsonBody(req);

    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
    if (!organizationId || !planId) {
      return jsonError(req, 'organizationId and planId are required');
    }

    // propertyIds is optional — defaults to every property the org owns, since the admin table's
    // one-click "assign" doesn't offer a per-property picker (that's the host-facing org Plans
    // page's job). Pass propertyIds explicitly to enroll only a subset.
    let propertyIds = Array.isArray(body.propertyIds)
      ? body.propertyIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    if (propertyIds.length === 0) {
      const { data: allProperties, error: allPropertiesError } = await supabase
        .from('properties')
        .select('id')
        .eq('organization_id', organizationId);
      if (allPropertiesError) return jsonError(req, allPropertiesError.message, 500);
      propertyIds = (allProperties ?? []).map((p) => p.id as string);
    }
    if (propertyIds.length === 0) {
      return jsonError(req, 'Organization has no properties to enroll');
    }

    // Manual assign/override price — bypasses the rate x count x discount formula for
    // sales-assisted tiers (e.g. Managed) that don't have a self-serve checkout.
    const overridePricePhp =
      typeof body.overridePricePhp === 'number' && Number.isFinite(body.overridePricePhp)
        ? body.overridePricePhp
        : null;

    const existing = await getActiveOrgSubscription(organizationId);
    let orgSubscriptionId: string;
    if (!existing) {
      const created = await createOrgSubscription(organizationId, planId, propertyIds, admin.id);
      orgSubscriptionId = created.orgSubscriptionId;
    } else {
      orgSubscriptionId = existing.id;
      await changeOrgSubscription(orgSubscriptionId, planId, propertyIds, admin.id);
    }

    if (overridePricePhp != null) {
      const { error: overrideError } = await supabase
        .from('org_subscriptions')
        .update({ price_php_snapshot: overridePricePhp })
        .eq('id', orgSubscriptionId);
      if (overrideError) return jsonError(req, overrideError.message, 500);
    }

    const subscription = await getActiveOrgSubscription(organizationId);
    const events = await supabase
      .from('org_subscription_events')
      .select('*')
      .eq('org_subscription_id', orgSubscriptionId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: orgRow } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const { data: planRow } = await supabase
      .from('pricing_plans')
      .select('name')
      .eq('id', planId)
      .maybeSingle();
    const planName = typeof planRow?.name === 'string' ? planRow.name : null;
    await logSuperAdminAction(admin, {
      action: 'org_subscription.assign',
      targetType: 'organization',
      targetId: organizationId,
      summary: `Assigned plan to ${orgRow?.name ?? organizationId}${
        overridePricePhp != null ? ` (override ₱${overridePricePhp})` : ''
      }`,
      metadata: {
        planId,
        propertyCount: propertyIds.length,
        overridePricePhp,
        note: typeof body.note === 'string' ? body.note : undefined,
      },
      mirrorToOrgActivity: {
        organizationId,
        action: 'billing.plan_overridden_by_platform',
        targetType: 'subscription',
        targetId: organizationId,
        targetLabel: orgRow?.name ?? 'the organization',
        metadata: {
          to_plan: planId,
          ...(planName ? { to_plan_name: planName } : {}),
          property_count: propertyIds.length,
          override_price_php: overridePricePhp,
        },
        req,
      },
    });

    return jsonSuccess(req, {
      subscription,
      recentEvents: events.data ?? [],
    });
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const body = await readJsonBody(req);
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'run_billing_cron') {
      const result = await runPlatformBillingCycle();
      return jsonSuccess(req, { result });
    }

    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    if (!organizationId) return jsonError(req, 'organizationId is required');

    if (action === 'extend_period') {
      const periodEnd =
        typeof body.periodEnd === 'string'
          ? body.periodEnd.trim()
          : typeof body.periodEndIso === 'string'
            ? body.periodEndIso.trim()
            : '';
      if (!periodEnd) return jsonError(req, 'periodEnd is required');

      const status =
        body.status === 'active' ||
        body.status === 'past_due' ||
        body.status === 'suspended' ||
        body.status === 'canceled'
          ? body.status
          : 'active';

      await adminExtendOrgSubscription({
        organizationId,
        periodEndIso: periodEnd,
        status,
        note: typeof body.note === 'string' ? body.note.trim() || null : null,
        adminUserId: admin.id,
      });

      const subscription = await getActiveOrgSubscription(organizationId);
      return jsonSuccess(req, { subscription });
    }

    if (action === 'revoke_reward') {
      const orgSubscriptionId =
        typeof body.orgSubscriptionId === 'string'
          ? body.orgSubscriptionId.trim()
          : typeof body.subscriptionId === 'string'
            ? body.subscriptionId.trim()
            : '';
      if (!orgSubscriptionId) return jsonError(req, 'orgSubscriptionId is required');

      await revokeHostVerificationReward(orgSubscriptionId, admin.id);

      await logSuperAdminAction(admin, {
        action: 'org_subscription.revoke_reward',
        targetType: 'organization',
        targetId: organizationId,
        summary: `Revoked host verification reward subscription ${orgSubscriptionId}`,
        metadata: { orgSubscriptionId },
      });

      const subscription = await getActiveOrgSubscription(organizationId);
      return jsonSuccess(req, { subscription });
    }

    return jsonError(req, 'Unknown action', 400);
  }

  return jsonError(req, 'Method not allowed', 405);
});
