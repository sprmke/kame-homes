/**
 * BookingDetailPage — /bookings/:bookingId
 *
 * View mode: one `BookingDetailShell` (header + tabs + panels) matching edit chrome
 * (AI Summary? / Stay / Guests / Parking? / Pets? / Pricing? / Files).
 * Edit mode: `BookingEditForm` / `BookingEditTabs` — same shell; Stay / Guests / Parking / Pets.
 *
 * Mobile: compact summary strip; Progress stays above the fold; detail panels collapse.
 *
 * Right rail is `lg:sticky` so Progress stays visible while the left column scrolls, and the
 * booking refetches on a 60s interval (visibility-gated) so server-side/cron-driven transitions
 * surface without a manual refresh — see `.claude/skills/admin-dashboard/SKILL.md`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useParams, Link } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { guestParkingRequestStatusPath } from '@/features/guest/lib/guestPublicPaths';

import { EntityActivityHistory } from '@/features/dashboard/activity/components/EntityActivityHistory';
import { BookingAiAssistantAuditCard } from '@/features/dashboard/ai-assistant/components/BookingAiAssistantAuditCard';
import { BookingDetailAssetPreviewModal } from '@/features/dashboard/bookings/components/booking-detail/BookingDetailAssetPreviewModal';
import { BookingDetailHeader } from '@/features/dashboard/bookings/components/booking-detail/BookingDetailHeader';
import {
  BookingDetailTabs,
  type BookingViewTab,
} from '@/features/dashboard/bookings/components/booking-detail/BookingDetailTabs';
import type { BookingEditTabId } from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditTabs';
import { AiSummaryPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/AiSummaryPanel';
import { DocumentsPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/DocumentsPanel';
import { GuestsPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/GuestsPanel';
import { OtherInfoPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/OtherInfoPanel';
import { ParkingPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/ParkingPanel';
import { PetsPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/PetsPanel';
import { PricingSummaryPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/PricingSummaryPanel';
import { StayDetailsPanel } from '@/features/dashboard/bookings/components/booking-detail/panels/StayDetailsPanel';
import {
  BookingDetailShell,
  BookingDetailShellBody,
} from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailShell';
import { RescheduleBookingModal } from '@/features/dashboard/bookings/components/booking-detail/RescheduleBookingModal';
import { BookingDetailMobileSummary } from '@/features/dashboard/bookings/components/BookingDetailMobileSummary';
import { BookingEditForm } from '@/features/dashboard/bookings/components/BookingEditForm';
import { BookingMetaCard } from '@/features/dashboard/bookings/components/BookingMetaCard';
import { OwnerParkingConfirmSheet } from '@/features/dashboard/bookings/components/OwnerParkingConfirmSheet';
import { WorkflowPanel } from '@/features/dashboard/bookings/components/workflow-panel/WorkflowPanel';
import { useAdminBookedDates } from '@/features/dashboard/bookings/hooks/useAdminBookedDates';
import { bookingDetailQueryKey, useBooking } from '@/features/dashboard/bookings/hooks/useBooking';
import {
  invalidateBookingAiReviewQueries,
  useBookingAiReview,
} from '@/features/dashboard/bookings/hooks/useBookingAiReview';
import { useBookingAssetPreview } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import { useBookingGuestFormCompletionLink } from '@/features/dashboard/bookings/hooks/useBookingGuestFormCompletionLink';
import { useBookingParkingShareLink } from '@/features/dashboard/bookings/hooks/useBookingParkingShareLink';
import { useBookingStayGuideLink } from '@/features/dashboard/bookings/hooks/useBookingStayGuideLink';
import { useEnsureNeedParking } from '@/features/dashboard/bookings/hooks/useEnsureNeedParking';
import { useLinkedParkingBooking } from '@/features/dashboard/bookings/hooks/useLinkedParkingBooking';
import { useOwnerDefaultParking } from '@/features/dashboard/bookings/hooks/useOwnerDefaultParking';
import type { OwnerDefaultParkingSlot } from '@/features/dashboard/bookings/hooks/useOwnerDefaultParking';
import { useRescheduleBooking } from '@/features/dashboard/bookings/hooks/useRescheduleBooking';
import { hasBookingAiReviewRun } from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import { buildBookingDetailActions } from '@/features/dashboard/bookings/lib/bookingDetailActions';
import { canRescheduleBookingAtStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  absoluteBookingParkingFindUrl,
  absoluteBookingParkingOwnDefaultUrl,
  propertyCityLocationSlug,
} from '@/features/dashboard/bookings/lib/parkingFindPathFromBooking';
import { resolveBookingViewTab } from '@/features/dashboard/bookings/lib/resolveBookingViewTab';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import {
  bookingEditableTabs,
  BOOKING_EDIT_TAB_PERMISSION,
  hasPropertyPermission,
} from '@/features/dashboard/team/lib/propertyPermissions';

import { MobileBrandHero } from '@/components/mobile/MobileBrandHero';
import { BookingDetailPageSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { useMobileHeroCollapseProgress } from '@/hooks/useMobileHeroCollapseProgress';
import { propertyDashboardPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

/** Server-side/cron-driven transitions land without a manual refresh — poll while this page is open. */
const AUTO_REFRESH_INTERVAL_MS = 60_000;

