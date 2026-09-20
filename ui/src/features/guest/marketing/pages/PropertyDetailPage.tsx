import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { ContactHostSheet } from '@/features/guest/chat/components/ContactHostSheet';
import {
  clampBookingGuestCounts,
  resolveListingGuestCapacity,
  type BookingGuestCounts,
} from '@/features/guest/form/lib/guestCounts';
import { usePreviewOverride } from '@/features/guest/lib/previewOverrideContext';
import { usePreviewViewport } from '@/features/guest/lib/previewViewportContext';
import {
  PropertyGallery,
  PropertyOverview,
  PropertyAmenities,
  PropertyLocation,
  PropertyRules,
  PropertyReviews,
  BookingCard,
  BookingCalendarModal,
  GuestBookingFormModal,
  SimilarProperties,
} from '@/features/guest/marketing/properties/components/property-detail';
import { usePropertyContactHost } from '@/features/guest/marketing/properties/hooks/usePropertyContactHost';
import { usePropertyPageViewTracking } from '@/features/guest/marketing/properties/hooks/usePropertyPageViewTracking';
import { usePropertyReserve } from '@/features/guest/marketing/properties/hooks/usePropertyReserve';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';
import {
  DEFAULT_PROPERTIES_QUERY,
  toPropertyCard,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { resolvePropertyLandingSections } from '@/features/guest/marketing/properties/lib/propertyLandingSections';
import type { PropertyLandingSectionId } from '@/features/guest/marketing/properties/types/publicProperty';
import { GuestPublicBrandShell } from '@/features/guest/marketing/shared/components/GuestPublicBrandShell';
import type { ListingHostInfo } from '@/features/guest/marketing/shared/components/ListingHostCard';
import { useMarketingBrandColor } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ContextualActionBar } from '@/components/mobile/ContextualActionBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';
import { parseGuestInquiryDateRange, formatDateToYYYYMMDD } from '@/utils/format/dates';

