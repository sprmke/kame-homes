import { useEffect, useMemo, type ReactNode } from 'react';

import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  BookOpen,
  CalendarPlus,
  Home,
  LifeBuoy,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
} from 'lucide-react';

import {
  GUEST_ACCOUNT_TICKETS_PATH,
  GUEST_ACCOUNT_TRIPS_PATH,
} from '@/features/guest/account/lib/guestAccountPaths';
import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import {
  useGuestPaymentInfo,
  type GuestPaymentMethod,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { storeGuestBookingAccessToken } from '@/features/guest/form/lib/guestBookingAccess';
import {
  absoluteGuestPath,
  guestPropertyPath,
  guestTripPath,
} from '@/features/guest/lib/guestPublicPaths';
import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';
import type { ResolvedPropertyDetail } from '@/features/guest/marketing/properties/types/publicProperty';
import { GuestTripArrivalSection } from '@/features/guest/trip/components/GuestTripArrivalSection';
import { GuestTripDetailsSection } from '@/features/guest/trip/components/GuestTripDetailsSection';
import { GuestTripHostRow } from '@/features/guest/trip/components/GuestTripHostRow';
import { GuestTripNowCard } from '@/features/guest/trip/components/GuestTripNowCard';
import { GuestTripPaymentSection } from '@/features/guest/trip/components/GuestTripPaymentSection';
import { GuestTripReviewCard } from '@/features/guest/trip/components/GuestTripReviewCard';
import {
  GuestTripShortcuts,
  type GuestTripShortcut,
} from '@/features/guest/trip/components/GuestTripShortcuts';
import { GuestTripStayHeader } from '@/features/guest/trip/components/GuestTripStayHeader';
import {
  fetchGuestTrip,
  GUEST_TRIP_QUERY_KEY,
  GuestTripError,
  type GuestTrip,
} from '@/features/guest/trip/lib/guestTripApi';
import {
  buildGuestTripIcs,
  downloadGuestTripIcs,
} from '@/features/guest/trip/lib/guestTripCalendar';
import {
  guestTripDirectionsUrl,
  guestTripEditBookingPath,
  guestTripMessageHostPath,
  guestTripNextActionLink,
} from '@/features/guest/trip/lib/guestTripLinks';
import {
  guestTripChecklist,
  guestTripHeadline,
  guestTripNextAction,
  guestTripPhase,
  guestTripProgress,
  guestTripTiming,
  isGuestTripActive,
  isGuestTripParkingReserved,
  type GuestTripPhase,
} from '@/features/guest/trip/lib/guestTripPhase';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageMeta } from '@/lib/seo/usePageMeta';
import { formatMoney, formatMoneyCompact } from '@/utils/format/currency';
import {
  formatStayDateRange,
  formatTimeToAMPM,
  getManilaYmdToday,
  stringToDate,
} from '@/utils/format/dates';

// ---------------------------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------------------------

