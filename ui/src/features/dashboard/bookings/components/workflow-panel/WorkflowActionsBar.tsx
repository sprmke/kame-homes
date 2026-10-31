/**
 * Transition actions for the workflow rail.
 *
 * Three tiers, top to bottom:
 * 1. A back/forward pair on one axis — matched height, radius and type scale,
 *    with a left arrow on return and a right arrow on the primary so the row reads
 *    as a single direction control. These commit real status changes, unlike the
 *    deck header's arrows which only move the view, so they are deliberately a
 *    different shape and sit in their own footer.
 * 2. Cancel booking, below a rule, on a soft rose wash — shown only on the live
 *    step (or in the kanban modal), same as return/proceed; hidden while browsing
 *    earlier completed stages. Disappears for good once the guest has checked in
 *    (`canCancelBookingAtStatus`).
 *
 * Progress drafts on the **live** stage autosave (no Save button). While browsing
 * an earlier stage — or after a live autosave failure — **Save** appears so hosts
 * can persist pricing/settlement without opening Edit Booking.
 *
 * Form-gated Proceed / Mark complete CTAs stay enabled; the parent runs field
 * validators on click and surfaces inline errors. Doc-completion gates (e.g. all
 * pending docs done) still toast a short hint when incomplete.
 */

import { ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';

import { shortStatusLabel } from '@/features/dashboard/bookings/lib/bookingStages';
import {
  canCancelBookingAtStatus,
  statusLabel,
  type BookingStatus,
} from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  PARKING_NESTED_KEY,
  type PendingDocNestedKey,
} from '@/features/dashboard/bookings/lib/workflow';
import {
  workflowActionLabelGroupClass,
  workflowActionLabelTextClass,
  workflowActionLabelTextPairedClass,
  workflowBackActionClass,
  workflowPrimaryActionClass,
} from '@/features/dashboard/bookings/lib/workflowActionButtonStyles';
import { shortDocStepLabel } from '@/features/dashboard/bookings/lib/workflowStageDeck';

import { cn } from '@/lib/utils';

type Props = {
  isModal: boolean;
  status: BookingStatus;
  isTerminal: boolean;
  isLiveView: boolean;
  transitionPending: boolean;
  inPendingDocuments: boolean;
  viewingPendingDocSub: boolean;
  prev: BookingStatus | null;
  next: BookingStatus | null;
  onOpenBackConfirm: (toStatus: BookingStatus) => void;
  selectedPendingDocRequired: boolean;
  selectedPendingDocCompleted: boolean;
  activePendingDocSubStatus: PendingDocNestedKey;
  activePendingDocLabel: string;
  onMarkPendingDocSubStatusComplete: (sub: PendingDocNestedKey) => void;
  onOpenDocApprovalModal: (sub: PendingDocNestedKey) => void;
  selectedPendingDocUsesApprovalModal: boolean;
  showProceedToReadyForCheckin: boolean;
  pendingDocumentsComplete: boolean;
  pendingDocumentsBlockedHint: string;
  onOpenForwardProceedConfirm: (toStatus: BookingStatus, label: string) => void;
  showLateParkingActions: boolean;
  livePipelineActions: boolean;
  cancelPending: boolean;
  onOpenCancelConfirm: () => void;
  /** Persist dirty progress-form drafts without a status transition. */
  showProgressSave?: boolean;
  progressSavePending?: boolean;
  onProgressSave?: () => void;
  /** Toast when Proceed to RFCI is blocked by incomplete nested docs. */
  onPendingDocumentsBlocked?: (hint: string) => void;
};

type PrimaryAction = {
  label: string;
  /** Shorter rail label when shown beside the back CTA in a two-column row. */
  compactLabel?: string;
  onSelect: () => void;
};

function workflowStatusCtaName(status: BookingStatus, compact: boolean): string {
  return compact ? shortStatusLabel(status) : statusLabel(status);
}

function returnToStatusLabel(status: BookingStatus, compact: boolean): string {
  return `Return to ${workflowStatusCtaName(status, compact)}`;
}

