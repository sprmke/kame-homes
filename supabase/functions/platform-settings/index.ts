/**
 * platform-settings — Super-admin GET/PUT for the `platform_settings` singleton:
 * signups on/off, maintenance mode + message, default plan code, support email,
 * legal URLs, public rate-limit ceiling, authenticated-wrapper rate-limit
 * enforcement switch + limit (doc 23). UI: `/admin/platform-settings`.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

function serialize(row: Record<string, unknown>) {
  return {
    defaultPlanCode: (row.default_plan_code as string | null) ?? null,
    signupsEnabled: row.signups_enabled !== false,
    maintenanceMode: row.maintenance_mode === true,
    maintenanceMessage: (row.maintenance_message as string | null) ?? null,
    supportEmail: (row.support_email as string | null) ?? null,
    legalTermsUrl: (row.legal_terms_url as string | null) ?? null,
    legalPrivacyUrl: (row.legal_privacy_url as string | null) ?? null,
    publicRateLimitPerMin: Number(row.public_rate_limit_per_min ?? 60),
    authenticatedRateLimitEnforce: row.authenticated_rate_limit_enforce === true,
    authenticatedRateLimitPerMin: Number(row.authenticated_rate_limit_per_min ?? 300),
    hostRewardEnabled: row.host_reward_enabled === true,
    hostRewardPlanCode: (row.host_reward_plan_code as string | null) ?? 'growth',
    hostRewardDurationDays: Number(row.host_reward_duration_days ?? 30),
    hostRewardTrigger:
      row.host_reward_trigger === 'recommended_verification_submitted'
        ? 'recommended_verification_submitted'
        : 'recommended_verification_approved',
    hostRewardCampaignStart: (row.host_reward_campaign_start as string | null) ?? null,
    hostRewardCampaignEnd: (row.host_reward_campaign_end as string | null) ?? null,
    hostRewardMaxPerOrg: Number(row.host_reward_max_per_org ?? 1),
    hostRewardApplyToPaidOrg: row.host_reward_apply_to_paid_org === 'extend' ? 'extend' : 'skip',
    updatedAt: row.updated_at as string,
  };
}

function trimmedOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : null;
}

serveSuperAdmin('platform-settings', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'platform_settings');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Platform settings not initialized', 500);
    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    requireHttpMethod(req, req.method);
    const body = await readJsonBody(req);
    const patch: Record<string, unknown> = { updated_by: user.id };

    if (body.signupsEnabled !== undefined) {
      if (typeof body.signupsEnabled !== 'boolean') {
        return jsonError(req, 'signupsEnabled must be a boolean');
      }
      patch.signups_enabled = body.signupsEnabled;
    }
    if (body.maintenanceMode !== undefined) {
      if (typeof body.maintenanceMode !== 'boolean') {
        return jsonError(req, 'maintenanceMode must be a boolean');
      }
      patch.maintenance_mode = body.maintenanceMode;
    }
    const maintenanceMessage = trimmedOrNull(body.maintenanceMessage);
    if (maintenanceMessage !== undefined) patch.maintenance_message = maintenanceMessage;
    const defaultPlanCode = trimmedOrNull(body.defaultPlanCode);
    if (defaultPlanCode !== undefined) patch.default_plan_code = defaultPlanCode;
    const supportEmail = trimmedOrNull(body.supportEmail);
    if (supportEmail !== undefined) patch.support_email = supportEmail;
    const legalTermsUrl = trimmedOrNull(body.legalTermsUrl);
    if (legalTermsUrl !== undefined) patch.legal_terms_url = legalTermsUrl;
    const legalPrivacyUrl = trimmedOrNull(body.legalPrivacyUrl);
    if (legalPrivacyUrl !== undefined) patch.legal_privacy_url = legalPrivacyUrl;
    if (body.publicRateLimitPerMin != null) {
      const n = Number(body.publicRateLimitPerMin);
      if (!Number.isInteger(n) || n < 1 || n > 10_000) {
        return jsonError(req, 'publicRateLimitPerMin must be 1–10000');
      }
      patch.public_rate_limit_per_min = n;
    }
    if (body.authenticatedRateLimitEnforce !== undefined) {
      if (typeof body.authenticatedRateLimitEnforce !== 'boolean') {
        return jsonError(req, 'authenticatedRateLimitEnforce must be a boolean');
      }
      patch.authenticated_rate_limit_enforce = body.authenticatedRateLimitEnforce;
    }
    if (body.authenticatedRateLimitPerMin != null) {
      const n = Number(body.authenticatedRateLimitPerMin);
      if (!Number.isInteger(n) || n < 1 || n > 100_000) {
        return jsonError(req, 'authenticatedRateLimitPerMin must be 1–100000');
      }
      patch.authenticated_rate_limit_per_min = n;
    }

    if (body.hostRewardEnabled !== undefined) {
      if (typeof body.hostRewardEnabled !== 'boolean') {
        return jsonError(req, 'hostRewardEnabled must be a boolean');
      }
      patch.host_reward_enabled = body.hostRewardEnabled;
    }
    const hostRewardPlanCode = trimmedOrNull(body.hostRewardPlanCode);
    if (hostRewardPlanCode !== undefined) {
      const { data: planRow, error: planError } = await supabase
        .from('pricing_plans')
        .select('id')
        .eq('code', hostRewardPlanCode)
        .eq('is_active', true)
        .maybeSingle();
      if (planError) return jsonError(req, planError.message, 500);
      if (!planRow) return jsonError(req, 'hostRewardPlanCode must match an active pricing plan');
      patch.host_reward_plan_code = hostRewardPlanCode;
    }
    if (body.hostRewardDurationDays != null) {
      const n = Number(body.hostRewardDurationDays);
      if (!Number.isInteger(n) || n < 1 || n > 366) {
        return jsonError(req, 'hostRewardDurationDays must be 1–366');
      }
      patch.host_reward_duration_days = n;
    }
    if (body.hostRewardTrigger !== undefined) {
      if (
        body.hostRewardTrigger !== 'recommended_verification_submitted' &&
        body.hostRewardTrigger !== 'recommended_verification_approved'
      ) {
        return jsonError(
          req,
          'hostRewardTrigger must be recommended_verification_submitted or recommended_verification_approved'
        );
      }
      patch.host_reward_trigger = body.hostRewardTrigger;
    }
    if (body.hostRewardCampaignStart !== undefined) {
      if (
        body.hostRewardCampaignStart !== null &&
        typeof body.hostRewardCampaignStart !== 'string'
      ) {
        return jsonError(req, 'hostRewardCampaignStart must be a string or null');
      }
      patch.host_reward_campaign_start = body.hostRewardCampaignStart;
    }
    if (body.hostRewardCampaignEnd !== undefined) {
      if (body.hostRewardCampaignEnd !== null && typeof body.hostRewardCampaignEnd !== 'string') {
        return jsonError(req, 'hostRewardCampaignEnd must be a string or null');
      }
      patch.host_reward_campaign_end = body.hostRewardCampaignEnd;
    }
    if (body.hostRewardMaxPerOrg != null) {
      const n = Number(body.hostRewardMaxPerOrg);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return jsonError(req, 'hostRewardMaxPerOrg must be 1–100');
      }
      patch.host_reward_max_per_org = n;
    }
    if (body.hostRewardApplyToPaidOrg !== undefined) {
      if (body.hostRewardApplyToPaidOrg !== 'skip' && body.hostRewardApplyToPaidOrg !== 'extend') {
        return jsonError(req, 'hostRewardApplyToPaidOrg must be skip or extend');
      }
      patch.host_reward_apply_to_paid_org = body.hostRewardApplyToPaidOrg;
    }

    const { data, error } = await supabase
      .from('platform_settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) return jsonError(req, error.message, 500);

    await logSuperAdminAction(user, {
      action: 'platform.settings_update',
      targetType: 'platform',
      targetId: 'platform_settings',
      summary: 'Updated platform settings',
      metadata: { changed: Object.keys(patch).filter((k) => k !== 'updated_by') },
    });

    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  return jsonError(req, 'Method not allowed', 405);
});
