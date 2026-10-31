/**
 * Stage-specific sub-form switch — ported from the pre-decomposition
 * `WorkflowPanel.tsx`. Selects which sub-form / info card to render based on
 * `workflowContentForView()` (`viewedContent`), computed upstream by
 * `useWorkflowActions`.
 */

import { Copy, ExternalLink, Loader2 } from 'lucide-react';

import { GuestBalanceSettlementForm } from '@/features/dashboard/bookings/components/GuestBalanceSettlementForm';
import type { GuestBalanceSettlementValues } from '@/features/dashboard/bookings/components/GuestBalanceSettlementForm';
import {
  GuestSdRefundEditForm,
  type GuestSdRefundEditValues,
} from '@/features/dashboard/bookings/components/GuestSdRefundEditForm';
import { ParkingRequestForm } from '@/features/dashboard/bookings/components/ParkingRequestForm';
import type { ParkingRequestValues } from '@/features/dashboard/bookings/components/ParkingRequestForm';
import { ReviewPricingForm } from '@/features/dashboard/bookings/components/ReviewPricingForm';
import type { ReviewPricingFormValues } from '@/features/dashboard/bookings/components/ReviewPricingForm';
import { SdRefundForm } from '@/features/dashboard/bookings/components/SdRefundForm';
import type { SdRefundValues } from '@/features/dashboard/bookings/components/SdRefundForm';
import { SurpriseDecorAckCard } from '@/features/dashboard/bookings/components/SurpriseDecorAckCard';
import { WorkflowCompletedSummaryCard } from '@/features/dashboard/bookings/components/workflow-panel/WorkflowCompletedSummaryCard';
import { PendingDocSubStatusCard } from '@/features/dashboard/bookings/components/workflow-panel/WorkflowPendingDocStatusCard';
import { WorkflowSubFormCard } from '@/features/dashboard/bookings/components/WorkflowSubFormCard';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type {
  PendingDocNestedKey,
  WorkflowViewContent,
} from '@/features/dashboard/bookings/lib/workflow';
import { isProgressEditFormEnabled } from '@/features/dashboard/bookings/lib/workflow';
import { pipelineAdvanceDisplay } from '@/features/dashboard/bookings/lib/workflowAdvanceMode';
import type { PricingHolidayRuleDto } from '@/features/dashboard/pricing/lib/phHolidayRules';
import type { PropertyPricingDefaults } from '@/features/dashboard/pricing/lib/pricingCompute';

import { cn } from '@/lib/utils';

const SD_GUEST_CHECK_ACTION =
  'focus-ring inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end rounded-md px-1 text-xs font-semibold text-primary underline-offset-2 hover:underline hover:text-primary/90 disabled:pointer-events-none disabled:opacity-50';

const SD_FORM_LINK_ICON =
  'focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

type Props = {
  isModal: boolean;
  booking: BookingRow;
  automatedBookingFlow?: boolean;
  viewedContent: WorkflowViewContent | null;
  contentReadOnly: boolean;
  /** Pricing leaf — independent of other progress forms. */
  pricingReadOnly?: boolean;
  /** When true, drafts emit even if incomplete (rail Save without Proceed). */
  persistPartialDrafts: boolean;
  activePendingDocSubStatus: PendingDocNestedKey;
  documentRequirements: DocumentRequirement[];

  // Pricing sub-form
  pricingValues: ReviewPricingFormValues | null;
  onPricingChange: (values: ReviewPricingFormValues | null) => void;
  propertyPricingLoaded: boolean;
  propertyPricingDefaults: PropertyPricingDefaults;
  propertyPricingDateOverrides?: Record<string, number>;
  propertyPricingHolidayRules?: PricingHolidayRuleDto[];
  propertyPricingSmartRecommendations?: Record<string, number>;
  surpriseDecorStaffAck: boolean;
  onSurpriseDecorStaffAckChange: (value: boolean) => void;

  // Parking sub-form
  parkingValues: ParkingRequestValues | null;
  onParkingChange: (values: ParkingRequestValues | null) => void;

  // Guest balance sub-form
  guestBalanceValues: GuestBalanceSettlementValues | null;
  onGuestBalanceChange: (values: GuestBalanceSettlementValues | null) => void;

  // SD refund sub-form
  sdRefundValues: SdRefundValues | null;
  onSdRefundChange: (values: SdRefundValues | null) => void;
  onSdRefundGuestChange: (values: GuestSdRefundEditValues | null) => void;

  // SD guest-info card (READY_FOR_CHECKOUT)
  sdGuestFormUrl: string;
  onCopySdGuestFormUrl: () => void;
  recheckSdGuestSubmitPending: boolean;
  onRecheckGuestSdSubmission: () => void;
  onPreview: BookingAssetPreviewHandler;
};

