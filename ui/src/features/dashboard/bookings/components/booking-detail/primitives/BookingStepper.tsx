import { Check } from 'lucide-react';

import { statusToneStyle } from '@/features/dashboard/bookings/components/StatusBadge';
import { WorkflowAdvanceModeMark } from '@/features/dashboard/bookings/components/workflow-panel/WorkflowAdvanceModeBadge';
import { statusLabel, type BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  bookingPipeline,
  canNavigatePendingParkingSubStep,
  pendingDocumentsNestedItemsForStepper,
  PARKING_NESTED_KEY,
  type PendingDocNestedKey,
  type ViewedWorkflowStep,
} from '@/features/dashboard/bookings/lib/workflow';
import {
  cancelledAdvanceGuide,
  nestedAdvanceDisplay,
  nestedAdvanceGuide,
  pipelineAdvanceDisplay,
  pipelineAdvanceGuide,
} from '@/features/dashboard/bookings/lib/workflowAdvanceMode';

import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/bookingDisplay';

/**
 * The booking detail page's signature element — a redesigned pipeline
 * stepper. Purely presentational: all step order / completion logic comes
 * from `lib/workflow.ts` (same calls the pre-redesign `PipelineStepper` /
 * `PendingDocumentsSubTree` made), so this component never re-derives
 * transition rules.
 */
type BookingStepperProps = {
  booking: BookingRow;
  currentStatus: BookingStatus;
  statusUpdatedAt?: string | null;
  viewedStep: ViewedWorkflowStep;
  documentRequirements: DocumentRequirement[];
  onSelectStep: (step: BookingStatus) => void;
  onSelectSubStep: (sub: PendingDocNestedKey) => void;
  disabled?: boolean;
  size?: 'default' | 'compact';
  /** All-steps map: Auto/Manual pill + host guide on every row. */
  showAdvanceGuide?: boolean;
  sdRefundEmailLeadMinutes?: number;
  /** When false, guide copy avoids promising automated workflow emails. */
  automatedBookingFlow?: boolean;
};

function isPipelineStepSelected(step: BookingStatus, viewedStep: ViewedWorkflowStep): boolean {
  if (step === 'PENDING_DOCUMENTS') return viewedStep.kind === 'pending-doc-sub';
  return viewedStep.kind === 'pipeline' && viewedStep.status === step;
}

