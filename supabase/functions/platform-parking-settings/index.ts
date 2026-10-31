/**
 * platform-parking-settings — Super-admin GET/PUT commission % + guest rate config for the
 * parkings vertical (Phase 4). Values are read live by `resolveParkingPlatformSettings()`
 * (`_shared/parkingPlatformSettings.ts`) and snapshotted onto `parking_payment_transactions` at
 * checkout-creation time — changing them here never touches an already-created transaction.
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
    commissionPct: Number(row.commission_pct ?? 0.1),
    directCommissionPct: Number(row.direct_commission_pct ?? 0.05),
    guestRateWeekday: Number(row.guest_rate_weekday ?? 400),
    guestRateWeekend: Number(row.guest_rate_weekend ?? 400),
    supportEscalationPhone: (row.support_escalation_phone as string | undefined)?.trim() || null,
    updatedAt: row.updated_at as string,
  };
}

serveSuperAdmin('platform-parking-settings', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'platform_parking_settings');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('platform_parking_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Parking settings not initialized', 500);
    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    requireHttpMethod(req, req.method);
    const body = await readJsonBody(req);

    const patch: Record<string, unknown> = { updated_by: user.id };
    if (body.commissionPct != null) {
      const pct = Number(body.commissionPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
        return jsonError(req, 'commissionPct must be between 0 and 1');
      }
      patch.commission_pct = pct;
    }
    if (body.directCommissionPct != null) {
      const pct = Number(body.directCommissionPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
        return jsonError(req, 'directCommissionPct must be between 0 and 1');
      }
      patch.direct_commission_pct = pct;
    }
    if (body.guestRateWeekday != null) {
      const rate = Number(body.guestRateWeekday);
      if (!Number.isFinite(rate) || rate < 0) {
        return jsonError(req, 'guestRateWeekday must be a non-negative number');
      }
      patch.guest_rate_weekday = rate;
    }
    if (body.guestRateWeekend != null) {
      const rate = Number(body.guestRateWeekend);
      if (!Number.isFinite(rate) || rate < 0) {
        return jsonError(req, 'guestRateWeekend must be a non-negative number');
      }
      patch.guest_rate_weekend = rate;
    }
    if (body.supportEscalationPhone != null) {
      patch.support_escalation_phone = String(body.supportEscalationPhone).trim() || null;
    }

    const { data, error } = await supabase
      .from('platform_parking_settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) return jsonError(req, error.message, 500);

    await logSuperAdminAction(user, {
      action: 'platform.parking_settings_update',
      targetType: 'platform',
      targetId: 'platform_parking_settings',
      summary: 'Updated platform parking settings',
      metadata: { changed: Object.keys(patch).filter((k) => k !== 'updated_by') },
    });

    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  return jsonError(req, 'Method not allowed', 405);
});