export function PropertyDetailPage() {
  const { propertySlug = '' } = useParams<{ propertySlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewOverride = usePreviewOverride();
  const previewViewport = usePreviewViewport();
  const isEditorPreview = previewOverride?.kind === 'property-landing';
  const forceDesktopChrome = previewViewport === 'desktop';
  const forceMobileChrome = previewViewport === 'mobile';
  const isBelowLg = useIsBelowLg();
  const propertySlugForActions = propertySlug || (isEditorPreview ? previewOverride.data.slug : '');
  const { data: propertyData, isLoading, isError } = usePublicPropertyDetail(propertySlug);
  const similarResult = usePublicProperties(
    {
      ...DEFAULT_PROPERTIES_QUERY,
      development: propertyData?.developmentSlug ? [propertyData.developmentSlug] : [],
      type: propertyData?.type ? [propertyData.type] : [],
      where: !propertyData?.developmentSlug && propertyData?.city ? propertyData.city : '',
      pageSize: 12,
    },
    Boolean(propertyData)
  );
  const similarProperties = useMemo(
    () =>
      (similarResult.data?.data ?? [])
        .filter((item) => item.slug !== propertySlug && item.id !== propertyData?.id)
        .map(toPropertyCard),
    [similarResult.data?.data, propertySlug, propertyData?.id]
  );
  usePageTitle(publicPageTitle(propertyData?.name ? `${propertyData.name}` : 'Property'));
  usePropertyPageViewTracking(propertyData?.id, !isEditorPreview && propertyData?.source === 'api');

  useEffect(() => {
    if (!propertyData?.slug || isEditorPreview) return;
    captureAppEvent('listing_viewed', {
      listing_kind: 'property',
      slug: propertyData.slug,
      ...(propertyData.id ? { property_id: propertyData.id } : {}),
    });
  }, [propertyData?.slug, propertyData?.id, isEditorPreview]);
  const { setBrandColor } = useMarketingBrandColor();
  const { status, requireGuestAuth } = useGuestAuth();

  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [bookingGuests, setBookingGuests] = useState<BookingGuestCounts>({
    adults: 2,
    children: 0,
  });

  const guestCapacity = useMemo(
    () =>
      propertyData
        ? resolveListingGuestCapacity(
            propertyData.guests,
            propertyData.maxAdults,
            propertyData.maxChildren
          )
        : null,
    [propertyData]
  );

  useEffect(() => {
    if (!guestCapacity) return;
    setBookingGuests((current) =>
      clampBookingGuestCounts(current, guestCapacity, guestCapacity.maxGuests)
    );
  }, [guestCapacity]);

  const handleDatesChange = useCallback((ci: Date | null, co: Date | null) => {
    setCheckIn(ci);
    setCheckOut(co);
  }, []);

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
        propertySlug: propertySlugForActions,
        checkInDate: resumeCheckIn,
        checkOutDate: resumeCheckOut,
      },
    });
  }, [checkIn, checkOut, openContactSheet, propertySlugForActions, requireGuestAuth, status]);

  const openDatesForReserve = useCallback(() => {
    setCalendarOpen(true);
  }, []);

  const { reserve } = usePropertyReserve({
    propertySlug: propertySlugForActions,
    checkIn,
    checkOut,
    adults: bookingGuests.adults,
    children: bookingGuests.children,
    onNeedDates: openDatesForReserve,
    onOpenForm: () => setFormModalOpen(true),
  });

  const handleCalendarProceed = useCallback(() => {
    setCalendarOpen(false);
    reserve();
  }, [reserve]);

  const { contactHost } = usePropertyContactHost({
    propertySlug: propertySlugForActions,
    onContactHost: handleContactHost,
  });

  useEffect(() => {
    const fromUrl = parseGuestInquiryDateRange(
      searchParams.get('checkInDate'),
      searchParams.get('checkOutDate')
    );
    if (fromUrl) {
      setCheckIn(fromUrl.checkIn);
      setCheckOut(fromUrl.checkOut);
    }

    const adultsParam = searchParams.get('adults');
    const childrenParam = searchParams.get('children');
    if (guestCapacity && (adultsParam || childrenParam)) {
      setBookingGuests((current) => {
        const nextAdults = adultsParam ? Number(adultsParam) : current.adults;
        const nextChildren = childrenParam ? Number(childrenParam) : current.children;
        if (!Number.isFinite(nextAdults) || !Number.isFinite(nextChildren)) return current;
        return clampBookingGuestCounts(
          { adults: nextAdults, children: nextChildren },
          guestCapacity,
          guestCapacity.maxGuests
        );
      });
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

    if (searchParams.get('reserveForm') === 'open') {
      next.delete('reserveForm');
      shouldReplace = true;
      if (status === 'authenticated') {
        setFormModalOpen(true);
      }
    }

    if (shouldReplace) {
      setSearchParams(next, { replace: true });
    }
  }, [propertySlug, searchParams, setSearchParams, status, guestCapacity]);

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

  useEffect(() => {
    setBrandColor(propertyData?.brandColor ?? null);
    return () => setBrandColor(null);
  }, [propertyData?.brandColor, setBrandColor]);

  if (!propertySlug && !isEditorPreview) {
    return <Navigate to="/properties" replace />;
  }

  if (isLoading && !propertyData) {
    return (
      <div className="@container bg-background min-h-screen w-full min-w-0 pb-20 pt-24">
        <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4">
          <Skeleton className="@xl:h-[400px] @3xl:h-[500px] h-[300px] w-full rounded-2xl" />
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
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
              </div>

              <hr className="border-border" />

              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-2/3 rounded-full" />
              </div>

              <hr className="border-border" />

              <div className="@2xl:grid-cols-3 grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-24 rounded-full" />
                ))}
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

  if (isError || !propertyData) {
    if (isEditorPreview) {
      return (
        <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center px-4 text-center text-sm">
          Could not load listing preview.
        </div>
      );
    }
    return <Navigate to="/properties" replace />;
  }

  const showReviews =
    (propertyData.source === 'mock' &&
      propertyData.rating != null &&
      propertyData.reviews != null) ||
    (propertyData.source === 'api' &&
      ((propertyData.reviews ?? 0) > 0 || (propertyData.guestReviews?.length ?? 0) > 0));

  const listingReviews =
    propertyData.guestReviews?.map((review) => ({
      id: review.id,
      author: review.author,
      date: review.date,
      rating: review.rating,
      comment: review.comment,
      feedbackTags: review.feedbackTags ?? [],
      media: review.media ?? [],
      source: review.source,
      createdAt: review.createdAt ?? null,
    })) ?? [];

  const showRatingInBooking =
    (propertyData.source === 'mock' &&
      propertyData.rating != null &&
      propertyData.reviews != null) ||
    (propertyData.source === 'api' &&
      propertyData.rating != null &&
      (propertyData.reviews ?? 0) > 0);

  const contactSheetHost: ListingHostInfo = {
    organizationName: propertyData.host?.organizationName ?? 'Host',
    organizationSlug: propertyData.host?.organizationSlug ?? '',
    ownerName: propertyData.host?.ownerName ?? 'Host',
    ownerAvatarUrl: propertyData.host?.ownerAvatarUrl ?? null,
    organizationLogoUrl: propertyData.host?.organizationLogoUrl ?? null,
    isSuperhost: propertyData.isSuperhost,
    verifiedBadge: propertyData.verifiedBadge,
  };

  const visibleSections = resolvePropertyLandingSections(propertyData.sectionConfig);
  const showGallery = visibleSections.includes('gallery');
  const bodySections = visibleSections.filter((id) => {
    if (id === 'gallery') return false;
    if (id === 'reviews' && !showReviews) return false;
    return true;
  });

  const renderBodySection = (sectionId: PropertyLandingSectionId, index: number) => {
    const divider = index > 0 ? <hr className="border-border" /> : null;
    const wrap = (node: ReactNode) => (
      <div
        key={sectionId}
        id={sectionId}
        data-page-editor-anchor={sectionId}
        className="scroll-mt-4"
      >
        {divider}
        {node}
      </div>
    );

    switch (sectionId) {
      case 'overview':
        return wrap(
          <PropertyOverview
            name={propertyData.name}
            type={propertyData.type}
            description={propertyData.description}
            location={{
              address: propertyData.address,
              city: propertyData.location.split(', ')[0] ?? '',
              state: propertyData.state,
              country: propertyData.country,
            }}
            stats={{
              bedrooms: propertyData.bedrooms,
              bathrooms: propertyData.bathrooms,
              maxGuests: propertyData.guests,
              floors: propertyData.floors,
            }}
            residenceName={propertyData.residenceName}
            developmentSlug={propertyData.developmentSlug}
            tower={propertyData.tower}
            unitNumber={propertyData.unitNumber}
            towerAndUnit={propertyData.towerAndUnit}
            checkInTime={propertyData.checkInTime}
            checkOutTime={propertyData.checkOutTime}
            rating={propertyData.rating}
            reviews={propertyData.reviews}
            isSuperhost={propertyData.isSuperhost}
            verifiedBadge={propertyData.verifiedBadge}
            recommendedBadge={propertyData.recommendedBadge}
            host={propertyData.host}
            selfCheckIn={propertyData.selfCheckIn}
            showMarketingFeatures={propertyData.source === 'mock'}
            cancellationPolicy={propertyData.cancellationPolicy}
            onContactHost={contactHost}
          />
        );
      case 'amenities':
        return wrap(<PropertyAmenities amenities={propertyData.amenities} />);
      case 'location':
        return wrap(
          <PropertyLocation
            address={propertyData.address}
            city={propertyData.location.split(', ')[0] ?? ''}
            state={propertyData.state}
            country={propertyData.country}
            zipCode={propertyData.zipCode}
            latitude={propertyData.latitude}
            longitude={propertyData.longitude}
            placeId={propertyData.placeId}
            showNearbyPlaces={propertyData.source === 'mock'}
          />
        );
      case 'rules':
        return wrap(
          <PropertyRules
            houseRules={propertyData.houseRules}
            maxGuests={propertyData.guests}
            cancellationPolicy={propertyData.cancellationPolicy}
            showSafetySection={propertyData.source === 'mock'}
          />
        );
      case 'reviews':
        if (!showReviews) return null;
        return wrap(
          <PropertyReviews
            rating={propertyData.rating ?? 5}
            totalReviews={propertyData.reviews ?? listingReviews.length}
            reviews={listingReviews}
          />
        );
      default:
        return null;
    }
  };

  return (
    <GuestPublicBrandShell brandColor={propertyData.brandColor}>
      <div
        className={cn(
          '@container bg-background min-h-screen w-full min-w-0',
          isEditorPreview ? 'pt-4' : 'pt-24',
          !isEditorPreview && bottomTabBarOffsetClassName(),
          forceMobileChrome && 'pb-24',
          isEditorPreview && !forceMobileChrome && 'pb-4'
        )}
      >
        {showGallery ? (
          <div
            id="gallery"
            data-page-editor-anchor="gallery"
            className="@xl:px-6 @5xl:px-8 container mx-auto px-4"
          >
            <PropertyGallery
              images={propertyData.images}
              propertyName={propertyData.name}
              propertySlug={propertySlugForActions}
            />
          </div>
        ) : null}

        <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4 py-8">
          <div
            className={cn(
              'grid grid-cols-1 gap-8',
              forceMobileChrome ? null : '@5xl:grid-cols-3 @5xl:gap-12'
            )}
          >
            <div className={cn('min-w-0 space-y-10', !forceMobileChrome && '@5xl:col-span-2')}>
              {bodySections.map((sectionId, index) => renderBodySection(sectionId, index))}
            </div>

            <div
              className={cn(
                'min-w-0',
                forceDesktopChrome ? 'block' : forceMobileChrome ? 'hidden' : '@5xl:block hidden'
              )}
            >
              <BookingCard
                baseRate={propertyData.pricing.baseRate}
                currency={propertyData.pricing.currency}
                cleaningFee={propertyData.pricing.cleaningFee}
                securityDeposit={propertyData.pricing.securityDeposit}
                parkingRate={propertyData.pricing.parkingRate}
                petFee={propertyData.pricing.petFee}
                rating={showRatingInBooking ? propertyData.rating : undefined}
                reviews={showRatingInBooking ? propertyData.reviews : undefined}
                maxGuests={propertyData.guests}
                maxAdults={propertyData.maxAdults}
                maxChildren={propertyData.maxChildren}
                adults={bookingGuests.adults}
                childCount={bookingGuests.children}
                onGuestsChange={setBookingGuests}
                propertySlug={propertySlugForActions}
                propertyName={propertyData.name}
                checkIn={checkIn}
                checkOut={checkOut}
                onDatesChange={handleDatesChange}
                calendarOpen={calendarOpen}
                onCalendarOpenChange={setCalendarOpen}
                onReserve={reserve}
              />
            </div>
          </div>

          {similarProperties.length > 0 ? (
            <div className="mt-16 min-w-0">
              <hr className="border-border mb-10" />
              <SimilarProperties
                properties={similarProperties}
                currentPropertyId={propertySlugForActions}
              />
            </div>
          ) : null}
        </div>

        {!forceDesktopChrome && (forceMobileChrome || isBelowLg) ? (
          <PropertyReserveCta
            editorPreview={forceMobileChrome}
            baseRate={propertyData.pricing.baseRate}
            rating={showRatingInBooking ? (propertyData.rating ?? null) : null}
            reviews={propertyData.reviews ?? 0}
            onReserve={reserve}
          />
        ) : null}

        <BookingCalendarModal
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          propertySlug={propertySlugForActions}
          propertyName={propertyData.name}
          checkIn={checkIn}
          checkOut={checkOut}
          onDatesChange={handleDatesChange}
          onProceed={handleCalendarProceed}
        />

        <GuestBookingFormModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          propertySlug={propertySlugForActions}
          propertyName={propertyData.name}
          checkIn={checkIn}
          checkOut={checkOut}
          numberOfAdults={bookingGuests.adults}
          numberOfChildren={bookingGuests.children}
        />

        <ContactHostSheet
          open={contactSheetOpen}
          onOpenChange={setContactSheetOpen}
          propertySlug={propertySlugForActions}
          propertyName={propertyData.name}
          checkIn={checkIn}
          checkOut={checkOut}
          onDatesChange={handleDatesChange}
          host={contactSheetHost}
        />
      </div>
    </GuestPublicBrandShell>
  );
}