function AdvanceGuideLines({
  lines,
  size = 'step',
}: {
  lines: string[];
  size?: 'step' | 'nested';
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground space-y-1.5 text-pretty leading-snug',
        size === 'nested' ? 'text-[12.5px]' : 'text-[13px]'
      )}
    >
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function BookingStepper({
  booking,
  currentStatus,
  statusUpdatedAt,
  viewedStep,
  documentRequirements,
  onSelectStep,
  onSelectSubStep,
  disabled,
  size = 'default',
  showAdvanceGuide = false,
  sdRefundEmailLeadMinutes,
  automatedBookingFlow,
}: BookingStepperProps) {
  const pipeline = bookingPipeline(booking, currentStatus, documentRequirements);
  const sdIsZero = Number(booking.security_deposit ?? 0) === 0;
  const advanceOpts = { sdIsZero, sdRefundEmailLeadMinutes, automatedBookingFlow };
  const currentIdx = pipeline.indexOf(currentStatus);
  const pendingDocsIdx = pipeline.indexOf('PENDING_DOCUMENTS');
  const pendingDocsBrowsable =
    pendingDocsIdx >= 0 && currentIdx >= pendingDocsIdx && currentStatus !== 'CANCELLED';
  const compact = size === 'compact';

  return (
    <div className="flex flex-col">
      <ol className="flex flex-col">
        {pipeline.map((step, i) => {
          const isCompleted = currentIdx >= 0 && i < currentIdx;
          const isCurrent = i === currentIdx;
          const isLast = i === pipeline.length - 1;
          const isReachable = isCompleted || isCurrent;
          const isSelected = isPipelineStepSelected(step, viewedStep);
          // The live step wears its own status tone here for the same reason the
          // rail's track does — one color language for "where the booking is".
          const tone = statusToneStyle(step);

          const labelClass = cn(
            compact ? 'text-xs' : 'text-sm',
            'leading-tight transition-colors',
            isSelected || isCurrent
              ? 'text-primary font-semibold'
              : isCompleted
                ? 'text-foreground font-medium'
                : 'text-muted-foreground font-medium'
          );
          const advanceDisplay = showAdvanceGuide
            ? pipelineAdvanceDisplay(step, advanceOpts)
            : null;
          const advanceGuide = showAdvanceGuide ? pipelineAdvanceGuide(step, advanceOpts) : [];

          return (
            <li key={step} className="flex gap-3">
              <div className="flex w-6 shrink-0 flex-col items-center">
                <div className="flex size-6 shrink-0 items-center justify-center">
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full transition-all',
                      isCurrent
                        ? cn('size-6 border', tone.badge)
                        : isCompleted
                          ? 'gradient-primary text-primary-foreground size-5'
                          : 'bg-card ring-border/60 size-5 ring-1'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : isCurrent ? (
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          tone.dot,
                          tone.pulse && 'motion-safe:animate-pulse'
                        )}
                      />
                    ) : null}
                  </div>
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'mb-0.5 mt-0.5 min-h-[14px] w-px flex-1',
                      isCompleted ? 'gradient-primary opacity-40' : 'bg-muted'
                    )}
                  />
                )}
              </div>

              <div
                className={cn(
                  'flex min-w-0 flex-1 flex-col',
                  showAdvanceGuide ? 'gap-1.5' : 'gap-3',
                  isLast ? 'pb-0' : compact ? 'pb-2' : showAdvanceGuide ? 'pb-5' : 'pb-3'
                )}
              >
                <div className="flex min-h-6 min-w-0 items-center gap-2">
                  {isReachable ? (
                    <button
                      type="button"
                      disabled={!!disabled}
                      onClick={() => {
                        if (!disabled) onSelectStep(step);
                      }}
                      className={cn(
                        '-my-[10px] inline-flex min-h-[44px] min-w-0 flex-1 items-center py-2 text-left leading-tight transition-colors',
                        disabled ? 'text-muted-foreground cursor-not-allowed' : labelClass,
                        !disabled && !isSelected && isCompleted ? 'hover:text-primary' : null
                      )}
                      aria-label={`View ${statusLabel(step)}`}
                      aria-current={isSelected ? 'step' : undefined}
                    >
                      {statusLabel(step)}
                    </button>
                  ) : (
                    <div className={cn(labelClass, 'min-w-0 flex-1')}>{statusLabel(step)}</div>
                  )}
                  {advanceDisplay ? (
                    <WorkflowAdvanceModeMark
                      mode={advanceDisplay.mode}
                      label={advanceDisplay.label}
                      className="shrink-0"
                    />
                  ) : null}
                </div>
                {advanceGuide.length > 0 ? <AdvanceGuideLines lines={advanceGuide} /> : null}
                {isCurrent && statusUpdatedAt && (
                  <div className="text-caption">Since {formatRelative(statusUpdatedAt)}</div>
                )}
                {step === 'PENDING_DOCUMENTS' && pendingDocsBrowsable && (
                  <PendingDocumentsSubTree
                    booking={booking}
                    documentRequirements={documentRequirements}
                    viewedStep={viewedStep}
                    onSelect={onSelectSubStep}
                    disabled={disabled}
                    currentStatus={currentStatus}
                    currentIdx={currentIdx}
                    pendingDocsIdx={pendingDocsIdx}
                    showAdvanceGuide={showAdvanceGuide}
                    automatedBookingFlow={automatedBookingFlow}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {showAdvanceGuide ? (
        <CancelledWorkflowNote
          isCancelled={currentStatus === 'CANCELLED'}
          statusUpdatedAt={currentStatus === 'CANCELLED' ? statusUpdatedAt : undefined}
        />
      ) : null}
    </div>
  );
}

function CancelledWorkflowNote({
  isCancelled,
  statusUpdatedAt,
}: {
  isCancelled: boolean;
  statusUpdatedAt?: string | null;
}) {
  const tone = statusToneStyle('CANCELLED');
  const lines = cancelledAdvanceGuide(isCancelled);

  return (
    <section
      aria-label={statusLabel('CANCELLED')}
      className="border-separator mt-8 flex gap-3 border-t pt-5"
    >
      <div className="flex w-6 shrink-0 justify-center">
        <div className="flex size-6 shrink-0 items-center justify-center">
          <div
            className={cn(
              'flex items-center justify-center rounded-full',
              isCancelled ? cn('size-6 border', tone.badge) : cn('size-5 border', tone.badge)
            )}
          >
            <span className={cn('rounded-full', isCancelled ? 'size-2' : 'size-1.5', tone.dot)} />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-h-6 min-w-0 items-center">
          <span
            className={cn(
              'text-sm leading-tight',
              isCancelled ? 'text-primary font-semibold' : 'text-muted-foreground font-medium'
            )}
          >
            {statusLabel('CANCELLED')}
          </span>
        </div>
        <AdvanceGuideLines lines={lines} />
        {isCancelled && statusUpdatedAt ? (
          <div className="text-caption">Since {formatRelative(statusUpdatedAt)}</div>
        ) : null}
      </div>
    </section>
  );
}

