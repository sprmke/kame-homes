/**
 * cancellation-refund-cron — daily sweep for refunds that need a nudge and
 * cancellation requests that expired at check-in.
 *
 * Runs via hosted pg_cron + pg_net. Secret: CANCELLATION_REFUND_CRON_SECRET
 * (header `x-cancellation-refund-cron-secret`).
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { expireStaleCancellationRequests } from '../_shared/cancellationService.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { createNotification } from '../_shared/notificationService.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

const PENDING_AFTER_DAYS = 3;
const AWAITING_DETAILS_AFTER_DAYS = 2;

function verifyCancellationRefundCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'CANCELLATION_REFUND_CRON_SECRET',
    headerName: 'x-cancellation-refund-cron-secret',
  });
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

serveCronPost('cancellation-refund-cron', verifyCancellationRefundCronSecret, async () => {
  const expiredRequests = await expireStaleCancellationRequests();
  const sb = createServiceClient();

  const { data: refunds } = await sb
    .from('booking_refunds')
    .select('id, booking_id, property_id, organization_id, status, amount_due_php, created_at, guest_submissions(primary_guest_name)')
    .in('status', ['pending', 'awaiting_guest_details'])
    .lt('created_at', daysAgoIso(AWAITING_DETAILS_AFTER_DAYS))
    .limit(500);

  let nudged = 0;
  const byOrg = new Map<string, number>();

  for (const row of (refunds ?? []) as Array<Record<string, unknown>>) {
    const status = String(row.status);
    const createdAt = String(row.created_at ?? '');
    const threshold =
      status === 'pending' ? daysAgoIso(PENDING_AFTER_DAYS) : daysAgoIso(AWAITING_DETAILS_AFTER_DAYS);
    if (createdAt >= threshold) continue;

    const organizationId = String(row.organization_id ?? '');
    if (!organizationId) continue;
    const bookingId = String(row.booking_id);
    const guest = row.guest_submissions as Record<string, unknown> | undefined;
    const guestName = String(guest?.primary_guest_name ?? '').trim() || 'A guest';

    await createNotification({
      organizationId,
      propertyId: String(row.property_id),
      type: 'booking_refund_due',
      title: status === 'pending' ? 'Refund still pending' : 'Waiting for refund details',
      body:
        status === 'pending'
          ? `Send ${guestName}'s refund and mark it sent.`
          : `${guestName} has not added refund details yet.`,
      bookingId,
      metadata: { refund_id: String(row.id), amount_due_php: Number(row.amount_due_php ?? 0) },
      dedupeKey: `${bookingId}:refund_due:${new Date().toISOString().slice(0, 10)}`,
    });
    nudged += 1;
    byOrg.set(organizationId, (byOrg.get(organizationId) ?? 0) + 1);
  }

  for (const [organizationId, count] of byOrg) {
    await logActivity({
      action: 'system.cron_run',
      organizationId,
      actor: buildActorContext('cron', { cron: 'cancellation-refund-cron' }),
      metadata: {
        message: 'Cancellation refund cron finished',
        count,
        refunds_nudged: count,
        requests_expired: expiredRequests,
      },
    });
  }

  return { refundsNudged: nudged, requestsExpired: expiredRequests };
});