export function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { property } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const { data: booking, isLoading, error } = useBooking(bookingId);
  const {
    data: aiReview,
    isSuccess: aiReviewLoaded,
    isError: aiReviewFailed,
  } = useBookingAiReview(bookingId);
  const hasAiSummaryRun = hasBookingAiReviewRun(aiReview);
  const guestName = booking?.primary_guest_name || booking?.guest_facebook_name;
  usePageTitle(
    booking
      ? propertyDashboardPageTitle(
          property.name,
          guestName ? `Booking: ${guestName}` : `Booking ${booking.id.slice(0, 8)}`
        )
      : undefined
  );
  const { data: propertyAccess } = usePropertyPermissions();
  const editableTabs = bookingEditableTabs(propertyAccess?.permissions);
  const canEditBooking = editableTabs.length > 0;
  const canMutateWorkflow = hasPropertyPermission(
    propertyAccess?.permissions,
    'bookings.detail.workflow:edit'
  );
  const canEditStay = hasPropertyPermission(
    propertyAccess?.permissions,
    BOOKING_EDIT_TAB_PERMISSION.stay
  );
  const canEditParking = hasPropertyPermission(
    propertyAccess?.permissions,
    BOOKING_EDIT_TAB_PERMISSION.parking
  );
  const canEditPets = hasPropertyPermission(
    propertyAccess?.permissions,
    BOOKING_EDIT_TAB_PERMISSION.pets
  );
  const [editMode, setEditMode] = useState(false);
  const [editInitialTab, setEditInitialTab] = useState<BookingEditTabId | undefined>(undefined);
  const { previewAsset, previewLoading, handlePreview, closePreview } = useBookingAssetPreview();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [viewTab, setViewTab] = useState<BookingViewTab>('overview');
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const defaultTabAppliedFor = useRef<string | null>(null);
  const isBelowMd = useIsBelowMd();
  const heroRef = useRef<HTMLElement | null>(null);
  const heroCollapse = useMobileHeroCollapseProgress(heroRef, isBelowMd);
  const ensureNeedParking = useEnsureNeedParking();
  const locationSlug = useMemo(
    () => propertyCityLocationSlug(property.settings),
    [property.settings]
  );
  const linkedParkingQuery = useLinkedParkingBooking(booking?.id, booking?.need_parking === true);
  const ownerDefaultQuery = useOwnerDefaultParking(booking?.id, true);
  const hasOwnDefaultParking = Boolean(ownerDefaultQuery.data?.defaultParking?.slug);
  const [ownerParkingSheetOpen, setOwnerParkingSheetOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const canReschedule = canEditStay && !!booking && canRescheduleBookingAtStatus(booking.status);
  const { data: bookedDates = [] } = useAdminBookedDates(property.slug, canReschedule);
  const rescheduleMut = useRescheduleBooking();

  const copyBookingIdToClipboard = useCallback(async () => {
    const id = bookingId?.trim();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [bookingId]);

  useEffect(() => {
    setDetailsExpanded(false);
    setEditMode(false);
    setEditInitialTab(undefined);
    setViewTab('overview');
    defaultTabAppliedFor.current = null;
  }, [bookingId]);

  /**
   * Landing tab per visit: AI Summary when a run exists, else Stay. Applied once per
   * booking (after the review query settles) so a later manual tab choice — or a run
   * finishing while the host reads another tab — never yanks them elsewhere.
   */
  useEffect(() => {
    if (!bookingId || !booking) return;
    if (defaultTabAppliedFor.current === bookingId) return;
    if (!aiReviewLoaded && !aiReviewFailed) return;
    defaultTabAppliedFor.current = bookingId;
    setViewTab(hasAiSummaryRun ? 'ai_summary' : 'overview');
  }, [bookingId, booking, aiReviewLoaded, aiReviewFailed, hasAiSummaryRun]);

  useEffect(() => {
    if (!booking) return;
    setViewTab((tab) => resolveBookingViewTab(tab, booking, { hasAiSummaryRun }));
  }, [booking, hasAiSummaryRun]);

  useEffect(() => {
    if (editMode) setDetailsExpanded(true);
  }, [editMode]);

  // Surfaces inbound approval / SD-refund-cron transitions without a manual refresh.
  useEffect(() => {
    if (!bookingId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void queryClient.invalidateQueries({
        queryKey: bookingDetailQueryKey(bookingId, propertyId),
      });
      void invalidateBookingAiReviewQueries(queryClient, bookingId);
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [bookingId, propertyId, queryClient]);

  /** Collapsed guest cards on mobile so Progress stays above the fold. */
  const isMobileWorkflowFirst = isBelowMd && booking != null;

  const showMobileDetailCards = !isMobileWorkflowFirst || detailsExpanded || editMode;

  /** Expanded details sit between summary and Progress on mobile (not below the fold). */
  const mobileDetailsBeforeWorkflow = isMobileWorkflowFirst && showMobileDetailCards;

  const handleToggleDetails = useCallback(() => {
    setDetailsExpanded((was) => !was);
  }, []);

  const handleStartEdit = useCallback(
    (tab?: BookingEditTabId) => {
      if (!canEditBooking) return;
      if (tab && !editableTabs.includes(tab)) return;
      setEditInitialTab(tab ?? editableTabs[0]);
      setEditMode(true);
    },
    [canEditBooking, editableTabs]
  );

  const handleCloseEdit = useCallback(() => {
    setEditMode(false);
    setEditInitialTab(undefined);
  }, []);

  const openOwnParkingSlot = useCallback(
    (slot: OwnerDefaultParkingSlot) => {
      if (!booking) return;
      const url = absoluteBookingParkingOwnDefaultUrl(booking, slot.slug);
      window.open(url, '_blank', 'noopener,noreferrer');
      setOwnerParkingSheetOpen(false);
    },
    [booking]
  );

  const copyOwnParkingSlot = useCallback(
    (slot: OwnerDefaultParkingSlot) => {
      if (!booking) return;
      const url = absoluteBookingParkingOwnDefaultUrl(booking, slot.slug);
      void navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Parking link copied'))
        .catch(() => toast.error('Could not copy link'));
    },
    [booking]
  );

  const handleFindParking = useCallback(async () => {
    if (!booking) return;

    const linked = linkedParkingQuery.data;
    if (linked?.linked === true && linked.parkingBookingId) {
      window.open(
        `${window.location.origin}${guestParkingRequestStatusPath(linked.parkingBookingId)}`,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    try {
      await ensureNeedParking.mutateAsync({
        bookingId: booking.id,
      });
      if (booking.status === 'PENDING_REVIEW') {
        toast.message('Guest can reserve after this booking moves past review');
      }

      const available = ownerDefaultQuery.data?.available ?? [];
      const ownSlug = ownerDefaultQuery.data?.defaultParking?.slug?.trim();
      if (available.length > 1) {
        setOwnerParkingSheetOpen(true);
        return;
      }
      if (ownSlug && available[0]) {
        openOwnParkingSlot(available[0]);
        return;
      }
      if (ownSlug) {
        const url = absoluteBookingParkingOwnDefaultUrl(booking, ownSlug);
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (ownerDefaultQuery.data?.hasOrgParkings && !ownSlug) {
        toast.message('Your parking is booked for these dates. Searching others');
      }

      const url = absoluteBookingParkingFindUrl(booking, locationSlug);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open parking search');
    }
  }, [
    booking,
    ensureNeedParking,
    linkedParkingQuery.data,
    locationSlug,
    openOwnParkingSlot,
    ownerDefaultQuery.data,
  ]);

  const handleSearchOtherParkings = useCallback(async () => {
    if (!booking) return;

    const linked = linkedParkingQuery.data;
    if (linked?.linked === true && linked.parkingBookingId) {
      window.open(
        `${window.location.origin}${guestParkingRequestStatusPath(linked.parkingBookingId)}`,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    try {
      await ensureNeedParking.mutateAsync({
        bookingId: booking.id,
      });
      if (booking.status === 'PENDING_REVIEW') {
        toast.message('Guest can reserve after this booking moves past review');
      }
      const url = absoluteBookingParkingFindUrl(booking, locationSlug);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open parking search');
    }
  }, [booking, ensureNeedParking, linkedParkingQuery.data, locationSlug]);

  const stayGuide = useBookingStayGuideLink(booking);
  const guestFormCompletion = useBookingGuestFormCompletionLink(booking);
  const parkingShareLink = useBookingParkingShareLink(booking, ownerDefaultQuery.data);

  const handleOpenAiSummary = useCallback(() => setAiSummaryOpen(true), []);

  const handleRescheduleConfirm = useCallback(
    (checkInDate: string, checkOutDate: string) => {
      if (!booking) return;
      rescheduleMut.mutate(
        {
          bookingId: booking.id,
          checkInDate,
          checkOutDate,
          currentDocumentRequirementCompletions: booking.document_requirement_completions,
        },
        {
          onSuccess: () => {
            toast.success('Booking rescheduled');
            setRescheduleOpen(false);
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Could not reschedule booking');
          },
        }
      );
    },
    [booking, rescheduleMut]
  );

  const hostActions = useMemo(
    () =>
      booking
        ? buildBookingDetailActions({
            booking,
            onEdit: handleStartEdit,
            onReschedule: () => setRescheduleOpen(true),
            onFindParking: () => {
              void handleFindParking();
            },
            onSearchOtherParkings: () => {
              void handleSearchOtherParkings();
            },
            onOpenAiSummary: handleOpenAiSummary,
            stayGuide,
            guestFormCompletion,
            parkingShareLink,
            canRunAiSummary: canEditStay,
            canEditParking,
            canEditPets,
            canManagePayParking: canEditParking,
            canReschedule,
            hasOwnDefaultParking,
          })
        : [],
    [
      booking,
      handleStartEdit,
      handleFindParking,
      handleSearchOtherParkings,
      handleOpenAiSummary,
      stayGuide,
      guestFormCompletion,
      parkingShareLink,
      canEditStay,
      canEditParking,
      canEditPets,
      canReschedule,
      hasOwnDefaultParking,
    ]
  );

  return (
    <>
      {/* Phone-only brand hero band — matches the rest of the dashboard shell.
       * Tablet/desktop keep the existing layout + `AdminLayout` topbar untouched. */}
      <MobileBrandHero
        ref={heroRef}
        title="Booking"
        collapseProgress={heroCollapse}
        flush
        className="md:hidden"
      />
      <div data-page-brand-hero className="space-y-4 max-md:px-3.5 max-md:pt-3">
        {/* Back nav */}
        <Link
          to="/bookings"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Bookings
        </Link>

        {/* Loading */}
        {isLoading && <BookingDetailPageSkeleton />}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            Failed to load booking. Please refresh.
          </div>
        )}

        {/* Not found */}
        {!isLoading && !booking && !error && (
          <div className="border-border bg-card text-muted-foreground rounded-xl border p-10 text-center text-sm">
            Booking not found.
          </div>
        )}

        {booking && (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5 lg:gap-6">
            {isMobileWorkflowFirst && (
              <BookingDetailMobileSummary
                className="order-1 md:hidden"
                booking={booking}
                detailsExpanded={detailsExpanded}
                onToggleDetails={handleToggleDetails}
                editMode={editMode}
                onEdit={canEditBooking ? () => handleStartEdit() : undefined}
                onCancelEdit={handleCloseEdit}
                actions={hostActions}
              />
            )}

            {/* ── Full booking details (collapsible on mobile) ───────────── */}
            <Collapsible
              open={showMobileDetailCards}
              onOpenChange={(open) => {
                if (isMobileWorkflowFirst && !editMode) {
                  setDetailsExpanded(open);
                }
              }}
              className={cn(
                'min-w-0 flex-1',
                isMobileWorkflowFirst && (mobileDetailsBeforeWorkflow ? 'order-2' : 'order-3'),
                isMobileWorkflowFirst && 'md:order-none'
              )}
            >
              <CollapsibleContent
                id="booking-detail-full-panel"
                className={cn(
                  'space-y-5 overflow-hidden',
                  'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
                  'motion-reduce:animate-none',
                  'md:animate-none md:overflow-visible'
                )}
              >
                {editMode ? (
                  <BookingEditForm
                    key={`${booking.id}-${editInitialTab ?? 'guest'}`}
                    booking={booking}
                    initialTab={editInitialTab}
                    allowedTabs={editableTabs}
                    onClose={handleCloseEdit}
                    onSaved={handleCloseEdit}
                    onPreview={handlePreview}
                  />
                ) : (
                  <BookingDetailShell>
                    <BookingDetailHeader
                      booking={booking}
                      onEdit={() => handleStartEdit()}
                      canEdit={canEditBooking}
                      actions={hostActions}
                      className={cn(isMobileWorkflowFirst && 'hidden md:block')}
                    />

                    <BookingDetailShellBody>
                      <BookingDetailTabs value={viewTab} onChange={setViewTab} booking={booking} />

                      {viewTab === 'ai_summary' && hasAiSummaryRun ? (
                        <AiSummaryPanel booking={booking} onPreview={handlePreview} />
                      ) : null}
                      {viewTab === 'overview' && (
                        <div className="space-y-4">
                          <StayDetailsPanel booking={booking} />
                          <OtherInfoPanel booking={booking} />
                          <BookingMetaCard
                            booking={booking}
                            onCopyBookingId={() => void copyBookingIdToClipboard()}
                          />
                          <BookingAiAssistantAuditCard bookingId={booking.id} />
                          <EntityActivityHistory
                            targetType="booking"
                            targetId={booking.id}
                            className="bg-card rounded-xl border p-4"
                          />
                        </div>
                      )}
                      {viewTab === 'guests' && (
                        <GuestsPanel booking={booking} onPreview={handlePreview} />
                      )}
                      {viewTab === 'parking' && booking.need_parking ? (
                        <ParkingPanel booking={booking} onPreview={handlePreview} />
                      ) : null}
                      {viewTab === 'pets' && booking.has_pets ? (
                        <PetsPanel booking={booking} onPreview={handlePreview} />
                      ) : null}
                      {viewTab === 'pricing' && booking.status !== 'PENDING_REVIEW' && (
                        <PricingSummaryPanel booking={booking} onPreview={handlePreview} />
                      )}
                      {viewTab === 'files' && (
                        <DocumentsPanel booking={booking} onPreview={handlePreview} />
                      )}
                    </BookingDetailShellBody>
                  </BookingDetailShell>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* ── Workflow / Progress (before fold on mobile when past review) ── */}
            <div
              className={cn(
                'w-full md:w-[min(100%,20rem)] md:shrink-0 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-2.5rem)] lg:w-[min(100%,24rem)] lg:self-start xl:w-[27rem]',
                isMobileWorkflowFirst && (mobileDetailsBeforeWorkflow ? 'order-3' : 'order-2'),
                isMobileWorkflowFirst && 'md:order-none'
              )}
            >
              <WorkflowPanel
                key={booking.id}
                booking={booking}
                onPreview={handlePreview}
                aiSummaryOpen={aiSummaryOpen}
                onOpenAiSummary={setAiSummaryOpen}
                canMutate={canMutateWorkflow}
              />
            </div>
          </div>
        )}
      </div>
      <BookingDetailAssetPreviewModal
        asset={previewAsset}
        booking={booking}
        loading={previewLoading}
        onClose={closePreview}
      />
      {booking && canReschedule && (
        <RescheduleBookingModal
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
          booking={booking}
          bookedDates={bookedDates}
          onConfirm={handleRescheduleConfirm}
          isSubmitting={rescheduleMut.isPending}
        />
      )}
      <OwnerParkingConfirmSheet
        open={ownerParkingSheetOpen}
        onOpenChange={setOwnerParkingSheetOpen}
        slots={ownerDefaultQuery.data?.available ?? []}
        defaultSlotId={ownerDefaultQuery.data?.defaultParking?.id ?? null}
        checkInDate={ownerDefaultQuery.data?.checkInDate ?? ''}
        checkOutDate={ownerDefaultQuery.data?.checkOutDate ?? ''}
        onOpen={openOwnParkingSlot}
        onCopy={copyOwnParkingSlot}
        onSearchOthers={() => {
          setOwnerParkingSheetOpen(false);
          void handleSearchOtherParkings();
        }}
      />
    </>
  );
}