/**
 * Reserve CTA — phone/tablet only. Real usage claims the shared bottom band via
 * `ContextualActionBar` (hides the marketing tab bar while visible). The Page
 * Editor's simulated mobile-frame preview stays `sticky` (a real `fixed` bar
 * would escape the preview frame and dock to the actual browser viewport).
 */
function PropertyReserveCta({
  editorPreview,
  baseRate,
  rating,
  reviews,
  onReserve,
}: {
  editorPreview: boolean;
  baseRate: number;
  rating: number | null;
  reviews: number;
  onReserve: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const content = (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-foreground text-lg font-bold">₱{baseRate.toLocaleString()}</span>
          <span className="text-muted-foreground text-sm">/ night</span>
        </div>
        {rating != null ? (
          <p className="text-muted-foreground truncate text-sm">
            {rating} ★ · {reviews} reviews
          </p>
        ) : null}
      </div>
      <Button
        size="lg"
        className="min-h-[44px] shrink-0 rounded-full px-8"
        type="button"
        onClick={onReserve}
      >
        Reserve
      </Button>
    </div>
  );

  if (editorPreview) {
    return (
      <motion.div
        initial={reduceMotion ? false : { y: 100 }}
        animate={{ y: 0 }}
        className="border-border bg-background/95 sticky bottom-0 z-40 border-t p-4 backdrop-blur-lg"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <ContextualActionBar>
      <motion.div initial={reduceMotion ? false : { y: 100 }} animate={{ y: 0 }} className="w-full">
        {content}
      </motion.div>
    </ContextualActionBar>
  );
}
