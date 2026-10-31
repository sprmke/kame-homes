import { AlertCircle, CalendarDays, Car, ParkingCircle, type LucideIcon } from 'lucide-react';

import { formatPayParkingLastMinuteWarning } from '@/features/guest/form/lib/guestFormBranding';
import type { PayParkingBootstrap } from '@/features/guest/pay-parking/lib/api';

import { formatMoney } from '@/utils/format/currency';
import { formatStayDateRange } from '@/utils/format/dates';

function PayParkingSectionShell({
  icon: Icon,
  title,
  ariaLabel,
  children,
}: {
  icon: LucideIcon;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} className="form-section !px-4 !py-5 sm:!px-5 sm:!py-6">
      <div className="form-section-header mb-4">
        <Icon className="form-section-icon" aria-hidden />
        <h2 className="form-section-title !text-base sm:!text-lg">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function PayParkingIntro({ data }: { data: PayParkingBootstrap }) {
  const nights = data.number_of_nights || 1;

  return (
    <PayParkingSectionShell icon={CalendarDays} title="Booking Info" ariaLabel="Booking Info">
      <div className="space-y-1.5">
        <p className="text-foreground text-base font-bold">{data.primary_guest_name}</p>
        <p className="text-foreground text-sm font-medium leading-snug">
          {formatStayDateRange(data.check_in_date, data.check_out_date)}
        </p>
        <p className="text-muted-foreground text-sm">
          {nights} night{nights !== 1 ? 's' : ''} · {data.pax} guest
          {data.pax !== 1 ? 's' : ''}
        </p>
      </div>
    </PayParkingSectionShell>
  );
}

function PayParkingDetailsCard({ data }: { data: PayParkingBootstrap }) {
  const nights = data.number_of_parking_nights || 1;
  const ratePerNight = data.parking_rate_guest;
  const totalEstimate = ratePerNight * nights;

  return (
    <PayParkingSectionShell
      icon={ParkingCircle}
      title="Parking Details"
      ariaLabel="Parking Details"
    >
      <div className="bg-muted/40 space-y-3 rounded-xl px-4 py-3.5">
        <p className="text-foreground text-sm font-medium leading-snug">
          {formatStayDateRange(data.parking_check_in_date, data.parking_check_out_date)}
        </p>
        <div className="border-border/60 flex items-end justify-between gap-4 border-t pt-3">
          <span className="truncate text-lg font-bold tabular-nums tracking-tight sm:text-2xl">
            {formatMoney(totalEstimate)}
          </span>
          <p className="text-muted-foreground text-sm">{formatMoney(ratePerNight)} / night</p>
        </div>
      </div>
    </PayParkingSectionShell>
  );
}

/** @deprecated Use PayParkingDetailsCard */
export const PayParkingRateCard = PayParkingDetailsCard;

export function PayParkingLastMinuteWarning({ residenceName }: { residenceName?: string | null }) {
  return (
    <p
      className="mt-3 flex gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2.5 text-left text-sm leading-relaxed text-amber-950/90 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100/90"
      role="alert"
    >
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden
      />
      <span>{formatPayParkingLastMinuteWarning(residenceName ?? null)}</span>
    </p>
  );
}

function PayParkingNonRefundableNote() {
  return (
    <p
      className="flex gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2.5 text-sm leading-relaxed text-amber-950/90 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100/90"
      role="note"
    >
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden
      />
      <span>
        Parking fee is{' '}
        <span className="font-semibold">non-refundable and cannot be re-scheduled</span> after you
        submit.
      </span>
    </p>
  );
}

export function PayParkingVehicleSection({ children }: { children: React.ReactNode }) {
  return (
    <PayParkingSectionShell icon={Car} title="Vehicle Info" ariaLabel="Vehicle Info">
      <PayParkingNonRefundableNote />
      <div className="mt-4 space-y-4">{children}</div>
    </PayParkingSectionShell>
  );
}
