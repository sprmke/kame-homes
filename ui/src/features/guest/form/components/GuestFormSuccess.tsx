import { useEffect, useMemo } from 'react';

import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Users, User, PawPrint, Mail, Phone, Info, Car } from 'lucide-react';

import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { bookingSourceFromUrlSearchParams } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import {
  formatGuestMessengerReturn,
  formatGuestSuccessAdministration,
  pickGuestBrandHeaderProps,
} from '@/features/guest/form/lib/guestFormBranding';
import { useGuestPropertySlug } from '@/features/guest/hooks/useGuestPropertySlug';
import {
  guestCalendarPath,
  guestParkingFindPath,
  guestParkingOwnDefaultPath,
  guestTripPath,
} from '@/features/guest/lib/guestPublicPaths';
import { fetchPayParking } from '@/features/guest/pay-parking/lib/api';
import { GuestStayDateRangeDisplay } from '@/features/guest/property/components/GuestStayDateRangeDisplay';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';
import { Button } from '@/components/ui/button';
import { formatTimeToAMPM, stringToDate } from '@/utils/format/dates';

interface BookingData {
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfAdults: number;
  numberOfChildren: number;
  primaryGuestName: string;
  guest2Name?: string;
  guest3Name?: string;
  guest4Name?: string;
  guest5Name?: string;
  hasPets: boolean;
  petName?: string;
  needParking: boolean;
  guestEmail: string;
  guestPhoneNumber: string;
}

