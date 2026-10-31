/**
 * parking-payouts — Super-admin payout ledger for paid parking bookings (Phase 4). Manual
 * disbursement only (`disbursement_method` stays 'manual' until real PayMongo Platforms
 * split-payout ships) — GET lists paid transactions, PATCH records a disbursement or clawback.
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

const LEDGER_LIMIT = 200;

function serializeRow(row: Record<string, unknown>) {
  const booking = row.guest_submissions as Record<string, unknown> | null | undefined;
  const parking = row.parkings as Record<string, unknown> | null | undefined;
  const organization = row.organizations as Record<string, unknown> | null | undefined;

  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    parkingId: row.parking_id as string,
    parkingName: (parking?.name as string | undefined) ?? null,
    organizationId: row.organization_id as string,
    organizationName: (organization?.name as string | undefined) ?? null,
    guestName: (booking?.primary_guest_name as string | undefined) ?? null,
    checkInDate:
      (booking?.parking_check_in_date as string | undefined) ??
      (booking?.check_in_date as string | undefined) ??
      null,
    checkOutDate:
      (booking?.parking_check_out_date as string | undefined) ??
      (booking?.check_out_date as string | undefined) ??
      null,
    nights: Number(row.nights ?? 0),
    guestChargeTotal: Number(row.guest_charge_total ?? 0),
    hostGrossTotal: Number(row.host_gross_total ?? 0),
    commissionPct: Number(row.commission_pct ?? 0),
    bookingChannel: (row.booking_channel as string | undefined) ?? 'standard',
    hostNetTotal: Number(row.host_net_total ?? 0),
    status: row.status as string,
    paidAt: (row.paid_at as string | undefined) ?? null,
    disbursedAt: (row.disbursed_at as string | undefined) ?? null,
    disbursementReference: (row.disbursement_reference as string | undefined) ?? null,
    disbursementMethod: (row.disbursement_method as string | undefined) ?? 'manual',
    clawbackAmount: row.clawback_amount == null ? null : Number(row.clawback_amount as number),
    clawbackReason: (row.clawback_reason as string | undefined) ?? null,
    clawbackAt: (row.clawback_at as string | undefined) ?? null,
  };
}

const SELECT_WITH_JOINS = `
  *,
  guest_submissions ( primary_guest_name, check_in_date, check_out_date, parking_check_in_date, parking_check_out_date ),
  parkings ( name ),
  organizations ( name )
`;

serveSuperAdmin('parking-payouts', async (req, admin) => {
  const stepUp = await requireSuperAdminStepUp(req, admin, 'parking_payout');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('parking_payment_transactions')
      .select(SELECT_WITH_JOINS)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(LEDGER_LIMIT);
    if (error) return jsonError(req, error.message, 500);

    return jsonSuccess(req, {
      transactions: (data ?? []).map((row) => serializeRow(row as Record<string, unknown>)),
    });
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const body = await readJsonBody(req);
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    if (!transactionId) return jsonError(req, 'transactionId is required');

    if (action === 'mark_disbursed') {
      const reference = typeof body.reference === 'string' ? body.reference.trim() || null : null;
      const { data, error } = await supabase
        .from('parking_payment_transactions')
        .update({
          disbursed_at: new Date().toISOString(),
          disbursed_by: admin.id,
          disbursement_reference: reference,
        })
        .eq('id', transactionId)
        .eq('status', 'paid')
        .select(SELECT_WITH_JOINS)
        .maybeSingle();
      if (error) return jsonError(req, error.message, 500);
      if (!data) return jsonError(req, 'Paid transaction not found', 404);
      await logSuperAdminAction(admin, {
        action: 'parking_payout.disburse',
        targetType: 'parking_payment_transaction',
        targetId: transactionId,
        summary: `Marked parking payout ${transactionId} as disbursed`,
        metadata: { reference },
      });
      return jsonSuccess(req, { transaction: serializeRow(data as Record<string, unknown>) });
    }

    if (action === 'record_clawback') {
      const amount = Number(body.amount);
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonError(req, 'amount must be a positive number');
      }
      if (!reason) return jsonError(req, 'reason is required');

      const { data, error } = await supabase
        .from('parking_payment_transactions')
        .update({
          clawback_amount: amount,
          clawback_reason: reason,
          clawback_at: new Date().toISOString(),
          clawback_by: admin.id,
        })
        .eq('id', transactionId)
        .eq('status', 'paid')
        .select(SELECT_WITH_JOINS)
        .maybeSingle();
      if (error) return jsonError(req, error.message, 500);
      if (!data) return jsonError(req, 'Paid transaction not found', 404);
      await logSuperAdminAction(admin, {
        action: 'parking_payout.clawback',
        targetType: 'parking_payment_transaction',
        targetId: transactionId,
        summary: `Recorded ₱${amount} clawback on parking payout ${transactionId}`,
        metadata: { amount, reason },
      });
      return jsonSuccess(req, { transaction: serializeRow(data as Record<string, unknown>) });
    }

    return jsonError(req, 'Unknown action', 400);
  }

  return jsonError(req, 'Method not allowed', 405);
});
