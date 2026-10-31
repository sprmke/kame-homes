/**
 * Import commit status — past stays → IMPORTED; today/future → PENDING_REVIEW.
 * Keep import side-effect bypass in import-commit (no workflowOrchestrator on insert).
 */

import { checkInDateToIso, manilaTodayIso } from './bookingsListSort.ts';

export function importCommitStatusForCheckIn(
  checkInRaw: string | null | undefined
): 'IMPORTED' | 'PENDING_REVIEW' {
  const iso = checkInDateToIso(checkInRaw ?? '');
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return 'IMPORTED';
  }
  const today = manilaTodayIso();
  if (iso < today) return 'IMPORTED';
  return 'PENDING_REVIEW';
}

/** Revert cancel set: still at import entry statuses (not advanced in pipeline). */
export function isImportBatchRevertableStatus(status: string): boolean {
  return status === 'IMPORTED' || status === 'PENDING_REVIEW';
}
