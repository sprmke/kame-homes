/**
 * RescheduleBookingModal — booking detail `⋯` → **Reschedule**.
 *
 * Two steps in one shell:
 *  1. Pick a new check-in / check-out on the availability-aware date pickers
 *     (`createDisabledDateMatcher(bookedDates, booking.id)` lets the booking keep
 *     its own nights while every other stay + owner-blocked range stays blocked).
 *  2. Confirm — the status reset is mandatory copy, not a choice: continuing
 *     moves the booking back to Pending Review and clears document progress
 *     (approved GAF/pet PDFs, parking, and guest balance settlement). See
 *     `hooks/useRescheduleBooking.ts`.
 */

import { useEffect, useMemo, useState } from 'react';

import { AlertTriangle, ArrowRight, CalendarClock, Loader2 } from 'lucide-react';

import { countParkingNights } from '@/features/guest/pay-parking/lib/payParkingHelpers';

import { bookingEditDatePickerClass } from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { STATUS_LABELS } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import {
  createDisabledCheckoutDateMatcher,
  createDisabledDateMatcher,
  dateToString,
  DATE_PICKER_DISPLAY_FORMAT,
  formatYmdToFullLongDate,
  getNextDay,
  normalizeDateString,
  stringToDate,
  type BookedDateRange,
} from '@/utils/format/dates';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingRow;
  bookedDates: BookedDateRange[];
  onConfirm: (checkInDate: string, checkOutDate: string) => void;
  isSubmitting?: boolean;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function RescheduleBookingModal({
  open,
  onOpenChange,
  booking,
  bookedDates,
  onConfirm,
  isSubmitting = false,
}: Props) {
  const currentCheckIn = normalizeDateString(String(booking.check_in_date ?? ''));
  const currentCheckOut = normalizeDateString(String(booking.check_out_date ?? ''));

  const [step, setStep] = useState<'dates' | 'confirm'>('dates');
  const [checkIn, setCheckIn] = useState<Date | undefined>(undefined);
  const [checkOut, setCheckOut] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setStep('dates');
    setCheckIn(currentCheckIn ? stringToDate(currentCheckIn) : undefined);
    setCheckOut(currentCheckOut ? stringToDate(currentCheckOut) : undefined);
  }, [open, currentCheckIn, currentCheckOut]);

  const nextCheckIn = checkIn ? dateToString(checkIn) : '';
  const nextCheckOut = checkOut ? dateToString(checkOut) : '';
  const datesValid = Boolean(nextCheckIn && nextCheckOut && nextCheckOut > nextCheckIn);
  const datesChanged = nextCheckIn !== currentCheckIn || nextCheckOut !== currentCheckOut;
  const nights = datesValid ? countParkingNights(nextCheckIn, nextCheckOut) : 0;

  const disabledCheckIn = useMemo(() => {
    const matcher = createDisabledDateMatcher(bookedDates, booking.id);
    return (date: Date) => date < startOfToday() || matcher(date);
  }, [bookedDates, booking.id]);

  const disabledCheckOut = useMemo(() => {
    const matcher = createDisabledCheckoutDateMatcher(bookedDates, booking.id);
    return (date: Date) => {
      if (checkIn && date <= checkIn) return true;
      return matcher(date);
    };
  }, [bookedDates, booking.id, checkIn]);

  const resetLabel = STATUS_LABELS['PENDING_REVIEW'];
  const guestName = booking.primary_guest_name || 'this guest';

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={onOpenChange}
      sizeClassName="max-w-[min(calc(100vw-1.5rem),28rem)] sm:max-w-md"
      title={
        <ResponsiveModalTitle className="flex items-center gap-2">
          <CalendarClock className="text-primary size-4 shrink-0" aria-hidden />
          {step === 'dates' ? 'Reschedule booking' : `Reset status to ${resetLabel}?`}
        </ResponsiveModalTitle>
      }
      description={
        step === 'dates'
          ? `Currently ${formatYmdToFullLongDate(currentCheckIn)} – ${formatYmdToFullLongDate(currentCheckOut)}.`
          : undefined
      }
      footerClassName="flex-col gap-2 sm:flex-row sm:justify-end"
      footer={
        step === 'dates' ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={!datesValid || !datesChanged}
              onClick={() => setStep('confirm')}
            >
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={isSubmitting}
              onClick={() => setStep('dates')}
            >
              Back
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={isSubmitting || !datesValid}
              onClick={() => onConfirm(nextCheckIn, nextCheckOut)}
            >
              {isSubmitting ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
              Reschedule & reset status
            </Button>
          </>
        )
      }
    >
      {step === 'dates' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-check-in" className="text-sm">
                Check-in
              </Label>
              <DatePicker
                date={checkIn}
                rangeEnd={checkOut}
                minDate={startOfToday()}
                disabled={disabledCheckIn}
                placeholder={DATE_PICKER_DISPLAY_FORMAT}
                className={bookingEditDatePickerClass}
                onSelect={(date) => {
                  if (!date) return;
                  setCheckIn(date);
                  setCheckOut((prev) => {
                    if (prev && prev > date) return prev;
                    return stringToDate(getNextDay(dateToString(date)));
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-check-out" className="text-sm">
                Check-out
              </Label>
              <DatePicker
                date={checkOut}
                rangeEnd={checkIn}
                minDate={checkIn ? stringToDate(getNextDay(dateToString(checkIn))) : startOfToday()}
                disabled={disabledCheckOut}
                placeholder={DATE_PICKER_DISPLAY_FORMAT}
                className={bookingEditDatePickerClass}
                onSelect={(date) => {
                  if (date) setCheckOut(date);
                }}
              />
            </div>
          </div>

          {datesValid ? (
            <div className="border-border/60 bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <p className="text-foreground min-w-0 text-sm font-medium leading-snug">
                {formatYmdToFullLongDate(nextCheckIn)} – {formatYmdToFullLongDate(nextCheckOut)}
              </p>
              <span className="bg-background text-muted-foreground ring-border/60 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1">
                {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-50/60 p-3 dark:border-amber-500/25 dark:bg-amber-500/10"
            role="note"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500"
              aria-hidden
            />
            <p className="text-foreground text-sm leading-relaxed">
              Rescheduling {guestName} moves the booking back to {resetLabel} and clears document
              progress (approved GAF/pet PDFs, parking, and guest balance settlement). Request
              emails and PDFs are not re-sent; use Automation Triggers if the new dates need fresh
              paperwork.
            </p>
          </div>

          <div className="border-border/60 bg-muted/30 space-y-2 rounded-lg border p-3">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              Stay dates
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground line-through">
                {formatYmdToFullLongDate(currentCheckIn)} –{' '}
                {formatYmdToFullLongDate(currentCheckOut)}
              </span>
              <ArrowRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <span className="text-foreground font-medium">
                {formatYmdToFullLongDate(nextCheckIn)} – {formatYmdToFullLongDate(nextCheckOut)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs tabular-nums">
              {nights} {nights === 1 ? 'night' : 'nights'}
            </p>
          </div>
        </div>
      )}
    </AdminDialogShell>
  );
}
