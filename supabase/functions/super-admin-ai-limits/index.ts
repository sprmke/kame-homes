/**
 * super-admin-ai-limits — the single write surface for AI limits.
 *
 * GET  ?view=matrix   paginated org × resolved limits (+ provenance, usage, breach)
 * GET  ?view=profiles profiles + assignment/plan/spend impact, developments, plans
 * GET  ?view=org&orgId=  one org's resolved limits, assignment and per-property limits
 * POST { action } create_profile | update_profile | delete_profile | assign | set_overrides
 *      | set_plan_profile   (step-up OTP on every POST)
 *
 * Hosts never reach this; they only toggle AI on/off (see aiLimitGuard.ts).
 * Changes apply within `AI_LIMIT_CACHE_TTL_MS` (5 s) across edge instances.
 * activity-log: every tenant-affecting write mirrors `ai.limits_changed` to the org feed and
 * writes one `super_admin_audit_events` row.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  AiLimitAdminError,
  assignProfile,
  createProfile,
  deleteProfile,
  loadMatrix,
  loadOrgDetail,
  loadProfilesOverview,
  MAX_BULK_TARGETS,
  type AiLimitScope,
  ORG_OVERRIDE_KEYS,
  organizationIdsForTargets,
  parseLimitsMap,
  parseProfileInput,
  parseScope,
  parseTargetIds,
  PROPERTY_OVERRIDE_KEYS,
  requireOverrideReason,
  setOverrides,
  setPlanProfile,
  updateProfile,
  type MatrixFilters,
} from '../_shared/aiLimitAdmin.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

const STATUSES = ['all', 'breach', 'overridden', 'disabled'] as const;

function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
  const n = Number(url.searchParams.get(name));
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function matrixFilters(url: URL): MatrixFilters {
  const status = url.searchParams.get('status') ?? 'all';
  return {
    search: url.searchParams.get('search') ?? '',
    planTier: url.searchParams.get('planTier') ?? '',
    profileCode: url.searchParams.get('profileCode') ?? '',
    status: (STATUSES as readonly string[]).includes(status)
      ? (status as MatrixFilters['status'])
      : 'all',
    limit: intParam(url, 'limit', 25, 1, 100),
    offset: intParam(url, 'offset', 0, 0, 100_000),
  };
}

/** Mirror one activity row per affected org (bounded by MAX_BULK_TARGETS, run in small batches). */
async function mirrorToOrgs(
  req: Request,
  admin: { id: string; email: string },
  organizationIds: string[],
  change: 'updated' | 'reset',
  metadata: Record<string, unknown>
): Promise<void> {
  if (organizationIds.length === 0) return;
  const { data } = await createServiceClient()
    .from('organizations')
    .select('id, name')
    .in('id', organizationIds);
  const names = new Map((data ?? []).map((o) => [String(o.id), String(o.name)]));
  for (let i = 0; i < organizationIds.length; i += 20) {
    await Promise.all(
      organizationIds.slice(i, i + 20).map((orgId) =>
        logActivity({
          action: 'ai.limits_changed',
          organizationId: orgId,
          scope: 'org',
          actor: buildActorContext(
            'dashboard',
            { superAdmin: { id: admin.id, email: admin.email } },
            req
          ),
          targetType: 'settings',
          targetId: orgId,
          targetLabel: names.get(orgId) ?? 'the organization',
          metadata: { via: 'platform_action', change, ...metadata },
        }).catch((err) => console.error('[super-admin-ai-limits] activity mirror failed:', err))
      )
    );
  }
}