export function GuestFormSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const propertySlug = useGuestPropertySlug();
  const bookingId = searchParams.get('bookingId');
  const bookingData = location.state?.bookingData as BookingData | undefined;
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);
  const organizationName = guestBrand.organizationName?.trim() || 'us';
  const administrationLabel = formatGuestSuccessAdministration(guestBrand.residenceName);
  const bookingSource = bookingSourceFromUrlSearchParams(searchParams);
  const isAirbnb = bookingSource === 'Airbnb';
  const isFacebook = bookingSource === 'Facebook';
  const messengerReturn = formatGuestMessengerReturn(isAirbnb, isFacebook);

  const parkingFindQuery = useQuery({
    queryKey: ['guest-success-parking-find', bookingId],
    queryFn: () => fetchPayParking(bookingId as string),
    enabled: Boolean(bookingId && bookingData?.needParking),
    staleTime: 60_000,
    retry: false,
  });

  const parkingFindPath = useMemo(() => {
    if (!bookingId) return '/parkings';
    const data = parkingFindQuery.data;
    const ownSlug = data?.owner_default_parking_slug?.trim();
    if (ownSlug) {
      return guestParkingOwnDefaultPath({
        parkingSlug: ownSlug,
        bookingId,
        checkInDate: data?.owner_default_check_in,
        checkOutDate: data?.owner_default_check_out,
      });
    }
    return guestParkingFindPath({
      bookingId,
      locationSlug: data?.city_location_slug,
    });
  }, [bookingId, parkingFindQuery.data]);

  // Redirect to root if no booking ID
  useEffect(() => {
    if (!bookingId) {
      navigate(propertySlug ? guestCalendarPath(propertySlug) : '/properties', { replace: true });
    }
  }, [bookingId, navigate, propertySlug]);

  // Calculate number of nights
  const numberOfNights = bookingData
    ? Math.ceil(
        (dayjs(bookingData.checkOutDate).valueOf() - dayjs(bookingData.checkInDate).valueOf()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  // Get all guest names
  const guestNames = bookingData
    ? [
        bookingData.primaryGuestName,
        bookingData.guest2Name,
        bookingData.guest3Name,
        bookingData.guest4Name,
        bookingData.guest5Name,
      ].filter(Boolean)
    : [];

  const totalGuests = bookingData ? bookingData.numberOfAdults + bookingData.numberOfChildren : 0;

  return (
    <div className="guest-inner-enter relative flex flex-col items-center justify-center px-5 py-8 text-center sm:py-10">
      <div className="w-full max-w-xl space-y-8">
        <GuestFormBrandHeader {...brandHeader} title="Booking Confirmed!" />
        <p className="text-muted-foreground text-base">
          Thank you for booking with <strong className="text-primary">{organizationName}</strong>!
        </p>

        {bookingId && propertySlug ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to={guestTripPath(propertySlug, bookingId)}>View your booking</Link>
          </Button>
        ) : null}

        {bookingData && (
          <div className="space-y-6">
            {/* Booking Summary Card */}
            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
              <div className="border-separator border-b px-6 py-3">
                <h2 className="text-foreground text-base font-semibold sm:text-lg">
                  Booking Summary
                </h2>
              </div>

              <div className="space-y-6 p-6 text-left">
                {/* Total Nights Badge */}
                <div className="flex justify-center">
                  <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-4 py-2">
                    <span className="text-2xl font-bold tabular-nums">{numberOfNights}</span>
                    <span className="font-medium">{numberOfNights === 1 ? 'Night' : 'Nights'}</span>
                  </div>
                </div>

                {/* Stay dates */}
                <GuestStayDateRangeDisplay
                  checkIn={stringToDate(bookingData.checkInDate)}
                  checkOut={stringToDate(bookingData.checkOutDate)}
                  checkInDetail={formatTimeToAMPM(bookingData.checkInTime, true)}
                  checkOutDetail={formatTimeToAMPM(bookingData.checkOutTime, false)}
                />

                <div className="space-y-5 border-t pt-6">
                  {/* Number of Guests */}
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-lg p-2">
                      <Users className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                        Guests
                      </p>
                      <p className="text-foreground font-bold">
                        {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {bookingData.numberOfAdults}{' '}
                        {bookingData.numberOfAdults === 1 ? 'Adult' : 'Adults'}
                        {bookingData.numberOfChildren > 0 &&
                          ` • ${bookingData.numberOfChildren} ${
                            bookingData.numberOfChildren === 1 ? 'Child' : 'Children'
                          }`}
                      </p>
                    </div>
                  </div>

                  {/* Guest Names */}
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-lg p-2">
                      <User className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                        Guest Names
                      </p>
                      <div className="space-y-1.5">
                        {guestNames.map((name, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className={`bg-muted-foreground h-1.5 w-1.5 rounded-full`} />
                            <p
                              className={`text-base ${
                                index === 0 ? 'text-foreground font-bold' : 'text-foreground'
                              }`}
                            >
                              {name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4 border-t pt-5">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <Mail className="text-primary h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                          Email
                        </p>
                        <p className="text-foreground break-all text-sm">
                          {bookingData.guestEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <Phone className="text-primary h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                          Phone
                        </p>
                        <p className="text-foreground text-sm">{bookingData.guestPhoneNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Parking interest (Phase 7) — self-serve marketplace, not part of this total */}
                  {bookingData.needParking && (
                    <div className="border-t pt-5">
                      <div className="border-primary/20 bg-primary/5 flex items-start gap-4 rounded-lg border p-4">
                        <div className="bg-primary/10 rounded-lg p-2">
                          <Car className="text-primary h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground mb-1 text-sm font-bold">Need parking?</p>
                          <p className="text-muted-foreground text-sm">
                            Reserve and pay for a spot separately, once you're signed in as a guest.
                          </p>
                          <Link
                            to={parkingFindPath}
                            className="text-primary mt-2 inline-block text-sm font-semibold underline underline-offset-2"
                          >
                            Find parking near your stay
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pet Information */}
                  {bookingData.hasPets && bookingData.petName && (
                    <div className="border-t pt-5">
                      <div className="flex items-start gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                        <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/40">
                          <PawPrint className="h-5 w-5 text-amber-700 dark:text-amber-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-xs font-medium uppercase text-amber-700 dark:text-amber-500">
                            Bringing Pet
                          </p>
                          <p className="text-base font-bold text-amber-900 dark:text-amber-400">
                            {bookingData.petName}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps Info Box */}
        <div className="border-primary/25 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 overflow-hidden rounded-xl border shadow-sm">
          <div className="flex-1 space-y-2 p-5 text-left">
            <div className="flex items-center space-x-2">
              <div className="bg-primary/15 dark:bg-primary/20 flex-shrink-0 rounded-lg p-1">
                <Info className="text-primary dark:text-primary h-4 w-4" />
              </div>
              <h3 className="text-primary dark:text-primary text-base font-semibold">Next Steps</h3>
            </div>
            <div className="text-foreground dark:text-foreground space-y-2 text-sm leading-relaxed">
              <p>
                We will now review your booking request. Please wait for our booking acknowledgment
                email. Once confirmed, we will forward your Guest Advice Form (GAF) to the{' '}
                {administrationLabel} for approval.
              </p>
              <p>
                <span className="font-semibold">{messengerReturn}</span> to review our policies and
                important reminders, or if you need to update your booking details.
              </p>
              <p className="pt-1 font-medium">See you soon!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
