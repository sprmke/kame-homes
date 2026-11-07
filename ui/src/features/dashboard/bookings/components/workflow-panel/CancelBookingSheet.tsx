import { useMemo, useState } from 'react';

import { AlertTriangle } from 'lucide-react';

import {
  cancellationMoneyInputFromBooking,
  computeCancellationOutcome,
} from '@/features/guest/trip/lib/cancellationRefund';
import { readCancellationPolicySnapshot } from '@/features/dashboard/org/lib/cancellationPolicy';
import type { CancelBookingInput } from '@/features/dashboard/bookings/hooks/useTransitionBooking';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/utils/format/currency';
import { cn } from '@/lib/utils';

const REASONS = [
  { value: 'change_of_plans', label: 'Guest changed plans' },
  { value: 'found_another_place', label: 'Guest found another place' },
  { value: 'travel_issue', label: 'Travel issue' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'no_show', label: 'No-show' },
  { value: 'no_payment', label: 'No payment received' },
  { value: 'duplicate_or_test', label: 'Duplicate or test booking' },
  { value: 'host_unavailable', label: 'I cannot host this stay' },
  { value: 'other', label: 'Other' },
];

export function CancelBookingSheet({
  open,
  onOpenChange,
  booking,
  checkInTime,
  defaultInitiator = 'host',
  defaultReasonCode,
  defaultReasonNote,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Record<string, unknown>;
  checkInTime: string;
  defaultInitiator?: 'guest' | 'host';
  defaultReasonCode?: string;
  defaultReasonNote?: string | null;
  isPending: boolean;
  onConfirm: (input: CancelBookingInput) => Promise<void>;
}) {
  const [initiator, setInitiator] = useState<'guest' | 'host'>(defaultInitiator);
  const [reasonCode, setReasonCode] = useState(defaultReasonCode ?? 'change_of_plans');
  const [reasonNote, setReasonNote] = useState(defaultReasonNote ?? '');
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [notifyGuest, setNotifyGuest] = useState(true);

  const snapshot = useMemo(
    () => readCancellationPolicySnapshot(booking.cancellation_policy_snapshot),
    [booking.cancellation_policy_snapshot]
  );

  const outcome = useMemo(() => {
    const parsedOverride =
      overrideEnabled && overrideAmount.trim() !== '' ? Number(overrideAmount) : null;
    return computeCancellationOutcome({
      policy: snapshot?.policy ?? null,
      booking: cancellationMoneyInputFromBooking(booking),
      cancelledAt: new Date().toISOString(),
      checkInTime,
      initiator,
      overrideRefundPhp: parsedOverride,
    });
  }, [booking, checkInTime, initiator, overrideAmount, overrideEnabled, snapshot]);

  const overrideInvalid =
    overrideEnabled && (overrideAmount.trim() === '' || !Number.isFinite(Number(overrideAmount)));
  const needsNote = initiator === 'host' && reasonCode === 'other' && !reasonNote.trim();
  const overrideNeedsNote = overrideEnabled && !overrideNote.trim();
  const canConfirm = !overrideInvalid && !needsNote && !overrideNeedsNote;

  const submit = async () => {
    if (!canConfirm) return;
    await onConfirm({
      bookingId: String(booking.id),
      initiator,
      reasonCode,
      reasonNote: reasonNote.trim(),
      refundOverridePhp: overrideEnabled ? Number(overrideAmount) : null,
      overrideNote: overrideEnabled ? overrideNote.trim() : undefined,
      notifyGuest,
    });
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent sheetLayout="split">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Cancel booking</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-2">
            <Label>Who asked?</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['guest', 'host'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInitiator(value)}
                  className={cn(
                    'min-h-[44px] rounded-xl border px-3 text-sm font-medium',
                    initiator === value ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  {value === 'guest' ? 'Guest asked' : "I'm cancelling"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
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
            <Label htmlFor="cancel-reason-note">
              Note {initiator === 'host' && reasonCode === 'other' ? '' : '(optional)'}
            </Label>
            <Textarea
              id="cancel-reason-note"
              value={reasonNote}
              rows={2}
              onChange={(event) => setReasonNote(event.target.value)}
            />
          </div>

          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Refund preview
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>{formatMoney(outcome.amountPaidPhp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Non-refundable</span>
                <span>{formatMoney(outcome.retainedPhp)}</span>
              </div>
              <div className="border-border/70 mt-1 flex justify-between border-t pt-1 font-semibold">
                <span>Refund</span>
                <span>{formatMoney(outcome.refundDuePhp)}</span>
              </div>
            </div>
            {outcome.appliedRule ? (
              <p className="text-muted-foreground mt-2 text-xs">{outcome.appliedRule.label}</p>
            ) : null}
            {outcome.mode === 'host_decides' ? (
              <p className="text-muted-foreground mt-2 text-xs">
                No enforceable policy on this booking. Set the refund yourself.
              </p>
            ) : null}
            {outcome.warnings.map((warning) => (
              <p key={warning} className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {warning}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={overrideEnabled}
                onCheckedChange={(checked) => setOverrideEnabled(checked === true)}
              />
              Override the refund
            </label>
            {overrideEnabled ? (
              <div className="space-y-2">
                <Input
                  value={overrideAmount}
                  inputMode="decimal"
                  placeholder="Refund amount"
                  onChange={(event) => setOverrideAmount(event.target.value)}
                  aria-label="Refund amount"
                />
                <Input
                  value={overrideNote}
                  placeholder="Why is the amount different?"
                  onChange={(event) => setOverrideNote(event.target.value)}
                  aria-label="Override note"
                />
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={notifyGuest}
              onCheckedChange={(checked) => setNotifyGuest(checked === true)}
            />
            Email the guest
          </label>
        </div>

        <ResponsiveModalFooter className="border-border/60 flex gap-2 border-t px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1 sm:flex-none"
            onClick={() => onOpenChange(false)}
          >
            Keep booking
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-[44px] flex-1 sm:ml-auto sm:flex-none"
            disabled={!canConfirm}
            loading={isPending}
            onClick={() => void submit()}
          >
            Cancel booking
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
