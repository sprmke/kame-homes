import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CalendarClock, Check } from 'lucide-react';
import { toast } from 'sonner';

import {
  useRecordBookingRefund,
  useRespondCancellationRequest,
} from '@/features/dashboard/bookings/hooks/useTransitionBooking';
import { CancelBookingSheet } from '@/features/dashboard/bookings/components/workflow-panel/CancelBookingSheet';
import {
  readCancellationPolicySnapshot,
  resolveCancellationPolicyDisplay,
} from '@/features/dashboard/org/lib/cancellationPolicy';
import {
  cancellationMoneyInputFromBooking,
  computeCancellationOutcome,
} from '@/features/guest/trip/lib/cancellationRefund';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/utils/format/currency';

const REASON_LABELS: Record<string, string> = {
  change_of_plans: 'Change of plans',
  found_another_place: 'Found another place',
  travel_issue: 'Travel issue',
  emergency: 'Emergency',
  no_show: 'No-show',
  no_payment: 'No payment received',
  duplicate_or_test: 'Duplicate or test booking',
  host_unavailable: 'Host cannot host',
  other: 'Other',
};

function useBookingCancellation(bookingId: string) {
  return useQuery({
    queryKey: ['booking-cancellation', bookingId],
    queryFn: async () => {
      const [requests, refunds] = await Promise.all([
        supabase
          .from('booking_cancellation_requests')
          .select('*')
          .eq('booking_id', bookingId)
          .order('requested_at', { ascending: false })
          .limit(5),
        supabase
          .from('booking_refunds')
          .select('*')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false }),
      ]);
      return {
        requests: (requests.data ?? []) as Array<Record<string, unknown>>,
        refunds: (refunds.data ?? []) as Array<Record<string, unknown>>,
      };
    },
    staleTime: 10_000,
  });
}

