/**
 * @deprecated Host entry retired — use Find parking / stay-scoped marketplace links.
 * Kept for reference; BookingDetailPage no longer mounts this modal. Legacy public
 * pay-parking URLs redirect via PayParkingPage.
 */
import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { Car, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  buildPayParkingAbsoluteUrl,
  buildPayParkingPath,
} from '@/features/guest/pay-parking/lib/api';
import {
  bookingDateToMmDdYyyy,
  bookingStayDateRange,
  canCustomizeParkingDates,
  countParkingNights,
  defaultParkingCheckOutAfterCheckIn,
  defaultParkingDateRange,
  defaultParkingRateGuest,
  hasPayParkingAvailed,
  parseBookingStayDate,
  parkingUsesBookingStayDates,
} from '@/features/guest/pay-parking/lib/payParkingHelpers';

import { useSaveParkingRateGuest } from '@/features/dashboard/bookings/hooks/useSaveParkingRateGuest';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { formatBookingDate } from '@/utils/format/bookingDisplay';
import { formatMoney } from '@/utils/format/currency';
import { DATE_PICKER_DISPLAY_FORMAT } from '@/utils/format/dates';

type Props = {
  booking: BookingRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function resolveStayBounds(booking: BookingRow) {
  const minDate = parseBookingStayDate(booking.check_in_date);
  const maxDate = parseBookingStayDate(booking.check_out_date);
  if (!minDate || !maxDate) {
    const today = new Date();
    return { minDate: today, maxDate: today };
  }
  return { minDate, maxDate };
}

export function PayParkingModal({ booking, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { propertySlug } = useOrgContext();
  const saveRateMut = useSaveParkingRateGuest();
  const [rate, setRate] = useState(() => defaultParkingRateGuest(booking));
  const [parkingCheckIn, setParkingCheckIn] = useState<Date | undefined>(
    () => defaultParkingDateRange(booking).from
  );
  const [parkingCheckOut, setParkingCheckOut] = useState<Date | undefined>(
    () => defaultParkingDateRange(booking).to
  );
  const [sameAsBookingDuration, setSameAsBookingDuration] = useState(() =>
    parkingUsesBookingStayDates(booking)
  );

  const stayBounds = useMemo(() => resolveStayBounds(booking), [booking]);
  const bookingStayRange = useMemo(() => bookingStayDateRange(booking), [booking]);
  const allowCustomParkingDates = useMemo(() => canCustomizeParkingDates(booking), [booking]);
  const usesBookingStayDates = !allowCustomParkingDates || sameAsBookingDuration;

  useEffect(() => {
    if (open) {
      setRate(defaultParkingRateGuest(booking));
      const canCustomize = canCustomizeParkingDates(booking);
      const useStay = !canCustomize || parkingUsesBookingStayDates(booking);
      setSameAsBookingDuration(useStay);
      const range = useStay ? bookingStayDateRange(booking) : defaultParkingDateRange(booking);
      setParkingCheckIn(range.from);
      setParkingCheckOut(range.to);
    }
  }, [open, booking]);

  const viewMode = hasPayParkingAvailed(booking);
  const isSaving = saveRateMut.isPending;

  const parkingNights = useMemo(() => {
    const checkIn = usesBookingStayDates ? bookingStayRange.from : parkingCheckIn;
    const checkOut = usesBookingStayDates ? bookingStayRange.to : parkingCheckOut;
    if (!checkIn || !checkOut) return 1;
    return countParkingNights(bookingDateToMmDdYyyy(checkIn), bookingDateToMmDdYyyy(checkOut));
  }, [
    usesBookingStayDates,
    bookingStayRange.from,
    bookingStayRange.to,
    parkingCheckIn,
    parkingCheckOut,
  ]);

  const totalPreview = rate * parkingNights;

  function effectiveParkingDates(): { checkIn: Date; checkOut: Date } | null {
    if (usesBookingStayDates) {
      return {
        checkIn: bookingStayRange.from,
        checkOut: bookingStayRange.to,
      };
    }
    if (!parkingCheckIn || !parkingCheckOut) return null;
    return { checkIn: parkingCheckIn, checkOut: parkingCheckOut };
  }

  async function persistSettings(): Promise<boolean> {
    const dates = effectiveParkingDates();
    if (!dates) {
      toast.error('Select parking check-in and check-out dates');
      return false;
    }
    if (dates.checkOut <= dates.checkIn) {
      toast.error('Parking check-out must be after check-in');
      return false;
    }

    try {
      await saveRateMut.mutateAsync({
        bookingId: booking.id,
        parkingRateGuest: rate,
        parkingCheckInDate: bookingDateToMmDdYyyy(dates.checkIn),
        parkingCheckOutDate: bookingDateToMmDdYyyy(dates.checkOut),
      });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save parking settings');
      return false;
    }
  }

  async function handleEnterDetails() {
    const ok = await persistSettings();
    if (!ok) return;
    onOpenChange(false);
    navigate(buildPayParkingPath(propertySlug, booking.id, { admin: true }));
  }

  async function handleCopyUrl() {
    const ok = await persistSettings();
    if (!ok) return;
    const url = buildPayParkingAbsoluteUrl(propertySlug, booking.id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Parking form link copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={onOpenChange}
      sizeClassName="max-w-[min(calc(100vw-1.5rem),28rem)] sm:max-w-md"
      title={
        <ResponsiveModalTitle className="flex items-center gap-2">
          <Car className="text-primary size-4 h-8 w-7 shrink-0" aria-hidden />
          {viewMode ? 'Parking link' : 'Set up parking'}
        </ResponsiveModalTitle>
      }
      footerClassName="flex-col gap-2 sm:flex-col"
      footer={
        <>
          <Button
            type="button"
            className="min-h-[44px] w-full gap-2"
            disabled={isSaving}
            onClick={() => void handleEnterDetails()}
          >
            {isSaving ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            )}
            Enter parking details
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full gap-2"
            disabled={isSaving}
            onClick={() => void handleCopyUrl()}
          >
            {isSaving ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Copy className="size-4 shrink-0" aria-hidden />
            )}
            Copy parking URL
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {allowCustomParkingDates ? (
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={sameAsBookingDuration}
              disabled={isSaving}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setSameAsBookingDuration(next);
                if (next) {
                  setParkingCheckIn(bookingStayRange.from);
                  setParkingCheckOut(bookingStayRange.to);
                }
              }}
              className="mt-0.5"
            />
            <span className="text-foreground flex flex-col text-sm leading-snug">
              Same dates as stay
              {sameAsBookingDuration && (
                <span className="text-base font-semibold">
                  {formatBookingDate(booking.check_in_date)} –{' '}
                  {formatBookingDate(booking.check_out_date)}
                </span>
              )}
            </span>
          </label>
        ) : null}

        {allowCustomParkingDates && !sameAsBookingDuration ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="pay-parking-check-in" className="text-sm">
                Parking check-in
              </Label>
              <DatePicker
                date={parkingCheckIn}
                rangeEnd={parkingCheckOut}
                minDate={stayBounds.minDate}
                maxDate={stayBounds.maxDate}
                disabled={() => isSaving}
                placeholder={DATE_PICKER_DISPLAY_FORMAT}
                onSelect={(date) => {
                  if (!date) return;
                  setParkingCheckIn(date);
                  setParkingCheckOut((prev) =>
                    defaultParkingCheckOutAfterCheckIn(date, prev, stayBounds.maxDate)
                  );
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-parking-check-out" className="text-sm">
                Parking check-out
              </Label>
              <DatePicker
                date={parkingCheckOut}
                rangeEnd={parkingCheckIn}
                minDate={parkingCheckIn ?? stayBounds.minDate}
                maxDate={stayBounds.maxDate}
                disabled={(date) => {
                  if (isSaving) return true;
                  if (parkingCheckIn && date <= parkingCheckIn) return true;
                  return false;
                }}
                placeholder={DATE_PICKER_DISPLAY_FORMAT}
                onSelect={(date) => {
                  if (date) setParkingCheckOut(date);
                }}
              />
            </div>
          </>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="pay-parking-rate" className="text-sm font-medium">
            Rate per night
          </Label>
          <input
            id="pay-parking-rate"
            type="number"
            min={1}
            step={10}
            value={rate}
            disabled={isSaving}
            onChange={(e) => setRate(Number(e.target.value))}
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-sm disabled:opacity-60"
          />
          <p className="text-muted-foreground text-sm">
            {formatMoney(rate)} × {parkingNights} night
            {parkingNights !== 1 ? 's' : ''} ={' '}
            <span className="text-foreground font-semibold">{formatMoney(totalPreview)}</span>
          </p>
        </div>
      </div>
    </AdminDialogShell>
  );
}

export function PayParkingHeaderButton({
  booking,
  onOpenModal,
  onViewParking,
}: {
  booking: BookingRow;
  onOpenModal: () => void;
  onViewParking: () => void;
}) {
  const viewMode = hasPayParkingAvailed(booking);

  return (
    <button
      type="button"
      onClick={viewMode ? onViewParking : onOpenModal}
      className="border-border bg-card text-muted-foreground hover:border-border hover:bg-muted/50 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-xs font-medium shadow-sm transition-colors sm:inline-flex sm:w-auto sm:min-w-[44px] sm:flex-initial sm:justify-center sm:gap-1.5"
    >
      <Car className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 text-left">{viewMode ? 'Open parking link' : 'Set up parking'}</span>
    </button>
  );
}
