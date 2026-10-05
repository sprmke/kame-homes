import { useCallback, useEffect, useMemo, useState } from 'react';

import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { ContactHostSheet } from '@/features/guest/chat/components/ContactHostSheet';
import { ParkingBookingFormModal } from '@/features/guest/marketing/parkings/components/ParkingBookingFormModal';
import { ParkingOverview } from '@/features/guest/marketing/parkings/components/ParkingOverview';
import { ParkingPublicBrandShell } from '@/features/guest/marketing/parkings/components/ParkingPublicBrandShell';
import { useCaptureParkingLinkStay } from '@/features/guest/marketing/parkings/hooks/useCaptureParkingLinkStay';
import { useParkingReserve } from '@/features/guest/marketing/parkings/hooks/useParkingReserve';
import { usePublicParkingDetail } from '@/features/guest/marketing/parkings/hooks/usePublicParkingDetail';
import {
  BookingCard,
  PropertyAmenities,
  PropertyLocation,
} from '@/features/guest/marketing/properties/components/property-detail';
import { BookingCalendarModal } from '@/features/guest/marketing/properties/components/property-detail/BookingCalendarModal';
import { usePublicHost } from '@/features/guest/marketing/properties/hooks/usePublicHost';
import { ListingGallery } from '@/features/guest/marketing/shared/components/ListingGallery';
import type { ListingHostInfo } from '@/features/guest/marketing/shared/components/ListingHostCard';
import { useMarketingBrandColor } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ContextualActionBar } from '@/components/mobile/ContextualActionBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { parkingFlowTransition } from '@/lib/parking/parkingFlowMotion';
import { buildParkingJsonLd } from '@/lib/seo/seoMeta';
import { usePageMeta } from '@/lib/seo/usePageMeta';
import { cn } from '@/lib/utils';
import { formatDateToYYYYMMDD } from '@/utils/format/dates';

function formatRate(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
  }).format(amount);
}

function buildGalleryImages(coverImage: string | null, images: string[]): string[] {
  const merged = [coverImage, ...images].filter((url): url is string => Boolean(url?.trim()));
  return [...new Set(merged)];
}

