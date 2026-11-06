/**
 * Client mirror of doc-review state kept in
 * `document_requirement_completions[requirementId]` (see `_shared/documentRequirements.ts`).
 *
 * A file on file always wins: uploading a replacement supersedes an earlier
 * rejection without a separate "accepted" write.
 */

import type { DocumentRequirementCompletion } from '@/features/dashboard/bookings/lib/documentRequirements';

export const DOC_REJECTION_REASON_LABELS = {
  wrong_document: 'Wrong document',
  wrong_guest: 'Wrong guest',
  wrong_unit: 'Wrong unit',
  expired: 'Expired',
  unreadable: 'Unreadable',
  other: 'Other',
} as const;

export type DocRejectionReason = keyof typeof DOC_REJECTION_REASON_LABELS;

export const DOC_REJECTION_REASONS = Object.keys(
  DOC_REJECTION_REASON_LABELS
) as DocRejectionReason[];

export type PendingDocReviewState = 'awaiting' | 'received' | 'rejected';

export function pendingDocReviewState(
  completion: DocumentRequirementCompletion | undefined,
  hasFile: boolean
): PendingDocReviewState {
  if (hasFile) return 'received';
  if (completion?.rejectedAt) return 'rejected';
  return 'awaiting';
}

export function docRejectionReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return DOC_REJECTION_REASON_LABELS[reason as DocRejectionReason] ?? null;
}

/** Asia/Manila short date; the year only shows when it is not the current one. */
export function formatDocReviewDate(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    ...(parsed.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}
