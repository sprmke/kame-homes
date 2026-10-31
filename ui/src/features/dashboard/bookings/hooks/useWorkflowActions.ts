/**
 * WorkflowPanel pipeline-navigation derived state — pure relocation from the
 * pre-decomposition `WorkflowPanel.tsx` (the ~15 inline booleans computed
 * around `pipeline`/`next`/`prev`). Calls the exact same `lib/workflow.ts`
 * exports the monolith called; no new transition rules.
 *
 * Coupling note: `selectedPendingDocCanMarkComplete` depends on the parking
 * sub-form draft (`parkingValues`) when the active pending-doc sub-step is
 * PENDING_PARKING_REQUEST — that's why this hook takes `parkingValues` from
 * `useWorkflowSubFormDrafts` as a parameter instead of being fully independent
 * of it.
 */

import {
  isParkingRequestDraftComplete,
  type ParkingRequestValues,
} from '@/features/dashboard/bookings/components/ParkingRequestForm';
import {
  TERMINAL_STATUSES,
  type BookingStatus,
} from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  DEFAULT_DOCUMENT_REQUIREMENTS,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import { pendingDocStepUsesApprovalModal } from '@/features/dashboard/bookings/lib/pendingDocApproval';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  bookingPipeline,
  canNavigatePendingParkingSubStep,
  defaultPendingDocNestedKey,
  getPendingDocumentsNestedCompletion,
  isLiveWorkflowView,
  nestedKeyLabel,
  nextStep,
  pendingDocumentsNestedItems,
  previousStep,
  workflowContentForView,
  PARKING_NESTED_KEY,
  type PendingDocNestedKey,
  type ViewedWorkflowStep,
} from '@/features/dashboard/bookings/lib/workflow';
import { pendingDocumentsProceedBlockedHint } from '@/features/dashboard/bookings/lib/workflowStageDeck';

export function useWorkflowActions(
  booking: BookingRow,
  status: BookingStatus,
  viewedStep: ViewedWorkflowStep,
  parkingValues: ParkingRequestValues | null,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
) {
  const isTerminal = TERMINAL_STATUSES.has(status);

  const activePendingDocSubStatus: PendingDocNestedKey =
    viewedStep.kind === 'pending-doc-sub'
      ? viewedStep.sub
      : (defaultPendingDocNestedKey(booking, documentRequirements) ?? '');
  const activePendingDocLabel = nestedKeyLabel(activePendingDocSubStatus, documentRequirements);

  // Pipeline navigation — the stepper + Proceed/Back buttons read from these.
  const pipeline = bookingPipeline(booking, status, documentRequirements);
  const next = !isTerminal ? nextStep(booking, status, documentRequirements) : null;
  const prev = !isTerminal ? previousStep(booking, status, documentRequirements) : null;
  const inPendingDocuments = status === 'PENDING_DOCUMENTS';

  const nestedCompletion = getPendingDocumentsNestedCompletion(booking, documentRequirements);
  const pendingDocumentsComplete =
    nestedCompletion.allConfigurableDocsDone && nestedCompletion.parkingDone;
  const pendingDocumentsBlockedHint = pendingDocumentsProceedBlockedHint(
    booking,
    documentRequirements
  );

  const nestedItems = pendingDocumentsNestedItems(booking, documentRequirements);
  const activeItem = nestedItems.find((item) => item.key === activePendingDocSubStatus);
  const selectedPendingDocRequired = !!activeItem;
  const selectedPendingDocCompleted = activeItem?.completed ?? false;
  const selectedPendingDocIsParking = activePendingDocSubStatus === PARKING_NESTED_KEY;
  const selectedPendingDocUsesApprovalModal = pendingDocStepUsesApprovalModal(
    activePendingDocSubStatus,
    documentRequirements
  );
  const selectedPendingDocCanMarkComplete =
    selectedPendingDocRequired &&
    !selectedPendingDocCompleted &&
    (selectedPendingDocUsesApprovalModal ||
      !selectedPendingDocIsParking ||
      isParkingRequestDraftComplete(parkingValues));
  const isLiveView = isLiveWorkflowView(viewedStep, status, booking);
  // Cancelled / imported stay locked. Completed and earlier browsed stages are
  // editable in the rail (Save) — hosts no longer need Edit Booking → Workflow.
  const contentReadOnly = status === 'CANCELLED' || status === 'IMPORTED';
  const viewedContent = workflowContentForView(viewedStep, booking, documentRequirements);
  const viewingPendingDocSub = viewedStep.kind === 'pending-doc-sub';

  const canShowLateParkingForm =
    isLiveView &&
    viewingPendingDocSub &&
    activePendingDocSubStatus === PARKING_NESTED_KEY &&
    !inPendingDocuments &&
    canNavigatePendingParkingSubStep(booking, status);
  const showLateParkingActions = canShowLateParkingForm;

  const showProceedToReadyForCheckin = isLiveView && inPendingDocuments && viewingPendingDocSub;
  // D2 edge case: resolved documentRequirements can become [] (and no parking)
  // while a booking already sits at PENDING_DOCUMENTS, leaving no nested item to
  // browse — defaultPendingDocNestedKey() is null, so viewedStep falls back to
  // the plain pipeline view. Without this, livePipelineActions and the
  // pending-doc-sub action block are both false and only Cancel Booking shows.
  // Fall back to plain pipeline Proceed/Back in that case, same as any other
  // live pipeline status (nextStep already resolves to READY_FOR_CHECKIN).
  const noNestedDocItemsToBrowse = inPendingDocuments && nestedItems.length === 0;
  const livePipelineActions =
    isLiveView &&
    viewedStep.kind === 'pipeline' &&
    (!inPendingDocuments || noNestedDocItemsToBrowse);

  return {
    isTerminal,
    activePendingDocSubStatus,
    activePendingDocLabel,
    pipeline,
    next,
    prev,
    inPendingDocuments,
    pendingDocumentsComplete,
    pendingDocumentsBlockedHint,
    selectedPendingDocRequired,
    selectedPendingDocCompleted,
    selectedPendingDocIsParking,
    selectedPendingDocUsesApprovalModal,
    selectedPendingDocCanMarkComplete,
    isLiveView,
    contentReadOnly,
    viewedContent,
    viewingPendingDocSub,
    showLateParkingActions,
    showProceedToReadyForCheckin,
    livePipelineActions,
  };
}

export type WorkflowActions = ReturnType<typeof useWorkflowActions>;