function PendingDocumentsSubTree({
  booking,
  documentRequirements,
  viewedStep,
  onSelect,
  disabled,
  currentStatus,
  currentIdx,
  pendingDocsIdx,
  showAdvanceGuide = false,
  automatedBookingFlow,
}: {
  booking: BookingRow;
  documentRequirements: DocumentRequirement[];
  viewedStep: ViewedWorkflowStep;
  onSelect: (key: PendingDocNestedKey) => void;
  disabled?: boolean;
  currentStatus: BookingStatus;
  currentIdx: number;
  pendingDocsIdx: number;
  showAdvanceGuide?: boolean;
  automatedBookingFlow?: boolean;
}) {
  const nestedOpts = { automatedBookingFlow };
  const items = pendingDocumentsNestedItemsForStepper(booking, documentRequirements);
  const activeKey = viewedStep.kind === 'pending-doc-sub' ? viewedStep.sub : undefined;
  const isLivePendingDocs = currentStatus === 'PENDING_DOCUMENTS';
  const canBrowseCompletedPendingDocs = pendingDocsIdx >= 0 && currentIdx > pendingDocsIdx;

  function isItemInteractive(key: PendingDocNestedKey): boolean {
    if (isLivePendingDocs) return true;
    if (canBrowseCompletedPendingDocs) return true;
    if (key === PARKING_NESTED_KEY && canNavigatePendingParkingSubStep(booking, currentStatus)) {
      return true;
    }
    return false;
  }

  if (items.length === 0) return null;

  return (
    <ul className={cn('relative flex flex-col', showAdvanceGuide ? 'mt-2 gap-4' : 'gap-3')}>
      {items.length > 1 ? (
        <div
          aria-hidden
          className="bg-muted pointer-events-none absolute bottom-[10px] left-2 top-[10px] w-px"
        />
      ) : null}
      {items.map((item) => {
        const isActive = activeKey === item.key;
        const itemInteractive = isItemInteractive(item.key);
        const nestedDisplay = nestedAdvanceDisplay(item.key, item.approvalSource, nestedOpts);
        const nestedGuide = nestedAdvanceGuide(item.key, item.approvalSource, nestedOpts);
        const iconClass = cn(
          'relative z-[1] box-border flex size-4 shrink-0 items-center justify-center rounded-full',
          item.completed
            ? 'gradient-primary text-primary-foreground'
            : 'border-border/60 bg-card border'
        );

        const labelClass = cn(
          'text-xs leading-4 transition-colors',
          disabled
            ? 'text-muted-foreground cursor-not-allowed'
            : isActive
              ? 'text-primary font-semibold'
              : item.completed
                ? 'text-foreground font-medium'
                : 'text-muted-foreground font-medium',
          itemInteractive && !disabled && !isActive && 'hover:text-primary'
        );

        const statusWord = (
          <span
            className={cn(
              'shrink-0 text-xs font-semibold leading-4',
              item.completed ? 'text-primary' : 'text-amber-600'
            )}
          >
            {item.completed ? 'Complete' : 'Incomplete'}
          </span>
        );

        return (
          <li key={item.key} className="flex items-start gap-2.5">
            <div className={cn(iconClass, showAdvanceGuide && 'mt-1')}>
              {item.completed ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-h-6 min-w-0 items-center gap-2">
                {itemInteractive ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!disabled) onSelect(item.key);
                    }}
                    disabled={!!disabled}
                    className={cn(
                      '-my-[10px] inline-flex min-h-[44px] min-w-0 flex-1 items-center py-2 text-left',
                      labelClass
                    )}
                    aria-label={`View ${item.label}${item.completed ? ', complete' : ', incomplete'}`}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    {item.label}
                  </button>
                ) : (
                  <div
                    className={cn(
                      'flex min-h-6 min-w-0 flex-1 items-center text-xs leading-4',
                      item.completed ? 'text-primary font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {item.label}
                  </div>
                )}
                {showAdvanceGuide ? (
                  <WorkflowAdvanceModeMark
                    mode={nestedDisplay.mode}
                    label={nestedDisplay.label}
                    className="shrink-0"
                  />
                ) : itemInteractive ? (
                  statusWord
                ) : null}
              </div>
              {showAdvanceGuide && nestedGuide.length > 0 ? (
                <AdvanceGuideLines lines={nestedGuide} size="nested" />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