function GuestTripSkeleton() {
  return (
    <div role="status" className="px-4 py-5 sm:px-6 sm:py-7" aria-busy="true" aria-label="Loading trip">
      <div className="lg:grid lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-[72px] rounded-2xl sm:size-20" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-3xl" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="mt-10 space-y-6 lg:mt-0">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function TripMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="guest-inner-enter mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{body}</p>
      {children ? <div className="mt-6 flex flex-col items-center gap-2">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

export function GuestTripPage() {
  const { propertySlug = '' } = useParams<{ propertySlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { status: authStatus, email, requireGuestAuth } = useGuestAuth();
  const bookingId = (searchParams.get('bookingId') ?? '').trim();
  const accessParam = searchParams.get('access')?.trim() ?? '';
  usePageMeta({ noindex: true });

  // Email links carry `?access=`: keep it in this tab's session and drop it from the URL.
  useEffect(() => {
    if (!bookingId || !accessParam) return;
    storeGuestBookingAccessToken(bookingId, accessParam);
    const next = new URLSearchParams(searchParams);
    next.delete('access');
    setSearchParams(next, { replace: true });
  }, [bookingId, accessParam, searchParams, setSearchParams]);

  const tripQuery = useQuery({
    queryKey: [...GUEST_TRIP_QUERY_KEY, bookingId, propertySlug, email ?? 'anon'],
    queryFn: () => fetchGuestTrip(bookingId, propertySlug),
    enabled: Boolean(bookingId) && !accessParam && authStatus !== 'loading',
    retry: (count, error) => !(error instanceof GuestTripError) && count < 1,
    staleTime: 30_000,
  });
  const propertyQuery = usePublicPropertyDetail(propertySlug);
  const { data: paymentInfo } = useGuestPaymentInfo();

  if (!bookingId) {
    return (
      <TripMessage
        title="Booking not found"
        body="This link is missing a booking. Open it again from your email."
      >
        <Button asChild variant="outline">
          <Link to={GUEST_ACCOUNT_TRIPS_PATH}>Your trips</Link>
        </Button>
      </TripMessage>
    );
  }

  if (tripQuery.isPending) return <GuestTripSkeleton />;

  if (tripQuery.isError) {
    const code = tripQuery.error instanceof GuestTripError ? tripQuery.error.code : 'unknown';
    if (code === 'sign_in_required') {
      return (
        <TripMessage
          title="Sign in to see your trip"
          body="Use the email you booked with, or open the link from your booking email."
        >
          <Button
            onClick={() =>
              requireGuestAuth(() => void tripQuery.refetch(), {
                resume: { type: 'navigate', to: `${location.pathname}${location.search}` },
              })
            }
          >
            Sign in
          </Button>
        </TripMessage>
      );
    }
    return (
      <TripMessage
        title={code === 'not_found' ? 'Booking not found' : "We couldn't load your trip"}
        body={
          code === 'not_found'
            ? "We couldn't find this booking for your account. Check the link or sign in with the email you booked with."
            : 'Check your connection and try again.'
        }
      >
        {code === 'not_found' ? (
          <Button asChild variant="outline">
            <Link to={GUEST_ACCOUNT_TRIPS_PATH}>Your trips</Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => void tripQuery.refetch()}
            loading={tripQuery.isFetching}
          >
            Try again
          </Button>
        )}
      </TripMessage>
    );
  }

  return (
    <GuestTripContent
      trip={tripQuery.data}
      property={propertyQuery.data ?? null}
      paymentMethods={paymentInfo?.paymentMethods ?? []}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------------------------

function dayLabel(ymd: string): string {
  const date = stringToDate(ymd);
  return Number.isNaN(date.getTime()) ? ymd : format(date, 'EEE, MMM d');
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : format(date, 'MMM d');
}

/** Phase decides which shortcuts matter; the primary action is never repeated as a tile. */
const SHORTCUT_ORDER: Record<GuestTripPhase, string[]> = {
  requested: ['edit', 'call', 'listing'],
  confirmed: ['calendar', 'directions', 'message', 'call'],
  arriving: ['calendar', 'directions', 'message', 'call'],
  arrival_day: ['guide', 'directions', 'message', 'call'],
  staying: ['guide', 'directions', 'message', 'call'],
  checkout_day: ['guide', 'message', 'call', 'directions'],
  // After the stay the host row and the main button cover it; tiles would only repeat them.
  checked_out: [],
  refund_pending: [],
  completed: [],
  cancelled: [],
};

function GuestTripContent({
  trip,
  property,
  paymentMethods,
}: {
  trip: GuestTrip;
  property: ResolvedPropertyDetail | null;
  paymentMethods: GuestPaymentMethod[];
}) {
  const today = getManilaYmdToday();
  const timing = guestTripTiming(trip.stay.checkInDate, trip.stay.checkOutDate, today);
  const phase = guestTripPhase(trip.status, timing);
  const active = isGuestTripActive(phase);
  const cancelled = phase === 'cancelled';

  const address = property?.address?.trim() || property?.location || '';
  const placeLabel = [property?.city, property?.state].filter(Boolean).join(', ') || address;
  const directionsUrl = property
    ? guestTripDirectionsUrl({
        mapsUrl: property.mapsUrl,
        latitude: property.latitude,
        longitude: property.longitude,
        address,
      })
    : null;
  const checkInTime = trip.stay.checkInTime ?? property?.checkInTime ?? '';
  const checkOutTime = trip.stay.checkOutTime ?? property?.checkOutTime ?? '';
  const checkInTimeLabel = checkInTime ? formatTimeToAMPM(checkInTime, true) : null;
  const checkOutTimeLabel = checkOutTime ? formatTimeToAMPM(checkOutTime, false) : null;
  const checkInDateLabel = dayLabel(trip.stay.checkInDate);
  const checkOutDateLabel = dayLabel(trip.stay.checkOutDate);
  const messageHostPath = guestTripMessageHostPath(trip);

  const amountDue = trip.payment.amountDue ?? 0;
  const owes = active && trip.payment.ratesConfirmed && amountDue > 0;
  const amountDueLabel = owes ? formatMoneyCompact(amountDue) : null;
  // Before confirmation documents aren't started; after check-out only approved ones matter.
  const documents =
    phase === 'requested'
      ? []
      : active
        ? trip.documents
        : trip.documents.filter((doc) => doc.status === 'ready');

  const headline = guestTripHeadline({
    phase,
    timing,
    checkInTimeLabel,
    checkOutTimeLabel,
    checkInDateLabel,
    checkOutDateLabel,
    documentsPending: documents.some((doc) => doc.status === 'pending'),
    sdFormAvailable: trip.actions.sdFormAvailable,
    refundLabel: trip.refund.amount != null ? formatMoney(trip.refund.amount) : null,
    cancelledOnLabel: cancelled ? shortDate(trip.statusUpdatedAt) : null,
  });

  const primary = guestTripNextActionLink(
    guestTripNextAction({
      phase,
      amountDue: owes ? amountDue : 0,
      sdFormAvailable: trip.actions.sdFormAvailable,
      reviewAvailable: trip.actions.reviewAvailable,
      reviewSubmitted: trip.actions.reviewSubmitted,
      stayGuideAvailable: Boolean(trip.stayGuidePath),
      directionsAvailable: Boolean(directionsUrl),
      parkingFindAvailable: Boolean(trip.parking.findPath),
    }),
    trip,
    { amountDueLabel, directionsUrl }
  );

  const checklist = guestTripChecklist({
    phase,
    ratesConfirmed: trip.payment.ratesConfirmed,
    totalBalance: trip.payment.totalBalance,
    amountDueLabel,
    documents,
    parkingRequested: trip.parking.requested,
    parkingReserved: isGuestTripParkingReserved(trip.parking.linkedStatus),
    parkingHref: trip.parking.findPath,
  });

  const shortcuts = useMemo(() => {
    const candidates: Record<string, GuestTripShortcut | null> = {
      message: { key: 'message', label: 'Message host', Icon: MessageCircle, to: messageHostPath },
      call: trip.contact.phone
        ? {
            key: 'call',
            label: 'Call host',
            Icon: Phone,
            to: `tel:${trip.contact.phone.replace(/\s+/g, '')}`,
          }
        : null,
      directions: directionsUrl
        ? { key: 'directions', label: 'Directions', Icon: Navigation, to: directionsUrl }
        : null,
      guide: trip.stayGuidePath
        ? { key: 'guide', label: 'Stay guide', Icon: BookOpen, to: trip.stayGuidePath }
        : null,
      edit: trip.actions.canEditBooking
        ? { key: 'edit', label: 'Edit booking', Icon: Pencil, to: guestTripEditBookingPath(trip) }
        : null,
      listing: {
        key: 'listing',
        label: 'View listing',
        Icon: Home,
        to: guestPropertyPath(trip.property.slug),
      },
      calendar:
        timing.kind === 'upcoming'
          ? {
              key: 'calendar',
              label: 'Add to calendar',
              Icon: CalendarPlus,
              onSelect: () =>
                downloadGuestTripIcs(
                  `${trip.property.slug}-${trip.stay.checkInDate}.ics`,
                  buildGuestTripIcs({
                    bookingId: trip.bookingId,
                    propertyName: trip.property.name,
                    checkInDate: trip.stay.checkInDate,
                    checkOutDate: trip.stay.checkOutDate,
                    checkInTime: checkInTime || null,
                    checkOutTime: checkOutTime || null,
                    address,
                    tripUrl: absoluteGuestPath(guestTripPath(trip.property.slug, trip.bookingId)),
                  })
                ),
            }
          : null,
    };
    return SHORTCUT_ORDER[phase]
      .map((key) => candidates[key])
      .filter((item): item is GuestTripShortcut => Boolean(item) && item?.to !== primary.to)
      .slice(0, 4);
  }, [
    trip,
    phase,
    timing.kind,
    messageHostPath,
    directionsUrl,
    address,
    checkInTime,
    checkOutTime,
    primary.to,
  ]);

  const hostName =
    trip.contact.name || property?.host?.ownerName || property?.host?.organizationName || 'Host';

  return (
    <div className="guest-inner-enter px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-14">
        <div className="space-y-4 lg:sticky lg:top-24">
          <GuestTripStayHeader
            propertyName={trip.property.name}
            imageUrl={trip.property.imageUrl ?? property?.images[0] ?? null}
            dateRangeLabel={
              formatStayDateRange(trip.stay.checkInDate, trip.stay.checkOutDate) ??
              `${checkInDateLabel} to ${checkOutDateLabel}`
            }
            nights={trip.stay.nights}
            placeLabel={placeLabel}
            dimmed={cancelled}
          />
          <GuestTripNowCard
            headline={headline}
            progress={guestTripProgress(phase)}
            checklist={checklist}
            primary={primary}
            voucher={
              phase === 'completed' || phase === 'checked_out' || phase === 'refund_pending'
                ? trip.voucher
                : null
            }
          />
          <GuestTripReviewCard trip={trip} />
          <GuestTripShortcuts items={shortcuts} />
        </div>

        <div className="mt-10 space-y-6 lg:mt-0">
          <GuestTripPaymentSection trip={trip} phase={phase} paymentMethods={paymentMethods} />

          {!cancelled && (active || phase === 'requested') ? (
            <GuestTripArrivalSection
              trip={trip}
              address={address}
              directionsUrl={directionsUrl}
              checkInDateLabel={checkInDateLabel}
              checkOutDateLabel={checkOutDateLabel}
              checkInTimeLabel={checkInTimeLabel}
              checkOutTimeLabel={checkOutTimeLabel}
              documents={documents}
              houseRules={property?.houseRules ?? []}
              showRules={phase !== 'requested'}
              title={
                phase === 'staying' || phase === 'checkout_day' ? 'Your stay' : 'Getting there'
              }
            />
          ) : null}

          <GuestTripHostRow
            name={hostName}
            organizationName={property?.host?.organizationName ?? null}
            avatarUrl={
              property?.host?.ownerAvatarUrl || property?.host?.organizationLogoUrl || null
            }
            messagePath={messageHostPath}
            phone={trip.contact.phone}
            email={trip.contact.email}
          />

          <GuestTripDetailsSection
            trip={trip}
            cancellationPolicy={property?.cancellationPolicy ?? null}
            showPolicy={phase === 'requested' || phase === 'confirmed' || phase === 'arriving'}
            messageHostPath={messageHostPath}
          />

          <nav
            aria-label="More"
            className="border-border/70 flex flex-wrap items-center justify-center gap-x-5 border-t pt-4 text-sm"
          >
            <Link
              to={GUEST_ACCOUNT_TRIPS_PATH}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center"
            >
              All trips
            </Link>
            <Link
              to={GUEST_ACCOUNT_TICKETS_PATH}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center gap-1.5"
            >
              <LifeBuoy className="size-4" aria-hidden />
              Get help
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
