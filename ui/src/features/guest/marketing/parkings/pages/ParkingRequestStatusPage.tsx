import type { ReactNode } from 'react';

import { Link, Navigate, useParams } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { XCircle } from 'lucide-react';

import { formatGuestFooterLabel } from '@/features/guest/form/lib/guestFormBranding';
import { ParkingRequestStatusView } from '@/features/guest/marketing/parkings/components/ParkingRequestStatusView';
import { useParkingBookingStatus } from '@/features/guest/marketing/parkings/hooks/useParkingBookingStatus';
import { useParkingRequestCountdown } from '@/features/guest/marketing/parkings/hooks/useParkingRequestCountdown';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';
import { ParkingStaySummary } from '@/components/parking/ParkingStaySummary';
import { ParkingRequestStatusPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/layouts/MainLayout';
import { useFavicon } from '@/lib/favicon';
import { propertyPublicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { parkingStatusGuest } from '@/lib/parking/parkingFlowCopy';
import { parkingFlowTransition } from '@/lib/parking/parkingFlowMotion';

function resolveParkingShellTitle(data: {
  parkingName: string | null;
  organizationName: string | null;
}): string {
  return data.parkingName?.trim() || data.organizationName?.trim() || 'Parking';
}

function statusEyebrow(data: {
  residenceName: string | null;
  parkingLabel: string | null;
  organizationName: string | null;
}): string | null {
  const location = [data.residenceName, data.parkingLabel].filter(Boolean).join(' · ');
  return location || data.organizationName?.trim() || null;
}

function ParkingRequestStatusShell({
  children,
  brandColor,
  coverImage,
  footerLabel,
  headerName,
  homeHref,
  logoUrl,
}: {
  children: ReactNode;
  brandColor?: string | null;
  coverImage?: string | null;
  footerLabel?: string | null;
  headerName: string;
  homeHref: string;
  logoUrl?: string | null;
}) {
  useFavicon(logoUrl ?? coverImage ?? undefined);

  return (
    <MainLayout
      homeHref={homeHref}
      brandColor={brandColor}
      footerLabel={footerLabel}
      propertyImageSrc={coverImage ?? logoUrl ?? null}
      propertyName={headerName}
      contentMaxWidth="max-w-2xl"
    >
      {children}
    </MainLayout>
  );
}

export function ParkingRequestStatusPage() {
  const { bookingId = '' } = useParams<{ bookingId: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useParkingBookingStatus(bookingId);
  const countdown = useParkingRequestCountdown(data?.expiresAt ?? null);
  const reduceMotion = useReducedMotion();

  const headerName = data ? resolveParkingShellTitle(data) : 'Parking';
  const homeHref = data?.parkingSlug
    ? `/parkings/${encodeURIComponent(data.parkingSlug)}`
    : '/parkings';
  const footerLabel = data
    ? formatGuestFooterLabel(data.organizationName, data.residenceName)
    : null;

  usePageTitle(propertyPublicPageTitle(headerName, 'Parking Request'));

  if (!bookingId) {
    return <Navigate to="/parkings" replace />;
  }

  if (isLoading && !data) {
    return (
      <ParkingRequestStatusShell headerName="Parking" homeHref="/parkings">
        <ParkingRequestStatusPageSkeleton />
      </ParkingRequestStatusShell>
    );
  }

  if (isError || !data) {
    return (
      <ParkingRequestStatusShell headerName="Parking" homeHref="/parkings">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-10 text-center sm:px-6">
          <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
            <XCircle className="text-muted-foreground h-7 w-7" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-foreground text-lg font-semibold">Request not found</p>
            <p className="text-muted-foreground text-sm">
              This may be a temporary connection issue.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] flex-1"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              Try again
            </Button>
            <Button asChild variant="default" className="min-h-[44px] flex-1">
              <Link to="/parkings">Browse Parking</Link>
            </Button>
          </div>
        </div>
      </ParkingRequestStatusShell>
    );
  }

  const meta = parkingStatusGuest(data.status);
  const eyebrow = statusEyebrow(data);
  const logoSrc = data.coverImage ?? data.logoUrl ?? '';

  return (
    <ParkingRequestStatusShell
      brandColor={data.brandColor}
      coverImage={data.coverImage}
      footerLabel={footerLabel}
      headerName={headerName}
      homeHref={homeHref}
      logoUrl={data.logoUrl}
    >
      <div className="relative space-y-5 p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={data.status}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={parkingFlowTransition(reduceMotion, 0.22)}
          >
            <GuestFormBrandHeader
              title={meta.headline}
              logoSrc={logoSrc}
              logoAlt={headerName}
              eyebrow={eyebrow}
            />
          </motion.div>
        </AnimatePresence>

        <ParkingStaySummary
          checkIn={data.checkInDate}
          checkOut={data.checkOutDate}
          organizationName={data.organizationName}
          compact
        />

        <ParkingRequestStatusView
          bookingId={bookingId}
          data={data}
          countdown={countdown}
          isRefetching={isRefetching}
        />
      </div>
    </ParkingRequestStatusShell>
  );
}
