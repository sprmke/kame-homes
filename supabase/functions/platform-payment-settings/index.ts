/**
 * platform-payment-settings — Super-admin GET/PUT PayMongo rails + dunning config.
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
    enabledPaymentMethods: Array.isArray(row.enabled_payment_methods)
      ? row.enabled_payment_methods
      : [],
    enabledBanks: Array.isArray(row.enabled_banks) ? row.enabled_banks : [],
    renewalLinkLeadDays: Number(row.renewal_link_lead_days ?? 5),
    gracePeriodDays: Number(row.grace_period_days ?? 5),
    updatedAt: row.updated_at as string,
  };
}

serveSuperAdmin('platform-payment-settings', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'platform_payment_settings');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('platform_payment_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Payment settings not initialized', 500);
    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    requireHttpMethod(req, req.method);
    const body = await readJsonBody(req);

    const patch: Record<string, unknown> = { updated_by: user.id };
    if (Array.isArray(body.enabledPaymentMethods)) {
      patch.enabled_payment_methods = body.enabledPaymentMethods.filter(
        (m: unknown) => typeof m === 'string'
      );
    }
    if (Array.isArray(body.enabledBanks)) {
      patch.enabled_banks = body.enabledBanks.filter((b: unknown) => typeof b === 'string');
    }
    if (body.renewalLinkLeadDays != null) {
      const days = Number(body.renewalLinkLeadDays);
      if (!Number.isFinite(days) || days < 0 || days > 30) {
        return jsonError(req, 'renewalLinkLeadDays must be 0–30');
      }
      patch.renewal_link_lead_days = days;
    }
    if (body.gracePeriodDays != null) {
      const days = Number(body.gracePeriodDays);
      if (!Number.isFinite(days) || days < 0 || days > 30) {
        return jsonError(req, 'gracePeriodDays must be 0–30');
      }
      patch.grace_period_days = days;
    }

    const { data, error } = await supabase
      .from('platform_payment_settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) return jsonError(req, error.message, 500);

    await logSuperAdminAction(user, {
      action: 'platform.payment_settings_update',
      targetType: 'platform',
      targetId: 'platform_payment_settings',
      summary: 'Updated platform payment settings',
      metadata: { changed: Object.keys(patch).filter((k) => k !== 'updated_by') },
    });

    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  return jsonError(req, 'Method not allowed', 405);
});
