// Single source of truth for the booking status enum, human labels, and color tokens.
// Mirrors `supabase/functions/_shared/statusMachine.ts` (to be authored in Phase 2).
// If you change the enum here, change it there too. See `.cursor/rules/booking-workflow.mdc`.

import type { DocumentRequirementCompletion } from '@/features/dashboard/bookings/lib/documentRequirements';

export const BOOKING_STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
  'CANCELLED',
  'IMPORTED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses where the token-gated guest stay guide may be issued or shared. */
export const STAY_GUIDE_ELIGIBLE_STATUSES = [
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const satisfies readonly BookingStatus[];

export function isStayGuideEligibleStatus(status: string | null | undefined): boolean {
  return (STAY_GUIDE_ELIGIBLE_STATUSES as readonly string[]).includes(String(status ?? '').trim());
}

/** Public guest form updates (`/form?bookingId=`) — only while awaiting admin review. */
export function canGuestPublicUpdateForm(status: string | null | undefined): boolean {
  return String(status ?? '').trim() === 'PENDING_REVIEW';
}

/** Statuses rolled into **Pending Documents** on org dashboard breakdown. */
export const PENDING_DOCUMENTS_BUCKET_STATUSES = [
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
] as const satisfies readonly BookingStatus[];

/** Org dashboard status donut — simplified pipeline (pending docs bucketed). */
export const DASHBOARD_STATUS_BREAKDOWN_ORDER = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const satisfies readonly BookingStatus[];

/**
 * Legacy single-status values were backfilled in migration
 * `20260502000000_widen_status_enum.sql` (and `20260714120000_backfill_legacy_booking_statuses.sql`).
 * Application code uses the canonical enum only.
 */

/** Human labels for display (matches workflow status naming in `NEW_FLOW_PLAN.md`). */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_REVIEW: 'Pending Review',
  PENDING_DOCUMENTS: 'Pending Documents',
  PENDING_GAF: 'Pending GAF Request',
  PENDING_PARKING_REQUEST: 'Pending Parking Request',
  PENDING_PET_REQUEST: 'Pending Pet Request',
  READY_FOR_CHECKIN: 'Ready for Check-in',
  READY_FOR_CHECKOUT: 'Ready for Check-out',
  PENDING_SD_REFUND: 'Pending SD Refund',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  IMPORTED: 'Imported',
};

/**
 * Tailwind-friendly color intent for each status. Concrete HSL values resolve to the
 * project's design tokens — no hardcoded hexes.
 */
export type StatusTone =
  'red' | 'yellow' | 'green' | 'amber' | 'orange' | 'blue' | 'purple' | 'neutral';

export const STATUS_TONE: Record<BookingStatus, StatusTone> = {
  PENDING_REVIEW: 'red',
  PENDING_DOCUMENTS: 'yellow',
  PENDING_GAF: 'yellow',
  PENDING_PARKING_REQUEST: 'yellow',
  PENDING_PET_REQUEST: 'yellow',
  READY_FOR_CHECKIN: 'green',
  READY_FOR_CHECKOUT: 'amber',
  PENDING_SD_REFUND: 'orange',
  COMPLETED: 'blue',
  CANCELLED: 'purple',
  IMPORTED: 'neutral',
};

/** Terminal statuses — no further transitions are valid. */
export const TERMINAL_STATUSES: ReadonlySet<BookingStatus> = new Set(['COMPLETED', 'CANCELLED']);

/**
 * Cancelling stops being an option once the guest has checked in — from
 * Ready for Check-out onward the stay happened, so the booking is settled
 * (or refunded) rather than cancelled. `IMPORTED` rows are outside the
 * pipeline and are not cancellable here.
 */
const CANCELLABLE_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
]);

export function canCancelBookingAtStatus(status: string | null | undefined): boolean {
  return CANCELLABLE_STATUSES.has(String(status ?? '').trim() as BookingStatus);
}

/**
 * Reschedule (booking-detail `⋯` → **Reschedule**) is offered up to — but not
 * including — Ready for Check-out: once the stay is underway there is nothing
 * left to move. It always forces the row back to **Pending Review** so the
 * host re-runs the pricing + document proceed from the top of the pipeline
 * after a date move — see `hooks/useRescheduleBooking.ts` and
 * `.cursor/rules/booking-workflow.mdc` §6.
 */
const RESCHEDULABLE_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
]);

export function canRescheduleBookingAtStatus(status: string | null | undefined): boolean {
  return RESCHEDULABLE_STATUSES.has(String(status ?? '').trim() as BookingStatus);
}

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as ReadonlyArray<string>).includes(value);
}

// ─── Document completions JSONB merge (mirror of statusMachine.ts) ──────────

type DocumentCompletionsMap = Record<string, DocumentRequirementCompletion>;

function parseCompletionEntry(raw: unknown): DocumentRequirementCompletion | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entry = raw as Record<string, unknown>;
  return {
    completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null,
    approvedPdfUrl: typeof entry.approvedPdfUrl === 'string' ? entry.approvedPdfUrl : null,
  };
}

function parseCompletionsMap(raw: unknown): DocumentCompletionsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: DocumentCompletionsMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseCompletionEntry(value);
    if (parsed) out[id] = parsed;
  }
  return out;
}

/**
 * Merges the guest-edit-revert completion reset into the booking's *current*
 * `document_requirement_completions` JSONB map. Every id present is cleared (a
 * renamed requirement such as `custom-2` must not keep the previous cycle's
 * tick), and `gaf`/`pet` are always written so an empty map can't dual-read
 * stale named columns. Callers must pass the currently-loaded row's column
 * value — never write a bare `{ gaf, pet }` object over the column, that drops
 * unrelated ids.
 *
 * Mirror: `supabase/functions/_shared/statusMachine.ts#pendingDocumentsClearCompletionsJsonbPatch`.
 */
