import { Link } from 'react-router-dom';

import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import type { GuestPaymentMethod } from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { guestSdFormPath } from '@/features/guest/lib/guestPublicPaths';
import { GuestTripRow, GuestTripSection } from '@/features/guest/trip/components/GuestTripSection';
import type { GuestTrip } from '@/features/guest/trip/lib/guestTripApi';
import { guestTripMessageHostPath } from '@/features/guest/trip/lib/guestTripLinks';
import { isGuestTripActive, type GuestTripPhase } from '@/features/guest/trip/lib/guestTripPhase';

import { Button } from '@/components/ui/button';
import { formatMoney } from '@/utils/format/currency';

function positive(value: number | null | undefined): value is number {
  return value != null && value > 0;
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy');
  }
}

function PaymentMethodRow({ method }: { method: GuestPaymentMethod }) {
  return (
    <li className="bg-muted/50 flex items-center gap-3 rounded-2xl p-3">
      {method.qrImageUrl ? (
        <a
          href={method.qrImageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-visible:ring-ring shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2"
          aria-label={`Open ${method.provider} QR code`}
        >
          <img
            src={method.qrImageUrl}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            className="size-14 rounded-lg bg-white object-contain p-1"
          />
        </a>
      ) : null}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{method.provider}</p>
        {method.accountName ? (
          <p className="text-muted-foreground truncate text-xs">{method.accountName}</p>
        ) : null}
        {method.accountNumber ? (
          <p className="font-mono text-sm tabular-nums">{method.accountNumber}</p>
        ) : null}
      </div>
      {method.accountNumber ? (
        <button
          type="button"
          onClick={() => void copyText(method.accountNumber, 'Account number')}
          className="text-muted-foreground hover:text-foreground hover:bg-background flex size-11 shrink-0 items-center justify-center rounded-xl"
          aria-label={`Copy ${method.provider} account number ${method.accountNumber}`}
        >
          <Copy className="size-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/** Where the security deposit stands, in the guest's words. */
function depositStatus(trip: GuestTrip, phase: GuestTripPhase): string | null {
  if (trip.payment.isAirbnb || !positive(trip.payment.securityDeposit)) return null;
  if (trip.refund.amount != null) return `Refunded ${formatMoney(trip.refund.amount)}`;
  if (phase === 'refund_pending') return 'Refund in progress';
  if (phase === 'checked_out') {
    return trip.actions.sdFormAvailable ? 'Send your refund details' : 'Refund pending';
  }
  if (phase === 'completed') return 'Settled';
  if (phase === 'cancelled') return null;
  return 'Refundable after check-out';
}

/**
 * Charges, what's been paid, and what's left, so "left to pay" never needs mental math.
 * Formula matches emails / admin: charges − down payment − recorded balance payments.
 */
export function GuestTripPaymentSection({
  trip,
  phase,
  paymentMethods,
}: {
  trip: GuestTrip;
  phase: GuestTripPhase;
  paymentMethods: GuestPaymentMethod[];
}) {
  const { payment } = trip;
  // Rates are set by the host during review; nothing meaningful to show yet.
  if (phase === 'requested' || !payment.ratesConfirmed) return null;

  const deposit = payment.isAirbnb ? 0 : (payment.securityDeposit ?? 0);
  const stay = payment.isAirbnb ? 0 : (payment.bookingRate ?? 0);
  const fees = (payment.petFee ?? 0) + (payment.additionalFee ?? 0);
  const down = payment.isAirbnb ? 0 : (payment.downPayment ?? 0);
  const paid = down + payment.balancePaid;
  const amountDue = payment.amountDue ?? 0;
  const active = isGuestTripActive(phase);
  const cancelled = phase === 'cancelled';
  const charges = stay + fees + deposit;

  if (charges <= 0 && paid <= 0 && trip.refund.amount == null) return null;

  const owes = active && amountDue > 0;
  const deposited = depositStatus(trip, phase);

  return (
    <GuestTripSection id="trip-payment" title="Payment">
      {active ? (
        owes ? (
          <p className="mb-2 text-2xl font-bold tabular-nums tracking-tight">
            {formatMoney(amountDue)}
            <span className="text-muted-foreground ml-2 text-sm font-medium tracking-normal">
              left to pay
            </span>
          </p>
        ) : (
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="bg-foreground text-background flex size-5 items-center justify-center rounded-full">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            Paid in full
          </p>
        )
      ) : null}

      <dl className="divide-border/70 divide-y">
        {payment.isAirbnb ? (
          <GuestTripRow label="Stay">Paid through Airbnb</GuestTripRow>
        ) : positive(stay) && !cancelled ? (
          <GuestTripRow label="Stay">{formatMoney(stay)}</GuestTripRow>
        ) : null}
        {!cancelled && positive(payment.petFee) ? (
          <GuestTripRow label="Pet fee">{formatMoney(payment.petFee)}</GuestTripRow>
        ) : null}
        {!cancelled && positive(payment.additionalFee) ? (
          <GuestTripRow label="Extra fees">{formatMoney(payment.additionalFee)}</GuestTripRow>
        ) : null}
        {!cancelled && positive(deposit) ? (
          <GuestTripRow
            label={
              <>
                Security deposit
                {deposited ? <span className="block text-xs">{deposited}</span> : null}
              </>
            }
          >
            {formatMoney(deposit)}
          </GuestTripRow>
        ) : null}
        {positive(paid) ? (
          <GuestTripRow label={owes ? 'Paid so far' : 'You paid'}>
            {owes ? `− ${formatMoney(paid)}` : formatMoney(paid)}
          </GuestTripRow>
        ) : null}
      </dl>

      {owes ? (
        <div className="mt-5 space-y-2.5">
          <h3 className="text-sm font-semibold">How to pay</h3>
          {paymentMethods.length > 0 ? (
            <ul className="space-y-2">
              {paymentMethods.map((method) => (
                <PaymentMethodRow key={method.id} method={method} />
              ))}
            </ul>
          ) : null}
          <p className="text-muted-foreground text-sm">
            {paymentMethods.length > 0 ? 'After paying, ' : ''}
            <Link
              to={guestTripMessageHostPath(trip)}
              className="text-foreground font-semibold underline underline-offset-4"
            >
              {paymentMethods.length > 0
                ? 'send your receipt to your host'
                : 'Ask your host how to pay'}
            </Link>
            .
          </p>
        </div>
      ) : null}

      {trip.actions.sdFormAvailable ? (
        <Button asChild variant="outline" className="mt-4 w-full sm:w-auto">
          <Link to={guestSdFormPath(trip.property.slug, trip.bookingId)}>
            Request deposit refund
          </Link>
        </Button>
      ) : null}
    </GuestTripSection>
  );
}