export function ParkingDetailPage() {
  useCaptureParkingLinkStay();
  const reduceMotion = useReducedMotion();
  const isBelowLg = useIsBelowLg();
  const { parkingSlug = '' } = useParams<{ parkingSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError } = usePublicParkingDetail(parkingSlug);
  usePageTitle(publicPageTitle(data?.name ? `${data.name}` : 'Parking'));
  const parkingCanonicalPath = `/parkings/${data?.slug ?? parkingSlug}`;
  usePageMeta(
    {
      title: data?.name,
      description:
        data?.description ||
        (data?.residenceName
          ? `Parking at ${data.residenceName}. Check dates and reserve online.`
          : null),
      canonicalPath: parkingCanonicalPath,
      image: data?.coverImage ?? null,
      jsonLd: data
        ? buildParkingJsonLd({
            name: data.name,
            url: `${window.location.origin}${parkingCanonicalPath}`,
            description: data.description,
            image: data.coverImage,
            address: { city: data.city, province: data.province, country: data.country },
            priceFrom: data.ratePerNight,
          })
        : null,
    },
    Boolean(data)
  );
  const { data: hostProfile } = usePublicHost(data?.orgSlug ?? '');
  const { setBrandColor } = useMarketingBrandColor();
  const { status, requireGuestAuth } = useGuestAuth();

  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);

  const { reserve } = useParkingReserve({
    parkingSlug,
    checkIn,
    checkOut,
    onNeedDates: () => setCalendarOpen(true),
    onOpenForm: () => setFormModalOpen(true),
  });

  const handleCalendarProceed = useCallback(() => {
    setCalendarOpen(false);
    reserve();
  }, [reserve]);

  useEffect(() => {
    if (status === 'loading') return;
    if (searchParams.get('reserveForm') !== 'open') return;

    const next = new URLSearchParams(searchParams);
    next.delete('reserveForm');
    setSearchParams(next, { replace: true });

    if (status === 'authenticated') {
      setFormModalOpen(true);
    }
  }, [searchParams, setSearchParams, status]);

  const handleDatesChange = (ci: Date | null, co: Date | null) => {
    setCheckIn(ci);
    setCheckOut(co);
  };

  const openContactSheet = useCallback(() => {
    setContactSheetOpen(true);
  }, []);

  const handleContactHost = useCallback(() => {
    const resumeCheckIn = checkIn ? formatDateToYYYYMMDD(checkIn) : undefined;
    const resumeCheckOut = checkOut ? formatDateToYYYYMMDD(checkOut) : undefined;

    const open = () => openContactSheet();

    if (status === 'authenticated') {
      open();
      return;
    }

    requireGuestAuth(open, {
      resume: {
        type: 'contact_host_sheet',
        parkingSlug,
        checkInDate: resumeCheckIn,
        checkOutDate: resumeCheckOut,
      },
    });
  }, [checkIn, checkOut, openContactSheet, parkingSlug, requireGuestAuth, status]);

  useEffect(() => {
    const fromUrl = (() => {
      const inRaw = searchParams.get('checkInDate');
      const outRaw = searchParams.get('checkOutDate');
      if (!inRaw || !outRaw) return null;
      const checkInDate = new Date(`${inRaw.trim()}T00:00:00`);
      const checkOutDate = new Date(`${outRaw.trim()}T00:00:00`);
      if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) return null;
      return { checkIn: checkInDate, checkOut: checkOutDate };
    })();
    if (fromUrl) {
      setCheckIn(fromUrl.checkIn);
      setCheckOut(fromUrl.checkOut);
    }

    if (status === 'loading') return;

    const next = new URLSearchParams(searchParams);
    let shouldReplace = false;

    if (searchParams.get('contactHost') === 'open') {
      next.delete('contactHost');
      shouldReplace = true;
      if (status === 'authenticated') {
        setContactSheetOpen(true);
      }
    }

    if (shouldReplace) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, status]);

  useEffect(() => {
    const pickDates = searchParams.get('pickDates');
    if (pickDates !== 'contactHost' && pickDates !== 'reserve') return;

    if (pickDates === 'contactHost') {
      handleContactHost();
    } else {
      setCalendarOpen(true);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('pickDates');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, handleContactHost]);

  const galleryImages = useMemo(
    () => (data ? buildGalleryImages(data.coverImage, data.images) : []),
    [data]
  );

  useEffect(() => {
    setBrandColor(data?.brandColor ?? null);
    return () => setBrandColor(null);
  }, [data?.brandColor, setBrandColor]);

  if (!parkingSlug) {
    return <Navigate to="/parkings" replace />;
  }

  if (isLoading && !data) {
    return (
      <div className="@container bg-background min-h-screen w-full min-w-0 pb-20 pt-24">
        <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4">
          <Skeleton className="@xl:h-[400px] @3xl:h-[500px] h-[280px] w-full rounded-2xl" />
        </div>

        <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4 py-8">
          <div className="@5xl:grid-cols-3 @5xl:gap-12 grid grid-cols-1 gap-8">
            <div className="@5xl:col-span-2 min-w-0 space-y-10">
              <div className="space-y-4">
                <Skeleton className="h-8 w-2/3 rounded-lg" />
                <Skeleton className="h-4 w-1/3 rounded-full" />
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
              </div>

              <hr className="border-border" />

              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-2/3 rounded-full" />
              </div>
            </div>

            <div className="@5xl:block hidden">
              <div className="border-border space-y-5 rounded-2xl border p-6 shadow-sm">
                <Skeleton className="h-7 w-32 rounded-lg" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <Navigate to="/parkings" replace />;
  }

  const pricing = data.pricing;

  const host: ListingHostInfo | null = hostProfile
    ? {
        organizationName: hostProfile.name,
        organizationSlug: hostProfile.slug,
        ownerName: hostProfile.ownerName,
        ownerAvatarUrl: hostProfile.ownerAvatarUrl,
        organizationLogoUrl: hostProfile.logoUrl,
        verifiedBadge: hostProfile.verifiedBadge,
      }
    : null;

  const development = data.development ?? null;

  const hasLocation =
    Boolean(data.address.trim()) || (data.latitude != null && data.longitude != null);
  const locationCity = data.city.trim() || development?.locationLabel.split(',')[0]?.trim() || '';

  return (
    <ParkingPublicBrandShell brandColor={data.brandColor}>
      <div
        className={cn(
          '@container bg-background min-h-screen w-full min-w-0 pt-24',
          bottomTabBarOffsetClassName()
        )}
      >
        <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4">
          <ListingGallery images={galleryImages} listingName={data.name} />
        </div>

        <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4 py-8">
          <div className="@5xl:grid-cols-3 @5xl:gap-12 grid grid-cols-1 gap-8">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={parkingFlowTransition(reduceMotion)}
              className="@5xl:col-span-2 min-w-0 space-y-8"
            >
              <ParkingOverview
                name={data.name}
                parkingType={data.parkingType}
                development={development}
                tower={data.tower}
                level={data.level}
                slotLabel={data.slotLabel}
                description={data.description ?? data.notes}
                host={host}
                geoLocation={development?.locationLabel}
                spaceLengthM={data.spaceLengthM}
                spaceWidthM={data.spaceWidthM}
                heightClearanceM={data.heightClearanceM}
                checkInTime={data.checkInTime}
                checkOutTime={data.checkOutTime}
                recommendedBadge={data.recommendedBadge}
                onContactHost={host ? handleContactHost : undefined}
              />

              {data.features.length > 0 ? (
                <>
                  <hr className="border-border" />
                  <PropertyAmenities amenities={data.features} />
                </>
              ) : null}

              {hasLocation ? (
                <>
                  <hr className="border-border" />
                  <PropertyLocation
                    address={data.address}
                    city={locationCity}
                    state={data.province}
                    country={data.country}
                    zipCode={data.zipCode}
                    latitude={data.latitude}
                    longitude={data.longitude}
                    placeId={data.placeId}
                    showNearbyPlaces={false}
                  />
                </>
              ) : null}
            </motion.div>

            <div className="@5xl:block hidden min-w-0">
              <BookingCard
                listingKind="parking"
                baseRate={pricing.weekdayNightlyRate}
                weekendNightlyRate={pricing.weekendNightlyRate}
                dateOverrides={pricing.dateOverrides}
                currency={pricing.currency}
                listingSlug={parkingSlug}
                listingName={data.name}
                checkIn={checkIn}
                checkOut={checkOut}
                onDatesChange={handleDatesChange}
                calendarOpen={calendarOpen}
                onCalendarOpenChange={setCalendarOpen}
                onReserve={reserve}
              />
            </div>
          </div>
        </div>

        <BookingCalendarModal
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          propertySlug={parkingSlug}
          propertyName={data.name}
          checkIn={checkIn}
          checkOut={checkOut}
          onDatesChange={handleDatesChange}
          onProceed={handleCalendarProceed}
        />

        {isBelowLg ? (
          <ContextualActionBar>
            <motion.div
              initial={reduceMotion ? false : { y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-1">
                  <span className="text-foreground text-lg font-bold">
                    {formatRate(pricing.weekdayNightlyRate)}
                  </span>
                  <span className="text-muted-foreground text-sm">/ night</span>
                </div>
              </div>
              <Button
                size="lg"
                className="min-h-[44px] shrink-0 rounded-full px-8"
                type="button"
                onClick={reserve}
              >
                Reserve
              </Button>
            </motion.div>
          </ContextualActionBar>
        ) : null}

        <ParkingBookingFormModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          parkingId={data.id}
          towerLabel={data.tower}
          checkIn={checkIn}
          checkOut={checkOut}
        />

        {host ? (
          <ContactHostSheet
            open={contactSheetOpen}
            onOpenChange={setContactSheetOpen}
            parkingSlug={parkingSlug}
            propertyName={data.name}
            checkIn={checkIn}
            checkOut={checkOut}
            onDatesChange={handleDatesChange}
            host={host}
          />
        ) : null}
      </div>
    </ParkingPublicBrandShell>
  );
}