export function pendingDocumentsClearCompletionsJsonbPatch(
  existingCompletions: unknown
): DocumentCompletionsMap {
  const map = parseCompletionsMap(existingCompletions);
  for (const id of [...Object.keys(map), 'gaf', 'pet']) {
    map[id] = { completedAt: null, approvedPdfUrl: null };
  }
  return map;
}

/**
 * Guest/admin edits to workflow-sensitive fields (or guest-doc uploads) reset
 * `status` → `PENDING_REVIEW` only in these stages. Mirrors
 * `supabase/functions/_shared/statusMachine.ts#GUEST_FIELD_EDIT_REVERT_STATUSES`.
 */
export const GUEST_FIELD_EDIT_REVERT_STATUSES = [
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
] as const satisfies readonly BookingStatus[];

export function shouldRevertGuestFieldEditsToPendingReview(
  status: string | null | undefined
): boolean {
  return !!status && (GUEST_FIELD_EDIT_REVERT_STATUSES as readonly string[]).includes(status);
}

/**
 * Clears nested Pending Documents state, approved PDF URLs, admin
 * parking settlement, and guest balance settlement when sensitive guest edits
 * revert the row to `PENDING_REVIEW`. Request PDF URLs (`gaf_request_pdf_url`,
 * `pet_request_pdf_url`) are preserved unless the edit changes PDF fill content
 * — see `requestPdfClearPatchForAdminGuestEdit`. Does **not** clear pricing
 * fields — same column set as server.
 *
 * Named-column patch only — callers that also write `document_requirement_completions`
 * must additionally call `pendingDocumentsClearCompletionsJsonbPatch()` above with the
 * row's current column value (dual-write invariant).
 *
 * Mirror: `supabase/functions/_shared/statusMachine.ts#pendingDocumentsClearPatchForGuestEditRevert`.
 */
export function pendingDocumentsClearPatchForGuestEditRevert(): Record<string, null | false> {
  return {
    gaf_completed_at: null,
    parking_completed_at: null,
    pet_completed_at: null,
    approved_gaf_pdf_url: null,
    approved_pet_pdf_url: null,
    parking_rate_paid: null,
    parking_owner: null,
    parking_owner_email: null,
    parking_endorsement_url: null,
    parking_fee_included_in_downpayment: null,
    parking_payment_receipt_url: null,
    parking_receipt_ai_verdict: null,
    parking_receipt_ai_summary: null,
    guest_balance_paid_amount: null,
    guest_balance_payment_receipt_url: null,
    surprise_decor_staff_acknowledged: false,
  };
}

/** Legacy single-status GAF / parking / pet stages — nested under Pending Documents in admin filters. */
export const PENDING_DOCUMENTS_SUB_STATUSES = [
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
] as const satisfies readonly BookingStatus[];

const PENDING_DOCS_SUB_SET = new Set<string>(PENDING_DOCUMENTS_SUB_STATUSES);

export type BookingsStatusFilterRow =
  | { type: 'status'; value: string }
  | {
      type: 'group';
      parent: 'PENDING_DOCUMENTS';
      children: typeof PENDING_DOCUMENTS_SUB_STATUSES;
    };

/**
 * Order for `/bookings` status filter (parent → indented sub-stages).
 * `extraStatuses` appends plain rows after the property enum — used by the parking
 * bookings page to surface PENDING_HOST_ACCEPTANCE / NO_HOST_AVAILABLE as explicit
 * filter chips (see PARKING_ONLY_STATUSES below).
 */
export function bookingsStatusFilterRows(
  extraStatuses?: readonly string[]
): BookingsStatusFilterRow[] {
  const rows: BookingsStatusFilterRow[] = [];
  const all = [...BOOKING_STATUSES] as BookingStatus[];

  for (const value of all) {
    if (PENDING_DOCS_SUB_SET.has(value)) continue;
    if (value === 'PENDING_DOCUMENTS') {
      rows.push({
        type: 'group',
        parent: 'PENDING_DOCUMENTS',
        children: PENDING_DOCUMENTS_SUB_STATUSES,
      });
      continue;
    }
    rows.push({ type: 'status', value });
  }
  for (const value of extraStatuses ?? []) {
    rows.push({ type: 'status', value });
  }
  return rows;
}

/** Parking-only statuses — see PARKING_ONLY_STATUS_LABELS below. */
export const PARKING_ONLY_STATUSES = [
  'PENDING_HOST_ACCEPTANCE',
  'PENDING_PAYMENT',
  'NO_HOST_AVAILABLE',
] as const;

/**
 * Parking-only statuses (see `_shared/parkingStatusMachine.ts`) share this badge/label
 * rendering but are not part of the property `BookingStatus` enum above.
 */
const PARKING_ONLY_STATUS_LABELS: Record<string, string> = {
  PENDING_HOST_ACCEPTANCE: 'Finding host',
  PENDING_PAYMENT: 'Awaiting payment',
  NO_HOST_AVAILABLE: 'No host',
};

const PARKING_ONLY_STATUS_TONE: Record<string, StatusTone> = {
  PENDING_HOST_ACCEPTANCE: 'amber',
  PENDING_PAYMENT: 'amber',
  NO_HOST_AVAILABLE: 'neutral',
};

export function statusLabel(value: string): string {
  if (isBookingStatus(value)) return STATUS_LABELS[value];
  return PARKING_ONLY_STATUS_LABELS[value] ?? value;
}

export function statusTone(value: string): StatusTone {
  if (isBookingStatus(value)) return STATUS_TONE[value];
  return PARKING_ONLY_STATUS_TONE[value] ?? 'neutral';
}