export function BookingCancellationCard({
  booking,
  checkInTime,
  currentPolicyVersionId,
  canEdit,
}: {
  booking: Record<string, unknown>;
  checkInTime: string;
  currentPolicyVersionId?: string | null;
  canEdit: boolean;
}) {
  const bookingId = String(booking.id ?? '');
  const { data, refetch } = useBookingCancellation(bookingId);
  const respond = useRespondCancellationRequest(bookingId);
  const recordRefund = useRecordBookingRefund(bookingId);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineMessage, setDeclineMessage] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [sentAmount, setSentAmount] = useState('');

  const snapshot = readCancellationPolicySnapshot(booking.cancellation_policy_snapshot);
  const policy = snapshot?.policy ?? null;
  const display = resolveCancellationPolicyDisplay(policy);
  const outcome = computeCancellationOutcome({
    policy,
    booking: cancellationMoneyInputFromBooking(booking),
    cancelledAt: new Date().toISOString(),
    checkInTime,
    initiator: 'guest',
  });

  const openRequest = (data?.requests ?? []).find((row) => row.status === 'open');
  const refund = (data?.refunds ?? []).find((row) => row.kind === 'cancellation');
  const goodwill = (data?.refunds ?? []).filter((row) => row.kind === 'goodwill');
  const policyChanged =
    Boolean(currentPolicyVersionId) &&
    Boolean(snapshot?.propertyPolicyVersionId) &&
    currentPolicyVersionId !== snapshot?.propertyPolicyVersionId;

  const approve = async (input?: {
    refundOverridePhp?: number | null;
    overrideNote?: string;
  }) => {
    if (!openRequest) return;
    try {
      await respond.mutateAsync({
        requestId: String(openRequest.id),
        action: 'approve',
        refundOverridePhp: input?.refundOverridePhp ?? null,
        overrideNote: input?.overrideNote,
      });
      toast.success('Cancellation approved');
      setApproveOpen(false);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not approve');
    }
  };

  const decline = async () => {
    if (!openRequest || !declineMessage.trim()) return;
    try {
      await respond.mutateAsync({
        requestId: String(openRequest.id),
        action: 'decline',
        hostMessage: declineMessage.trim(),
      });
      toast.success('Request declined');
      setDeclineOpen(false);
      setDeclineMessage('');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decline');
    }
  };

  const markSent = async () => {
    if (!refund) return;
    if (!proofUrl.trim()) {
      toast.error('Add a receipt link');
      return;
    }
    try {
      await recordRefund.mutateAsync({
        action: 'mark_sent',
        proofUrl: proofUrl.trim(),
        amountPaidPhp: sentAmount.trim() ? Number(sentAmount) : Number(refund.amount_due_php),
      });
      toast.success('Refund marked sent');
      setProofUrl('');
      setSentAmount('');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark the refund sent');
    }
  };

  if (!policy && !openRequest && !refund && goodwill.length === 0) return null;

  return (
    <section className="border-border/70 space-y-4 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Cancellation</h2>
          <p className="text-muted-foreground text-xs">{display.title}</p>
        </div>
        {policyChanged ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700">
            <AlertTriangle className="size-3" aria-hidden />
            Policy changed
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">{display.description}</p>

      {policy && booking.status !== 'CANCELLED' ? (
        <div className="bg-muted/40 flex items-start gap-2 rounded-xl p-3 text-sm">
          <CalendarClock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {outcome.appliedRule?.label ?? 'No refund at this time'}
            {outcome.nextDeadline ? (
              <>
                {' '}
                · next deadline{' '}
                {format(new Date(outcome.nextDeadline.deadlineIso), 'MMM d, yyyy h:mm a')}
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      {openRequest ? (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div>
            <p className="text-sm font-medium">Guest asked to cancel</p>
            <p className="text-muted-foreground text-xs">
              {REASON_LABELS[String(openRequest.reason_code)] ?? 'Cancellation'} ·{' '}
              {format(new Date(String(openRequest.requested_at)), 'MMM d, h:mm a')}
            </p>
            {openRequest.reason_note ? (
              <p className="text-muted-foreground mt-1 text-sm">{String(openRequest.reason_note)}</p>
            ) : null}
          </div>
          {canEdit ? (
            declineOpen ? (
              <div className="space-y-2">
                <Textarea
                  value={declineMessage}
                  rows={2}
                  placeholder="Tell the guest why"
                  onChange={(event) => setDeclineMessage(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] flex-1"
                    onClick={() => setDeclineOpen(false)}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-[44px] flex-1"
                    disabled={!declineMessage.trim()}
                    loading={respond.isPending}
                    onClick={() => void decline()}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] flex-1"
                  onClick={() => setDeclineOpen(true)}
                >
                  Decline
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] flex-1"
                  onClick={() => setApproveOpen(true)}
                >
                  Approve
                </Button>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {refund ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Refund</span>
            <span className="font-semibold">{formatMoney(Number(refund.amount_due_php ?? 0))}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            {refund.status === 'sent'
              ? `Sent${refund.sent_at ? ` ${format(new Date(String(refund.sent_at)), 'MMM d, yyyy')}` : ''}`
              : refund.status === 'awaiting_guest_details'
                ? 'Waiting for the guest to add payout details'
                : refund.status === 'not_due'
                  ? 'No refund due'
                  : 'Ready to send'}
          </p>
          {canEdit && refund.status !== 'sent' && refund.status !== 'not_due' ? (
            <div className="space-y-2 pt-1">
              <Label htmlFor="refund-proof">Receipt link</Label>
              <Input
                id="refund-proof"
                value={proofUrl}
                placeholder="https://…"
                onChange={(event) => setProofUrl(event.target.value)}
              />
              <Input
                value={sentAmount}
                inputMode="decimal"
                placeholder={`Amount sent (${formatMoney(Number(refund.amount_due_php ?? 0))})`}
                onChange={(event) => setSentAmount(event.target.value)}
                aria-label="Amount sent"
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                loading={recordRefund.isPending}
                onClick={() => void markSent()}
              >
                <Check className="mr-2 size-4" aria-hidden />
                Mark refund sent
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {goodwill.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium">Goodwill refunds</p>
          {goodwill.map((row) => (
            <div key={String(row.id)} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {format(new Date(String(row.created_at)), 'MMM d, yyyy')}
              </span>
              <span>{formatMoney(Number(row.amount_due_php ?? 0))}</span>
            </div>
          ))}
        </div>
      ) : null}

      {openRequest ? (
        <CancelBookingSheet
          open={approveOpen}
          onOpenChange={setApproveOpen}
          booking={booking}
          checkInTime={checkInTime}
          defaultInitiator="guest"
          defaultReasonCode={String(openRequest.reason_code ?? 'other')}
          defaultReasonNote={openRequest.reason_note ? String(openRequest.reason_note) : null}
          isPending={respond.isPending}
          onConfirm={async (input) => {
            await approve({
              refundOverridePhp: input.refundOverridePhp,
              overrideNote: input.overrideNote,
            });
          }}
        />
      ) : null}
    </section>
  );
}