export function WorkflowSubFormHost({
  isModal,
  booking,
  automatedBookingFlow = true,
  viewedContent,
  contentReadOnly,
  pricingReadOnly,
  persistPartialDrafts,
  activePendingDocSubStatus,
  documentRequirements,
  pricingValues,
  onPricingChange,
  propertyPricingLoaded,
  propertyPricingDefaults,
  propertyPricingDateOverrides,
  propertyPricingHolidayRules,
  propertyPricingSmartRecommendations,
  surpriseDecorStaffAck,
  onSurpriseDecorStaffAckChange,
  parkingValues,
  onParkingChange,
  guestBalanceValues,
  onGuestBalanceChange,
  sdRefundValues,
  onSdRefundChange,
  onSdRefundGuestChange,
  sdGuestFormUrl,
  onCopySdGuestFormUrl,
  recheckSdGuestSubmitPending,
  onRecheckGuestSdSubmission,
  onPreview,
}: Props) {
  const needsPricing = viewedContent === 'pricing';
  const needsParking = viewedContent === 'parking';
  const needsSdRefund = viewedContent === 'sd_refund';
  const needsGuestBalance = viewedContent === 'guest_balance';
  const needsDocSubStatus = viewedContent === 'doc_sub_status';
  const showSdGuestInfoCard = viewedContent === 'sd_guest_info';
  const showCompletedSummary = viewedContent === 'completed_summary';
  const showStageContent =
    needsPricing ||
    needsParking ||
    needsSdRefund ||
    needsGuestBalance ||
    needsDocSubStatus ||
    showSdGuestInfoCard ||
    showCompletedSummary;

  const sdIsZero = Number(booking.security_deposit ?? 0) === 0;
  const sdGuestAdvanceDisplay = pipelineAdvanceDisplay('READY_FOR_CHECKOUT', {
    sdIsZero,
    automatedBookingFlow,
  });
  const planUpgradeFeature =
    automatedBookingFlow === false ? ('automatedBookingFlow' as const) : undefined;

  if (!showStageContent) return null;

  const formVariant = isModal ? 'modal' : 'workflow';
  const editMode = persistPartialDrafts && !contentReadOnly;
  const showGuestSdEdit =
    needsSdRefund && !contentReadOnly && isProgressEditFormEnabled(booking, 'sd_refund_guest');

  return (
    <div
      className={cn(
        isModal
          ? 'min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5'
          : 'border-separator space-y-6 border-b px-4 py-4'
      )}
    >
      {showSdGuestInfoCard && (
        <WorkflowSubFormCard
          title="Guest SD refund form"
          plain={isModal}
          advanceDisplay={sdGuestAdvanceDisplay}
          upgradeFeature={planUpgradeFeature}
        >
          <div className="flex min-h-11 items-start justify-between gap-3">
            <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-snug">
              Guest hasn’t submitted the SD refund form yet
            </p>
            <button
              type="button"
              disabled={recheckSdGuestSubmitPending}
              onClick={onRecheckGuestSdSubmission}
              aria-label="Check for guest submission"
              aria-busy={recheckSdGuestSubmitPending}
              className={SD_GUEST_CHECK_ACTION}
            >
              {recheckSdGuestSubmitPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                'Check'
              )}
            </button>
          </div>
          <div className="border-border/70 bg-muted/40 flex min-h-11 min-w-0 items-center rounded-lg border pl-3">
            <p
              className="text-foreground min-w-0 flex-1 truncate text-xs font-medium"
              title={sdGuestFormUrl}
            >
              SD refund form link
            </p>
            <a
              href={sdGuestFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open SD refund form"
              className={SD_FORM_LINK_ICON}
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <button
              type="button"
              onClick={onCopySdGuestFormUrl}
              aria-label="Copy SD refund form link"
              className={SD_FORM_LINK_ICON}
            >
              <Copy className="size-3.5" aria-hidden />
            </button>
          </div>
        </WorkflowSubFormCard>
      )}
      {showCompletedSummary && (
        <WorkflowCompletedSummaryCard booking={booking} plain={isModal} onPreview={onPreview} />
      )}
      {needsDocSubStatus && (
        <PendingDocSubStatusCard
          booking={booking}
          sub={activePendingDocSubStatus}
          requirements={documentRequirements}
          plain={isModal}
          automatedBookingFlow={automatedBookingFlow}
          onPreview={onPreview}
        />
      )}
      {needsPricing && (
        <>
          <ReviewPricingForm
            key={`${booking.id}-pricing-sd-${booking.guest_requests_surprise_decor ? 1 : 0}-${propertyPricingLoaded ? 'loaded' : 'pending'}`}
            booking={booking}
            initialDraft={pricingValues}
            onChange={onPricingChange}
            readOnly={pricingReadOnly ?? contentReadOnly}
            editMode={editMode}
            propertyDefaults={propertyPricingDefaults}
            dateOverrides={propertyPricingDateOverrides}
            holidayRules={propertyPricingHolidayRules}
            smartRecommendations={propertyPricingSmartRecommendations}
            variant={formVariant}
          />
          {booking.guest_requests_surprise_decor ? (
            <SurpriseDecorAckCard
              acknowledged={surpriseDecorStaffAck}
              onAcknowledgedChange={onSurpriseDecorStaffAckChange}
              readOnly={contentReadOnly}
              plain={isModal}
            />
          ) : null}
        </>
      )}
      {needsParking && (
        <ParkingRequestForm
          booking={booking}
          initialDraft={parkingValues}
          onChange={onParkingChange}
          readOnly={contentReadOnly}
          editMode={editMode}
          variant={formVariant}
          onPreview={onPreview}
        />
      )}
      {needsGuestBalance && (
        <GuestBalanceSettlementForm
          booking={booking}
          initialDraft={guestBalanceValues}
          onChange={onGuestBalanceChange}
          readOnly={contentReadOnly}
          editMode={editMode}
          variant={formVariant}
          onPreview={onPreview}
        />
      )}
      {needsSdRefund && (
        <>
          {showGuestSdEdit ? (
            <GuestSdRefundEditForm
              key={`${booking.id}-sd-guest`}
              booking={booking}
              onChange={onSdRefundGuestChange}
              editMode={editMode}
              variant={formVariant === 'modal' ? 'modal' : 'workflow'}
            />
          ) : null}
          <SdRefundForm
            booking={booking}
            initialDraft={sdRefundValues}
            onChange={onSdRefundChange}
            readOnly={contentReadOnly}
            editMode={editMode}
            variant={formVariant}
            showGuestDetails={!showGuestSdEdit}
            onPreview={onPreview}
          />
        </>
      )}
    </div>
  );
}