function proceedToStatusLabel(status: BookingStatus, compact: boolean): string {
  return `Proceed to ${workflowStatusCtaName(status, compact)}`;
}

const quietRowClass =
  'focus-ring flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40';

function PrimaryCta({
  label,
  busy,
  paired,
  onSelect,
}: {
  label: string;
  busy: boolean;
  paired?: boolean;
  onSelect: () => void;
}) {
  return (
    <div className={cn('w-full min-w-0', paired && 'h-full')}>
      <button
        type="button"
        disabled={busy}
        onClick={onSelect}
        aria-busy={busy || undefined}
        className={cn(
          workflowPrimaryActionClass(!busy),
          'w-full min-w-0 text-center',
          paired && 'h-full'
        )}
      >
        <span className={cn(workflowActionLabelGroupClass, 'gap-2')}>
          <span
            className={paired ? workflowActionLabelTextPairedClass : workflowActionLabelTextClass}
          >
            {label}
          </span>
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          )}
        </span>
      </button>
    </div>
  );
}

export function WorkflowActionsBar({
  isModal,
  status,
  isTerminal,
  isLiveView,
  transitionPending,
  inPendingDocuments,
  viewingPendingDocSub,
  prev,
  next,
  onOpenBackConfirm,
  selectedPendingDocRequired,
  selectedPendingDocCompleted,
  activePendingDocSubStatus,
  activePendingDocLabel,
  onMarkPendingDocSubStatusComplete,
  onOpenDocApprovalModal,
  selectedPendingDocUsesApprovalModal,
  showProceedToReadyForCheckin,
  pendingDocumentsComplete,
  pendingDocumentsBlockedHint,
  onOpenForwardProceedConfirm,
  showLateParkingActions,
  livePipelineActions,
  cancelPending,
  onOpenCancelConfirm,
  showProgressSave = false,
  progressSavePending = false,
  onProgressSave,
  onPendingDocumentsBlocked,
}: Props) {
  const showCancel = !isTerminal && canCancelBookingAtStatus(status) && (isLiveView || isModal);
  const showTransitions = !isTerminal && (isLiveView || isModal);
  const inDocStep = inPendingDocuments && viewingPendingDocSub;
  const activeDocShortLabel = shortDocStepLabel(activePendingDocLabel);
  const docStepNotRequired = inDocStep && !selectedPendingDocRequired;

  let primary: PrimaryAction | null = null;

  if (inDocStep && selectedPendingDocRequired && !selectedPendingDocCompleted) {
    primary = {
      label: `Mark ${activeDocShortLabel} as complete`,
      onSelect: () =>
        selectedPendingDocUsesApprovalModal
          ? onOpenDocApprovalModal(activePendingDocSubStatus)
          : onMarkPendingDocSubStatusComplete(activePendingDocSubStatus),
    };
  } else if (inDocStep && showProceedToReadyForCheckin) {
    primary = {
      label: proceedToStatusLabel('READY_FOR_CHECKIN', false),
      compactLabel: proceedToStatusLabel('READY_FOR_CHECKIN', true),
      onSelect: () => {
        if (!pendingDocumentsComplete) {
          onPendingDocumentsBlocked?.(pendingDocumentsBlockedHint);
          return;
        }
        onOpenForwardProceedConfirm(
          'READY_FOR_CHECKIN',
          proceedToStatusLabel('READY_FOR_CHECKIN', false)
        );
      },
    };
  } else if (showLateParkingActions) {
    primary = {
      label: `Mark ${shortDocStepLabel(statusLabel(PARKING_NESTED_KEY))} as complete`,
      onSelect: () => onMarkPendingDocSubStatusComplete(PARKING_NESTED_KEY),
    };
  } else if (livePipelineActions && next) {
    primary = {
      label: proceedToStatusLabel(next, false),
      compactLabel: proceedToStatusLabel(next, true),
      onSelect: () => onOpenForwardProceedConfirm(next, proceedToStatusLabel(next, false)),
    };
  }

  const backTo = (inDocStep || livePipelineActions) && prev ? prev : null;
  // One in-flight mutation locks the whole footer: a cancel and a transition
  // racing each other would land the booking somewhere neither host intended.
  const actionsBusy = transitionPending || cancelPending || progressSavePending;

  const showTransitionRow = showTransitions && (primary !== null || backTo !== null);
  const pairedTransitionActions = backTo !== null && primary !== null;
  const primaryButtonLabel =
    primary && pairedTransitionActions ? (primary.compactLabel ?? primary.label) : primary?.label;
  const showNotRequiredNote = showTransitions && docStepNotRequired && primary === null;
  const showDeadEndNote = showTransitions && !showTransitionRow && !showNotRequiredNote;

  const hasStageActions =
    showTransitionRow || showNotRequiredNote || showDeadEndNote || showProgressSave;
  if (!hasStageActions && !showCancel) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        isModal
          ? 'border-separator mt-auto shrink-0 border-t px-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-3 sm:px-5 sm:pb-4'
          : 'px-4 py-4'
      )}
    >
      {showProgressSave && onProgressSave ? (
        <button
          type="button"
          disabled={actionsBusy}
          onClick={onProgressSave}
          aria-busy={progressSavePending || undefined}
          className={cn(workflowPrimaryActionClass(!actionsBusy), 'w-full min-w-0')}
        >
          <span className={cn(workflowActionLabelGroupClass, 'gap-2')}>
            {progressSavePending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4 shrink-0" aria-hidden />
            )}
            <span className={workflowActionLabelTextClass}>Save</span>
          </span>
        </button>
      ) : null}

      {showNotRequiredNote ? (
        <p className="border-border/50 bg-muted/50 text-muted-foreground flex min-h-[44px] items-center rounded-xl border px-3.5 py-2.5 text-sm">
          {activePendingDocLabel} is not required for this booking.
        </p>
      ) : null}

      {showTransitionRow ? (
        <div
          className={cn(
            'grid items-stretch gap-2',
            pairedTransitionActions ? 'grid-cols-2' : 'grid-cols-1'
          )}
        >
          {backTo ? (
            <button
              type="button"
              disabled={actionsBusy}
              onClick={() => onOpenBackConfirm(backTo)}
              aria-label={returnToStatusLabel(backTo, false)}
              className={cn(
                workflowBackActionClass,
                'w-full min-w-0',
                pairedTransitionActions && 'h-full'
              )}
            >
              <span className={workflowActionLabelGroupClass}>
                <ArrowLeft className="size-4 shrink-0" aria-hidden />
                <span
                  className={
                    pairedTransitionActions
                      ? workflowActionLabelTextPairedClass
                      : workflowActionLabelTextClass
                  }
                >
                  {returnToStatusLabel(backTo, pairedTransitionActions)}
                </span>
              </span>
            </button>
          ) : null}

          {primary ? (
            <PrimaryCta
              label={primaryButtonLabel ?? primary.label}
              busy={actionsBusy}
              paired={pairedTransitionActions}
              onSelect={primary.onSelect}
            />
          ) : null}
        </div>
      ) : null}

      {showDeadEndNote ? (
        <p className="text-caption">No further pipeline steps are available for this booking.</p>
      ) : null}

      {showCancel ? (
        <div className={cn(hasStageActions && 'border-separator mt-1 border-t pt-2.5')}>
          <button
            type="button"
            disabled={actionsBusy}
            onClick={onOpenCancelConfirm}
            aria-busy={cancelPending || undefined}
            className={cn(
              quietRowClass,
              'bg-rose-500/10 text-rose-600 hover:bg-rose-500/[0.18] dark:text-rose-400 dark:hover:bg-rose-500/20'
            )}
          >
            {cancelPending ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
            ) : null}
            Cancel booking
          </button>
        </div>
      ) : null}
    </div>
  );
}
