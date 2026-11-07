import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronRight, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  cancelGuestBooking,
  GUEST_TRIP_QUERY_KEY,
  GuestCancellationError,
  requestGuestCancellation,
  submitGuestRefundDetails,
  withdrawGuestCancellationRequest,
  type GuestTrip,
} from '@/features/guest/trip/lib/guestTripApi';

import { Button } from '@/components/ui/button';
import { NoticeCallout } from '@/components/help/NoticeCallout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney } from '@/utils/format/currency';
import { cn } from '@/lib/utils';

const REASONS = [
  { value: 'change_of_plans', label: 'Change of plans' },
  { value: 'found_another_place', label: 'Found another place' },
  { value: 'travel_issue', label: 'Travel issue' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

function formatManila(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function RefundDetailsForm({
  trip,
  onDone,
}: {
  trip: GuestTrip;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<'same_phone' | 'other_bank' | 'cash'>('same_phone');
  const [bank, setBank] = useState('GCash');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [phone, setPhone] = useState(trip.stay.phone);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await submitGuestRefundDetails({
        bookingId: trip.bookingId,
        method,
        bank: method === 'other_bank' ? bank : undefined,
        accountName: method === 'other_bank' ? accountName : undefined,
        accountNumber: method === 'other_bank' ? accountNumber : undefined,
        phone: method === 'same_phone' ? phone : undefined,
      });
      toast.success('Refund details saved');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Where should {formatMoney(trip.cancellation.refund?.amountPhp ?? 0)} be sent?
      </p>
      <div className="space-y-2">
        <Label htmlFor="refund-method">Method</Label>
        <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
          <SelectTrigger id="refund-method" className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="same_phone">GCash number on this booking</SelectItem>
            <SelectItem value="other_bank">Another account</SelectItem>
            <SelectItem value="cash">Cash pickup</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {method === 'same_phone' ? (
        <div className="space-y-2">
          <Label htmlFor="refund-phone">GCash number</Label>
          <Input
            id="refund-phone"
            value={phone}
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      ) : null}
      {method === 'other_bank' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="refund-bank">Bank</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger id="refund-bank" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GCash">GCash</SelectItem>
                <SelectItem value="GoTyme">GoTyme</SelectItem>
                <SelectItem value="Maribank">Maribank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-account-name">Account name</Label>
            <Input
              id="refund-account-name"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-account-number">Account number</Label>
            <Input
              id="refund-account-number"
              value={accountNumber}
              inputMode="numeric"
              onChange={(event) => setAccountNumber(event.target.value)}
            />
          </div>
        </div>
      ) : null}
      {method === 'cash' ? (
        <p className="text-muted-foreground text-sm">
          Your host will arrange the pickup with you.
        </p>
      ) : null}
      <Button type="button" className="min-h-[44px] w-full" onClick={submit} loading={saving}>
        Save refund details
      </Button>
    </div>
  );
}

export function GuestTripCancellationSection({
  trip,
  onChanged,
}: {
  trip: GuestTrip;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const cancellation = trip.cancellation;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'review' | 'refund'>('review');
  const [reason, setReason] = useState('change_of_plans');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const cancelled = trip.status === 'CANCELLED';
  const request = cancellation.request;
  const refund = cancellation.refund;
  const policy = cancellation.policy;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: GUEST_TRIP_QUERY_KEY });
    onChanged?.();
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (cancellation.canRequest) {
        await requestGuestCancellation({
          bookingId: trip.bookingId,
          reasonCode: reason,
          reasonNote: note,
        });
        toast.success('Request sent to your host');
        setOpen(false);
      } else {
        const result = await cancelGuestBooking({
          bookingId: trip.bookingId,
          reasonCode: reason,
          reasonNote: note,
        });
        toast.success('Booking cancelled');
        await refresh();
        if (result.outcome?.refundDuePhp > 0) {
          setStep('refund');
          return;
        }
        setOpen(false);
      }
      await refresh();
    } catch (err) {
      if (err instanceof GuestCancellationError && err.code === 'policy_changed') {
        toast.error('The host updated the cancellation policy. Review it and try again.');
        await refresh();
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not cancel this booking');
      }
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await withdrawGuestCancellationRequest(trip.bookingId);
      toast.success('Request withdrawn');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not withdraw the request');
    } finally {
      setBusy(false);
    }
  };

  if (cancelled) {
    if (!refund || refund.status === 'not_due') {
      return (
        <section className="border-border/70 rounded-2xl border p-4">
          <h2 className="text-sm font-semibold">Cancellation</h2>
          <p className="text-muted-foreground mt-1 text-sm">This booking was cancelled.</p>
        </section>
      );
    }
    const needsDetails = refund.status === 'awaiting_guest_details';
    return (
      <section className="border-border/70 rounded-2xl border p-4">
        <h2 className="text-sm font-semibold">Refund</h2>
        <p className="mt-1 text-lg font-semibold">{formatMoney(refund.amountPhp)}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {refund.status === 'sent'
            ? `Sent${refund.sentAt ? ` on ${formatManila(refund.sentAt)}` : ''}.`
            : 'Your host is preparing the refund.'}
        </p>
        {needsDetails ? (
          <div className="border-border/70 mt-4 border-t pt-4">
            <RefundDetailsForm trip={trip} onDone={() => void refresh()} />
          </div>
        ) : null}
      </section>
    );
  }

  if (request) {
    return (
      <section className="border-border/70 rounded-2xl border p-4">
        <h2 className="text-sm font-semibold">Cancellation requested</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Waiting for your host to review. Requested {formatManila(request.requestedAt)}.
        </p>
        {request.hostMessage ? (
          <p className="text-muted-foreground mt-2 text-sm">{request.hostMessage}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-[44px] w-full"
          onClick={withdraw}
          loading={busy}
        >
          <Undo2 className="mr-2 size-4" aria-hidden />
          Withdraw request
        </Button>
      </section>
    );
  }

  if (!cancellation.canCancel && !cancellation.canRequest) {
    if (!policy || policy.unset) return null;
    return (
      <section className="border-border/70 rounded-2xl border p-4">
        <h2 className="text-sm font-semibold">{policy.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{policy.description}</p>
      </section>
    );
  }

  const nextDeadline = cancellation.outcome.nextDeadline;

  return (
    <section className="border-border/70 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{policy.title || 'Cancellation policy'}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{policy.description}</p>
        </div>
      </div>

      {cancellation.nonRefundable ? (
        <NoticeCallout tone="warning" className="mt-3">
          This booking is non-refundable. You will not get back what you paid.
        </NoticeCallout>
      ) : null}

      {nextDeadline ? (
        <div className="bg-muted/40 mt-3 flex items-start gap-2 rounded-xl p-3 text-sm">
          <CalendarClock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {nextDeadline.refundPercent}% of paid until{' '}
            <span className="font-medium">{formatManila(nextDeadline.deadlineIso)}</span>
          </span>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">
            {cancellation.canRequest ? 'If your host approves' : 'If you cancel now'}
          </p>
          <p className="text-lg font-semibold">
            {cancellation.outcome.refundDuePhp > 0
              ? formatMoney(cancellation.outcome.refundDuePhp)
              : formatMoney(0)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => {
            setStep('review');
            setConfirmed(false);
            setOpen(true);
          }}
        >
          {cancellation.canRequest ? 'Request to cancel' : 'Cancel booking'}
          <ChevronRight className="ml-1 size-4" aria-hidden />
        </Button>
      </div>

      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next) setStep('review');
          setOpen(next);
        }}
      >
        <ResponsiveModalContent sheetLayout="split">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {step === 'refund'
                ? 'Refund details'
                : cancellation.canRequest
                  ? 'Request to cancel'
                  : 'Cancel booking'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {step === 'refund' ? (
              <RefundDetailsForm
                trip={trip}
                onDone={() => {
                  setOpen(false);
                  setStep('review');
                  void refresh();
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/40 rounded-xl p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-medium">
                      {formatMoney(cancellation.outcome.amountPaidPhp)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Non-refundable</span>
                    <span className="font-medium">
                      {formatMoney(cancellation.outcome.retainedPhp)}
                    </span>
                  </div>
                  <div className="border-border/70 mt-2 flex items-center justify-between border-t pt-2 text-sm">
                    <span className="font-medium">Refund</span>
                    <span className="text-base font-semibold">
                      {formatMoney(cancellation.outcome.refundDuePhp)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="cancel-reason" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cancel-note">Note (optional)</Label>
                  <Input
                    id="cancel-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Anything your host should know"
                  />
                </div>

                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 size-4 rounded border"
                  />
                  <span>
                    {cancellation.canRequest
                      ? 'I understand this sends a request and my host decides.'
                      : 'I understand this cancels my booking.'}
                  </span>
                </label>
              </div>
            )}
          </div>

          {step === 'review' ? (
            <ResponsiveModalFooter className="border-border/60 flex gap-2 border-t px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] flex-1 sm:flex-none"
                onClick={() => setOpen(false)}
              >
                Keep booking
              </Button>
              <Button
                type="button"
                variant={cancellation.canRequest ? 'default' : 'destructive'}
                className={cn('min-h-[44px] flex-1 sm:ml-auto sm:flex-none')}
                disabled={!confirmed}
                loading={busy}
                onClick={submit}
              >
                {cancellation.canRequest ? 'Send request' : 'Cancel booking'}
              </Button>
            </ResponsiveModalFooter>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </section>
  );
}
