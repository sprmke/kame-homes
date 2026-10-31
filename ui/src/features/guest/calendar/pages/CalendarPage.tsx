import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import dayjs from 'dayjs';
import { ArrowRight } from 'lucide-react';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { useGuestBookedDates } from '@/features/guest/form/hooks/useGuestBookedDates';
import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import {
  hasStrippedGuestQueryKeys,
  stripLegacyFromQueryParam,
} from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { pickGuestBrandHeaderProps } from '@/features/guest/form/lib/guestFormBranding';
import {
  useGuestPropertySearchParams,
  useGuestPropertySlug,
} from '@/features/guest/hooks/useGuestPropertySlug';
import { guestCalendarPath, guestFormPath } from '@/features/guest/lib/guestPublicPaths';
import { GuestStayContextBar } from '@/features/guest/property/components/GuestStayContextBar';
import { PublicPropertyCalendar } from '@/features/guest/property/components/PublicPropertyCalendar';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';
import { CalendarPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import { Button } from '@/components/ui/button';
import { captureAppEvent } from '@/lib/posthog/capture';
import { dateToString } from '@/utils/format/dates';

export function CalendarPage() {
  const navigate = useNavigate();
  const { requireGuestAuth } = useGuestAuth();
  const [searchParams] = useSearchParams();
  const propertySlug = useGuestPropertySlug();
  const scopedSearchParams = useGuestPropertySearchParams();
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const { isLoading: calendarLoading } = useGuestBookedDates(propertySlug);
  const calendarOpenedRef = useRef(false);

  useEffect(() => {
    if (calendarLoading || calendarOpenedRef.current) return;
    calendarOpenedRef.current = true;
    const source = scopedSearchParams.get('source')?.trim().toLowerCase();
    captureAppEvent('calendar_opened', {
      booking_source: source === 'facebook' || source === 'airbnb' ? source : 'unknown',
    });
  }, [calendarLoading, scopedSearchParams]);

  useEffect(() => {
    if (!propertySlug || !hasStrippedGuestQueryKeys(searchParams)) return;
    const next = stripLegacyFromQueryParam(new URLSearchParams(searchParams));
    navigate(guestCalendarPath(propertySlug, next), { replace: true });
  }, [navigate, propertySlug, searchParams]);

  useEffect(() => {
    const bookingId = searchParams.get('bookingId')?.trim();
    if (!bookingId || !propertySlug) return;
    const next = stripLegacyFromQueryParam(new URLSearchParams(searchParams));
    navigate(guestFormPath(propertySlug, next), { replace: true });
  }, [navigate, propertySlug, searchParams]);

  const handleDatesChange = useCallback((ci: Date | null, co: Date | null) => {
    setCheckIn(ci);
    setCheckOut(co);
  }, []);

  const handleClearDates = useCallback(() => {
    setCheckIn(null);
    setCheckOut(null);
  }, []);

  const handleProceed = () => {
    if (!checkIn || !checkOut || !propertySlug) return;

    const nights = Math.max(dayjs(checkOut).diff(dayjs(checkIn), 'day'), 0);
    captureAppEvent('stay_dates_selected', { nights });

    const next = stripLegacyFromQueryParam(new URLSearchParams(scopedSearchParams));
    next.set('checkInDate', dateToString(checkIn));
    next.set('checkOutDate', dateToString(checkOut));
    next.delete('bookingId');

    const target = guestFormPath(propertySlug, next);
    requireGuestAuth(() => navigate(target), {
      resume: { type: 'navigate', to: target },
    });
  };

  const canProceed = Boolean(checkIn && checkOut && propertySlug);

  if (!propertySlug) {
    return null;
  }

  if (calendarLoading) {
    return (
      <div className="guest-inner-enter">
        <CalendarPageSkeleton />
      </div>
    );
  }

  return (
    <div className="guest-inner-enter relative min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <GuestFormBrandHeader {...brandHeader} title="Check Availability" />

        <div className="mx-auto flex w-full max-w-[33rem] flex-col gap-6">
          <PublicPropertyCalendar
            propertyName={guestBrand.propertyName || propertySlug}
            propertySlug={propertySlug}
            value={{ checkIn, checkOut }}
            onDatesChange={handleDatesChange}
            showBookingAction={false}
            showDateSummary={false}
            embedded
          />

          <div className="flex w-full flex-col gap-4">
            {checkIn && checkOut ? (
              <GuestStayContextBar
                checkInDate={dateToString(checkIn)}
                checkOutDate={dateToString(checkOut)}
                onClear={handleClearDates}
                width="full"
              />
            ) : null}

            <Button
              onClick={handleProceed}
              disabled={!canProceed}
              variant={canProceed ? 'default' : 'secondary'}
              size="lg"
              className="min-h-[44px] w-full"
            >
              {canProceed ? (
                <>
                  Proceed to Booking Form
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              ) : (
                'Select dates to continue'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
