import { addDays, format, parseISO } from 'date-fns';

import {
  isCancellationPolicyNonRefundable,
  type ResolvedCancellationPolicyDisplay,
} from '@/features/dashboard/org/lib/cancellationPolicy';

import { NoticeCallout } from '@/components/help/NoticeCallout';
import { Checkbox } from '@/components/ui/checkbox';

function daysLabel(days: number): string {
  if (days === 0) return 'check-in day';
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Compact policy card on the last booking step. The checkbox is the guest's
 * agreement record; the server stores `cancellation_policy_accepted_at`.
 */
export function GuestFormCancellationPolicy({
  policy,
  checkInDate,
  accepted,
  onAcceptedChange,
  showAgreement,
}: {
  policy: ResolvedCancellationPolicyDisplay;
  checkInDate: string;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  showAgreement: boolean;
}) {
  if (policy.unset) {
    return (
      <div className="border-border/80 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
        <p className="font-medium">Cancellation</p>
        <p className="text-muted-foreground mt-1">
          Your host has not set cancellation terms yet. Ask them before you book.
        </p>
      </div>
    );
  }

  const checkIn = parseISO(checkInDate);
  const validCheckIn = !Number.isNaN(checkIn.getTime());

  return (
    <div className="border-border/80 bg-card rounded-xl border px-4 py-4 shadow-sm">
      <p className="text-sm font-semibold">{policy.title}</p>
      <p className="text-muted-foreground mt-1 text-sm">{policy.description}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        {policy.needsReview
          ? 'Your host will confirm cancellation terms.'
          : 'Percentages apply to what you have paid.'}
      </p>

      {isCancellationPolicyNonRefundable(policy) ? (
        <NoticeCallout tone="warning" className="mt-3">
          This booking is non-refundable. You will not get back what you paid.
        </NoticeCallout>
      ) : null}

      {policy.timeline.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {policy.timeline.map((row) => (
            <li key={row.daysBefore} className="text-muted-foreground flex gap-2 text-sm">
              <span
                className={
                  row.refundPercent >= 100
                    ? 'mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500'
                    : row.refundPercent > 0
                      ? 'mt-1.5 size-2 shrink-0 rounded-full bg-amber-500'
                      : 'bg-muted-foreground/50 mt-1.5 size-2 shrink-0 rounded-full'
                }
                aria-hidden
              />
              <span>
                <span className="text-foreground font-medium">{row.refundPercent}% of paid</span>{' '}
                until{' '}
                {validCheckIn
                  ? format(addDays(checkIn, -row.daysBefore), 'MMM d, yyyy')
                  : `${daysLabel(row.daysBefore)} before check-in`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {showAgreement ? (
        <label className="border-border/70 mt-4 flex items-start gap-3 border-t pt-4 text-sm">
          <Checkbox
            checked={accepted}
            onCheckedChange={(checked) => onAcceptedChange(checked === true)}
            aria-describedby="cancellation-agreement-hint"
          />
          <span>
            <span className="block font-medium">I agree to the cancellation policy</span>
            <span id="cancellation-agreement-hint" className="text-muted-foreground mt-0.5 block text-xs">
              This is the policy that applies to this booking.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  );
}
