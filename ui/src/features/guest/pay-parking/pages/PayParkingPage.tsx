/**
 * Legacy `/properties/:slug/parking/:bookingId` — redirects into the marketplace e2e flow.
 * - Already linked → `/parkings/requests/:parkingBookingId`
 * - Else → `/parkings?linkStay=:bookingId` (city-prefixed when known)
 * - Preview embed → marketplace preview shell
 */

import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { isGuestEmbedPreview } from '@/features/guest/lib/guestEmbedPreview';
import {
  GUEST_PAY_PARKING_PREVIEW_BOOKING_ID,
  guestParkingFindPath,
  guestParkingOwnDefaultPath,
  guestParkingRequestStatusPath,
} from '@/features/guest/lib/guestPublicPaths';
import { PayParkingEmbedPreview } from '@/features/guest/pay-parking/components/PayParkingEmbedPreview';
import { fetchPayParking } from '@/features/guest/pay-parking/lib/api';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MainLayout } from '@/layouts/MainLayout';

export function PayParkingPage() {
  const { bookingId: routeBookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const bookingId = (routeBookingId ?? searchParams.get('bookingId') ?? '').trim();
  const embedPreview = isGuestEmbedPreview(searchParams);
  const isPreviewBooking = bookingId === GUEST_PAY_PARKING_PREVIEW_BOOKING_ID && embedPreview;

  const query = useQuery({
    queryKey: ['pay-parking-redirect', bookingId],
    queryFn: () => fetchPayParking(bookingId),
    enabled: bookingId.length > 0 && !isPreviewBooking,
    retry: false,
  });

  if (isPreviewBooking) {
    return <PayParkingEmbedPreview />;
  }

  if (!bookingId) {
    return <Navigate to="/parkings" replace />;
  }

  if (query.isLoading) {
    return (
      <MainLayout homeHref="/parkings">
        <div
          className="mx-auto w-full max-w-md space-y-3 p-6 sm:p-8"
          role="status"
          aria-live="polite"
          aria-label="Loading"
        >
          <Skeleton className="h-4 w-40" aria-hidden />
          <Skeleton className="h-28 w-full rounded-xl" aria-hidden />
          <Skeleton className="h-10 w-full rounded-lg" aria-hidden />
        </div>
      </MainLayout>
    );
  }

  if (query.isError || !query.data) {
    return (
      <MainLayout homeHref="/parkings">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <p className="text-muted-foreground text-sm">
            {query.error instanceof Error
              ? query.error.message
              : 'This parking link is not available.'}
          </p>
          <Button asChild>
            <Link to="/parkings">Find parking</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const linkedId = query.data.linked_parking_booking_id?.trim();
  if (linkedId) {
    return <Navigate to={guestParkingRequestStatusPath(linkedId)} replace />;
  }

  const ownSlug = query.data.owner_default_parking_slug?.trim();
  if (ownSlug) {
    return (
      <Navigate
        to={guestParkingOwnDefaultPath({
          parkingSlug: ownSlug,
          bookingId,
          checkInDate: query.data.owner_default_check_in,
          checkOutDate: query.data.owner_default_check_out,
        })}
        replace
      />
    );
  }

  return (
    <Navigate
      to={guestParkingFindPath({
        bookingId,
        locationSlug: query.data.city_location_slug,
      })}
      replace
    />
  );
}
