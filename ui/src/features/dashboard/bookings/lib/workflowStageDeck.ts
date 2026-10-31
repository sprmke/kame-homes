/**
 * Stage-deck derivation for the booking detail workflow rail.
 *
 * The rail shows one pipeline stage at a time instead of the full vertical
 * stepper. This module maps between the deck's flat index and the existing
 * `ViewedWorkflowStep` model so no transition rule is re-derived here — stage
 * order still comes from `bookingPipeline()` and nested Pending Documents
 * sub-steps still come from `pendingDocumentsNestedItems()`.
 *
 * Browsing is bounded by the live status: a host can look back at completed
 * stages but not ahead of the booking's current position, matching the
 * reachability rule the full stepper already enforces.
 */

import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  bookingPipeline,
  pendingDocumentsNestedItems,
  type ViewedWorkflowStep,
} from '@/features/dashboard/bookings/lib/workflow';

export type StageDeckStepState = 'done' | 'current' | 'upcoming';

export type WorkflowStageDeck = {
  stages: BookingStatus[];
  /** Index of the booking's live status, or -1 when off-pipeline (CANCELLED, IMPORTED). */
  currentIndex: number;
  /** Index of the stage the rail is showing, or -1 when neither it nor the live stage is placeable. */
  viewedIndex: number;
  canGoPrev: boolean;
  canGoNext: boolean;
};

type DeckBooking = Parameters<typeof bookingPipeline>[0];

/** The pipeline stage a `ViewedWorkflowStep` belongs to (sub-steps roll up to their parent). */
export function stageForViewedStep(viewed: ViewedWorkflowStep): BookingStatus {
  return viewed.kind === 'pending-doc-sub' ? 'PENDING_DOCUMENTS' : viewed.status;
}

export function buildWorkflowStageDeck(
  booking: DeckBooking,
  currentStatus: BookingStatus,
  viewed: ViewedWorkflowStep,
  documentRequirements: DocumentRequirement[]
): WorkflowStageDeck {
  const stages = bookingPipeline(booking, currentStatus, documentRequirements);
  const currentIndex = stages.indexOf(currentStatus);
  const matchedIndex = stages.indexOf(stageForViewedStep(viewed));
  // Guest-data drift can briefly leave `viewedStep` pointing at a stage the
  // pipeline no longer contains (e.g. parking removed mid-view). Falling back to
  // the live stage keeps the navigator usable instead of hiding it outright.
  const viewedIndex = matchedIndex >= 0 ? matchedIndex : currentIndex;

  return {
    stages,
    currentIndex,
    viewedIndex,
    canGoPrev: viewedIndex > 0,
    canGoNext: viewedIndex >= 0 && currentIndex >= 0 && viewedIndex < currentIndex,
  };
}

export function stageDeckStepState(index: number, currentIndex: number): StageDeckStepState {
  if (currentIndex < 0 || index > currentIndex) return 'upcoming';
  return index === currentIndex ? 'current' : 'done';
}

/**
 * Tab-sized label for a nested document step. Requirement labels are written for
 * the full stepper ("Pending Parking Request", "GAF Approval"), which is far too
 * long for a segmented control in a 320px rail.
 */
export function shortDocStepLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  const short = trimmed.replace(/^pending\s+/i, '').replace(/\s+(request|approval)$/i, '');
  return short || trimmed;
}

function formatEnglishList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Tooltip when Proceed to Ready for Check-in is blocked by incomplete doc substeps. */
export function pendingDocumentsProceedBlockedHint(
  booking: BookingRow,
  requirements: DocumentRequirement[]
): string {
  const labels = pendingDocumentsNestedItems(booking, requirements).map((item) =>
    shortDocStepLabel(item.label)
  );
  if (labels.length === 0) {
    return 'Complete all required pending documents first.';
  }
  const list = formatEnglishList(labels);
  const verb = labels.length === 1 ? 'is' : 'are';
  return `Make sure ${list} ${verb} complete before proceeding.`;
}
