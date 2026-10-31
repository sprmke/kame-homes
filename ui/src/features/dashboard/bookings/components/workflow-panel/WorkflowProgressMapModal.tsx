/**
 * Full progress map, on demand.
 *
 * Free / Paid toggle previews Auto/Manual badges and step copy; header shows a one-line plan summary.
 */

import { useEffect, useState } from 'react';

import { BookingStepper } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingStepper';
import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type {
  PendingDocNestedKey,
  ViewedWorkflowStep,
} from '@/features/dashboard/bookings/lib/workflow';
import { WORKFLOW_PLAN_PREVIEW_SUMMARY } from '@/features/dashboard/bookings/lib/workflowAdvanceMode';
import { PlanGatedText } from '@/features/dashboard/plans/components/PlanUpgradeLink';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';

type PlanPreview = 'free' | 'paid';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingRow;
  currentStatus: BookingStatus;
  documentRequirements: DocumentRequirement[];
  viewedStep: ViewedWorkflowStep;
  disabled?: boolean;
  onSelectStep: (step: BookingStatus) => void;
  onSelectSubStep: (sub: PendingDocNestedKey) => void;
  sdRefundEmailLeadMinutes?: number;
  automatedBookingFlow?: boolean;
};

export function WorkflowProgressMapModal({
  open,
  onOpenChange,
  booking,
  currentStatus,
  documentRequirements,
  viewedStep,
  disabled,
  onSelectStep,
  onSelectSubStep,
  sdRefundEmailLeadMinutes,
  automatedBookingFlow,
}: Props) {
  const actualPaid = automatedBookingFlow !== false;
  const [planPreview, setPlanPreview] = useState<PlanPreview>(actualPaid ? 'paid' : 'free');

  useEffect(() => {
    if (open) setPlanPreview(actualPaid ? 'paid' : 'free');
  }, [open, actualPaid]);

  const previewPaid = planPreview === 'paid';
  const previewingPaidOnFree = !actualPaid && previewPaid;

  const planSummary = previewingPaidOnFree ? (
    <PlanGatedText
      feature="automatedBookingFlow"
      text={`${WORKFLOW_PLAN_PREVIEW_SUMMARY.paid} Upgrade to enable on your plan.`}
    />
  ) : previewPaid ? (
    WORKFLOW_PLAN_PREVIEW_SUMMARY.paid
  ) : (
    WORKFLOW_PLAN_PREVIEW_SUMMARY.free
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(92dvh,48rem)] w-full max-w-[min(calc(100vw-1.5rem),42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <ResponsiveModalHeader className="border-separator shrink-0 space-y-2 border-b px-4 pb-3 pt-1 sm:px-6 sm:pb-3.5">
          <div className="flex min-h-9 items-center justify-between gap-3">
            <ResponsiveModalTitle className="min-w-0 truncate text-left">
              Booking Workflow
            </ResponsiveModalTitle>
            <SlidingTabs
              value={planPreview}
              onValueChange={(value) => {
                if (value === 'free' || value === 'paid') setPlanPreview(value);
              }}
              className="shrink-0"
            >
              <SlidingTabsList size="dense" aria-label="Compare Free and Paid workflow">
                <SlidingTabsTrigger value="free">Free</SlidingTabsTrigger>
                <SlidingTabsTrigger value="paid">Paid</SlidingTabsTrigger>
              </SlidingTabsList>
            </SlidingTabs>
          </div>
          <p className="text-muted-foreground text-xs leading-snug">{planSummary}</p>
        </ResponsiveModalHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <BookingStepper
            booking={booking}
            documentRequirements={documentRequirements}
            currentStatus={currentStatus}
            statusUpdatedAt={booking.status_updated_at}
            viewedStep={viewedStep}
            disabled={disabled}
            showAdvanceGuide
            sdRefundEmailLeadMinutes={sdRefundEmailLeadMinutes}
            automatedBookingFlow={previewPaid}
            onSelectStep={(step) => {
              onSelectStep(step);
              onOpenChange(false);
            }}
            onSelectSubStep={(sub) => {
              onSelectSubStep(sub);
              onOpenChange(false);
            }}
          />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