serveSuperAdmin('super-admin-ai-limits', async (req, admin) => {
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const view = url.searchParams.get('view') ?? 'matrix';
      if (view === 'profiles') return jsonSuccess(req, await loadProfilesOverview());
      if (view === 'org') {
        const orgId = url.searchParams.get('orgId')?.trim();
        if (!orgId) return jsonError(req, 'orgId is required', 400);
        return jsonSuccess(req, await loadOrgDetail(orgId));
      }
      if (view === 'matrix') return jsonSuccess(req, await loadMatrix(matrixFilters(url)));
      return jsonError(req, 'Unknown view', 400);
    }

    if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

    const stepUp = await requireSuperAdminStepUp(req, admin, 'ai_limits');
    if (stepUp) return stepUp;

    const body = await readJsonBody(req);
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'create_profile') {
      const input = parseProfileInput(body, 'create');
      const profile = await createProfile(input, admin.id);
      await logSuperAdminAction(admin, {
        action: 'ai.limit_profile_created',
        targetType: 'ai_limit_profile',
        targetId: profile.id,
        summary: `Created AI limit profile ${profile.code}`,
        metadata: { code: profile.code, limits: profile.limits },
      });
      return jsonSuccess(req, profile);
    }

    if (action === 'update_profile') {
      const id = typeof body.profileId === 'string' ? body.profileId : '';
      if (!id) return jsonError(req, 'profileId is required', 400);
      const input = parseProfileInput(body, 'update');
      const { before, after } = await updateProfile(id, input, admin.id);
      await logSuperAdminAction(admin, {
        action: 'ai.limit_profile_updated',
        targetType: 'ai_limit_profile',
        targetId: id,
        summary: `Updated AI limit profile ${after.code}`,
        metadata: { code: after.code, before: before.limits, after: after.limits },
      });
      return jsonSuccess(req, after);
    }

    if (action === 'delete_profile') {
      const id = typeof body.profileId === 'string' ? body.profileId : '';
      if (!id) return jsonError(req, 'profileId is required', 400);
      const profile = await deleteProfile(id);
      await logSuperAdminAction(admin, {
        action: 'ai.limit_profile_deleted',
        targetType: 'ai_limit_profile',
        targetId: id,
        summary: `Deleted AI limit profile ${profile.code}`,
        metadata: { code: profile.code },
      });
      return jsonSuccess(req, { deleted: true });
    }

    if (action === 'assign') {
      const scope = parseScope<AiLimitScope>(body.scope, [
        'organization',
        'property',
        'development',
      ]);
      const scopeIds = parseTargetIds(body.scopeIds);
      const profileId =
        body.profileId === null || body.profileId === undefined
          ? null
          : typeof body.profileId === 'string'
            ? body.profileId
            : (() => {
                throw new AiLimitAdminError('profileId must be a string or null');
              })();
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null;
      const orgMap = await organizationIdsForTargets(scope, scopeIds);
      const result = await assignProfile({ scope, scopeIds, profileId, note, adminId: admin.id });
      await logSuperAdminAction(admin, {
        action: profileId ? 'ai.limit_profile_assigned' : 'ai.limit_profile_unassigned',
        targetType: scope,
        targetId: scopeIds.length === 1 ? scopeIds[0] : null,
        summary: profileId
          ? `Assigned AI limit profile ${result.profile?.code} to ${scopeIds.length} ${scope}(s)`
          : `Removed the AI limit profile from ${scopeIds.length} ${scope}(s)`,
        metadata: { scope, count: scopeIds.length, scopeIds: scopeIds.slice(0, 20), note },
      });
      await mirrorToOrgs(req, admin, Array.from(orgMap.keys()), profileId ? 'updated' : 'reset', {
        profile: result.profile?.code ?? null,
        scope,
      });
      return jsonSuccess(req, { affected: result.affected, profile: result.profile });
    }

    if (action === 'set_overrides') {
      const scope = parseScope(body.scope, ['organization', 'property'] as const);
      const scopeIds = parseTargetIds(body.scopeIds);
      const limits = parseLimitsMap(
        body.limits,
        scope === 'organization' ? ORG_OVERRIDE_KEYS : PROPERTY_OVERRIDE_KEYS
      );
      if (Object.keys(limits).length === 0) return jsonError(req, 'limits is empty', 400);
      const reason = requireOverrideReason(limits, body.reason);
      const orgMap = await setOverrides({ scope, scopeIds, limits, reason, adminId: admin.id });
      const clearing = Object.values(limits).every((v) => v === null);
      await logSuperAdminAction(admin, {
        action: 'ai.limit_overrides_set',
        targetType: scope,
        targetId: scopeIds.length === 1 ? scopeIds[0] : null,
        summary: `${clearing ? 'Cleared' : 'Set'} AI limit overrides on ${scopeIds.length} ${scope}(s)`,
        metadata: {
          scope,
          count: scopeIds.length,
          scopeIds: scopeIds.slice(0, 20),
          limits,
          reason,
        },
      });
      await mirrorToOrgs(req, admin, Array.from(orgMap.keys()), clearing ? 'reset' : 'updated', {
        scope,
        fields: Object.keys(limits),
      });
      return jsonSuccess(req, { affected: scopeIds.length });
    }

    if (action === 'set_plan_profile') {
      const planId = typeof body.planId === 'string' ? body.planId : '';
      if (!planId) return jsonError(req, 'planId is required', 400);
      const profileId = typeof body.profileId === 'string' ? body.profileId : null;
      const plan = await setPlanProfile(planId, profileId);
      await logSuperAdminAction(admin, {
        action: 'ai.plan_profile_bound',
        targetType: 'pricing_plan',
        targetId: planId,
        summary: profileId
          ? `Bound AI limit profile ${plan.profile?.code} to the ${plan.name} plan`
          : `Unbound the AI limit profile from the ${plan.name} plan`,
        metadata: { plan: plan.code, profile: plan.profile?.code ?? null },
      });
      return jsonSuccess(req, {
        plan: { id: planId, code: plan.code, name: plan.name },
        profile: plan.profile,
      });
    }

    return jsonError(req, `Unknown action. Batches are capped at ${MAX_BULK_TARGETS}.`, 400);
  } catch (err) {
    if (err instanceof AiLimitAdminError) return jsonError(req, err.message, err.status);
    throw err;
  }
});
