/**
 * Booking workflow state machine — server-side canonical source.
 *
 * Single source of truth for:
 *   • Status enum literals (must match CHECK constraint in DB migration)
 *   • Allowed transition graph (automation + normal admin clicks)
 *   • Admin-only "force advance" edges (manual override / automation catch-up)
 *
 * Mirror: ui/src/features/dashboard/bookings/lib/workflow.ts (kept in sync manually).
 * Rule:   .cursor/rules/booking-workflow.mdc
 * Plan:   docs/planning/NEW_FLOW_PLAN.md §1.3 + §1.4 + §6.1 Q1.3
 *
 * Nested Pending Documents completion is driven by a per-property configurable
 * `DocumentRequirement[]` list (`./documentRequirements.ts`) — callers resolve
 * the list once (or pass `DEFAULT_DOCUMENT_REQUIREMENTS`) and pass it through so
 * this module stays free of DB access.
 */

import {
  DEFAULT_DOCUMENT_REQUIREMENTS,
  requirementApplies,
  requirementNeedsApprovedPdf,
  type DocumentRequirement,
  type DocumentRequirementCompletion,
} from './documentRequirements.ts';

// ─── Status enum ─────────────────────────────────────────────────────────────

export const BOOKING_STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  // Legacy in-flight statuses kept for backward compatibility during rollout.
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

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as ReadonlyArray<string>).includes(value);
}

/** Statuses at or after Ready for Check-in (parent Pending Documents is behind). */
export const POST_PENDING_DOCUMENTS_STATUSES: readonly BookingStatus[] = [
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const;

export function isPostPendingDocumentsStatus(status: string): boolean {
  return (POST_PENDING_DOCUMENTS_STATUSES as readonly string[]).includes(status);
}

/** Same-status manual parking document completion at RFCI+ (no status revert). */
export function isLatePendingParkingDocumentTransition(
  from: BookingStatus,
  to: BookingStatus,
  payload: {
    document_completion_target?: string;
  },
  manual: boolean
): boolean {
  if (!manual || from !== to || !isPostPendingDocumentsStatus(from)) return false;
  return payload.document_completion_target === 'PENDING_PARKING_REQUEST';
}

/**
 * While status is in this set, guest or admin edits to workflow-sensitive booking
 * fields (or guest-doc uploads) reset `status` → `PENDING_REVIEW`.
 * Excludes: `PENDING_REVIEW`, SD refund stages, `COMPLETED`, `CANCELLED`.
 */
export const GUEST_FIELD_EDIT_REVERT_STATUSES = new Set<BookingStatus>([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
]);

export function shouldRevertGuestFieldEditsToPendingReview(
  status: string | null | undefined
): boolean {
  return !!status && isBookingStatus(status) && GUEST_FIELD_EDIT_REVERT_STATUSES.has(status);
}

/** Public `/form?bookingId=` updates are allowed only while the booking awaits admin review. */
export function canGuestPublicUpdateForm(status: string | null | undefined): boolean {
  return String(status ?? '').trim() === 'PENDING_REVIEW';
}

/**
 * Columns cleared when guest-sensitive edits force `status` → `PENDING_REVIEW`
 * (admin `guest_submissions` patch, public `submit-form` update, or guest-doc
 * `upload-booking-asset`). Resets nested Pending Documents substeps, stale
 * approved PDF pointers, **admin parking settlement**, and **guest
 * balance settlement** — **not** pricing snapshot fields (`booking_rate`,
 * `down_payment`, `balance`, `security_deposit`, `pet_fee`,
 * `parking_rate_guest`, `guest_additional_fee`) so the Pending Review pricing
 * card stays as last submitted.
 *
 * Also merged at the **start** of `WorkflowOrchestrator` `PENDING_REVIEW →
 * PENDING_DOCUMENTS | PENDING_GAF` so leftover `*_completed_at` / PDF rows
 * cannot show substeps complete immediately after “Proceed to Pending
 * Documents” (pricing on the row is preserved unless the transition payload
 * overwrites it).
 *
 * Named-column patch only — callers that also write the `document_requirement_completions`
 * JSONB column must additionally call `pendingDocumentsClearCompletionsJsonbPatch()` below
 * with the row's current column value so gaf/pet reset there too (dual-write invariant).
 *
 * Mirror: `ui/src/features/dashboard/bookings/lib/bookingStatus.ts#pendingDocumentsClearPatchForGuestEditRevert`.
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

/**
 * Guest-form keys (compareFormData `changedFields`) that invalidate a stored
 * filled GAF request PDF. Guest doc uploads (valid ID, pet files) are excluded —
 * those are email attachments, not fields inside the generated PDF.
 */
export const GAF_REQUEST_PDF_INVALIDATING_FORM_FIELDS = new Set<string>([
  'guestFacebookName',
  'primaryGuestName',
  'guestEmail',
  'guestPhoneNumber',
  'guest2Name',
  'guest2Age',
  'guest3Name',
  'guest3Age',
  'guest4Name',
  'guest4Age',
  'guest5Name',
  'guest5Age',
  'checkInDate',
  'checkOutDate',
  'checkInTime',
  'checkOutTime',
  'guestRequestsSurpriseDecor',
  'needParking',
  'carPlateNumber',
  'carBrandModel',
  'carColor',
  'hasPets',
]);

/** Guest-form keys that invalidate a stored filled pet request PDF. */
export const PET_REQUEST_PDF_INVALIDATING_FORM_FIELDS = new Set<string>([
  'hasPets',
  'petName',
  'petType',
  'petBreed',
  'petAge',
  'petVaccinationDate',
]);

/** Clear stored request PDF URLs only when the edit changes PDF fill content. */
export function requestPdfClearPatchForChangedFormFields(
  changedFields: string[]
): Record<string, null> {
  const patch: Record<string, null> = {};
  if (changedFields.some((field) => GAF_REQUEST_PDF_INVALIDATING_FORM_FIELDS.has(field))) {
    patch.gaf_request_pdf_url = null;
  }
  if (changedFields.some((field) => PET_REQUEST_PDF_INVALIDATING_FORM_FIELDS.has(field))) {
    patch.pet_request_pdf_url = null;
  }
  return patch;
}

/** Terminal statuses — no further transitions are valid. */
export const TERMINAL_STATUSES = new Set<BookingStatus>(['COMPLETED', 'CANCELLED']);

// ─── Transition graph ─────────────────────────────────────────────────────────

/**
 * Strict workflow graph for automation + normal admin clicks.
 * Any call from workflowOrchestrator or the Gmail listener uses this.
 */
const TRANSITION_GRAPH: Record<BookingStatus, ReadonlyArray<BookingStatus>> = {
  // READY_FOR_CHECKIN is always graph-legal here (D2): workflowOrchestrator only
  // takes it when resolved `documentRequirements` are empty (or the admin
  // explicitly skips); the normal Azure-style path still goes through
  // PENDING_DOCUMENTS. See docs/workflow/in-progress/booking-workflow-configurable-docs.md
  // "Graph note (D2)".
  PENDING_REVIEW: ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED'],
  PENDING_DOCUMENTS: ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED'],
  // Legacy edges (existing rows may still be here):
  PENDING_GAF: ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED'],
  PENDING_PARKING_REQUEST: ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED'],
  PENDING_PET_REQUEST: ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED'],
  READY_FOR_CHECKIN: ['READY_FOR_CHECKOUT', 'CANCELLED'],
  READY_FOR_CHECKOUT: ['PENDING_SD_REFUND', 'COMPLETED', 'CANCELLED'],
  PENDING_SD_REFUND: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  IMPORTED: [],
};

/**
 * Admin-only exceptional edges that the UI workflow panel may surface.
 * These are NOT available to Gmail listener or cron — they exist to let a
 * human recover when automation is late, guest data changes, or the admin
 * needs to step the booking back one stage to redo a step.
 *
 * Forward overrides are listed first (force-advance), backward overrides
 * second (recovery / "oops, went too far"). The UI applies guest-data-aware
 * filtering on top via `isTransitionApplicable` so admins only see the back-
 * step that actually matches the booking's pipeline.
 *
 * See: .cursor/rules/booking-workflow.mdc §2.2
 */
const MANUAL_OVERRIDE_GRAPH: Record<BookingStatus, ReadonlyArray<BookingStatus>> = {
  PENDING_REVIEW: [],
  PENDING_DOCUMENTS: ['PENDING_REVIEW'],
  PENDING_GAF: ['PENDING_DOCUMENTS', 'PENDING_REVIEW'],
  PENDING_PARKING_REQUEST: ['PENDING_DOCUMENTS', 'PENDING_REVIEW'],
  PENDING_PET_REQUEST: ['PENDING_DOCUMENTS', 'PENDING_REVIEW'],
  READY_FOR_CHECKIN: [
    'PENDING_DOCUMENTS',
    'PENDING_PET_REQUEST',
    'PENDING_PARKING_REQUEST',
    'PENDING_GAF',
    'PENDING_REVIEW',
    'PENDING_SD_REFUND',
  ],
  READY_FOR_CHECKOUT: ['READY_FOR_CHECKIN'],
  PENDING_SD_REFUND: ['READY_FOR_CHECKOUT'],
  COMPLETED: [],
  CANCELLED: [],
  IMPORTED: ['CANCELLED', 'PENDING_REVIEW'],
};

export type TransitionContext = {
  /** True when the transition is triggered by an admin action (not cron / listener). */
  manual: boolean;
};

/**
 * Returns true when the `from → to` transition is valid for the given context.
 * This is the primary guard — call it before writing any side effects.
 */
export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  ctx: TransitionContext
): boolean {
  const primary = TRANSITION_GRAPH[from] ?? [];
  if (primary.includes(to)) return true;

  if (ctx.manual) {
    const overrides = MANUAL_OVERRIDE_GRAPH[from] ?? [];
    if (overrides.includes(to)) return true;
  }

  return false;
}

/**
 * Returns all statuses reachable from `from` for the given context.
 * Useful for building the workflow panel's "available transitions" dropdown.
 */
export function availableTransitions(from: BookingStatus, ctx: TransitionContext): BookingStatus[] {
  const primary = [...(TRANSITION_GRAPH[from] ?? [])];
  if (ctx.manual) {
    for (const s of MANUAL_OVERRIDE_GRAPH[from] ?? []) {
      if (!primary.includes(s)) primary.push(s);
    }
  }
  return primary;
}

// ─── Document completion (PENDING_DOCUMENTS nested steps) ───────────────────

/** DB fields used to derive nested document completion under PENDING_DOCUMENTS. */
type PendingDocumentsBookingFields = {
  need_parking?: boolean | null | string;
  has_pets?: boolean | null | string;
  /**
   * When true, the booking requested surprise decor setup.
   */
  guest_requests_surprise_decor?: boolean | null | string;
  gaf_completed_at?: string | null;
  parking_completed_at?: string | null;
  pet_completed_at?: string | null;
  approved_gaf_pdf_url?: string | null;
  approved_pet_pdf_url?: string | null;
  parking_endorsement_url?: string | null;
};

function bookingFlagTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

/** Per-requirement-id completion map read from `guest_submissions.document_requirement_completions`. */
export type DocumentCompletionsMap = Record<string, DocumentRequirementCompletion>;

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
 * Dual-read: prefer the JSONB `document_requirement_completions` map; fall back
 * to the legacy named `gaf_*` / `pet_*` columns for `gaf`/`pet` ids when the map
 * has no entry for them (rows written before the migration 1's backfill, or
 * before a caller has started writing the JSONB map for that id).
 */
export function readDocumentCompletions(
  booking: PendingDocumentsBookingFields & { document_requirement_completions?: unknown }
): DocumentCompletionsMap {
  const map = parseCompletionsMap(booking.document_requirement_completions);
  if (!map.gaf) {
    map.gaf = {
      completedAt: booking.gaf_completed_at ?? null,
      approvedPdfUrl: booking.approved_gaf_pdf_url ?? null,
    };
  }
  if (!map.pet) {
    map.pet = {
      completedAt: booking.pet_completed_at ?? null,
      approvedPdfUrl: booking.approved_pet_pdf_url ?? null,
    };
  }
  return map;
}

/**
 * Merges the guest-edit-revert completion reset into the row's *current*
 * `document_requirement_completions` JSONB map. Every id present is cleared —
 * a renamed requirement (e.g. `custom-2` instead of `gaf`) must not keep the
 * previous cycle's tick — and `gaf`/`pet` are always written so a row whose map
 * is still empty can't dual-read stale named columns. Every caller of
 * `pendingDocumentsClearPatchForGuestEditRevert()` that also intends to write
 * `document_requirement_completions` must call this with the pre-update value
 * of that column — never write a bare `{ gaf, pet }` object over the column,
 * that would silently drop unrelated ids.
 *
 * Mirror: `ui/.../bookings/lib/bookingStatus.ts#pendingDocumentsClearCompletionsJsonbPatch`.
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

function isCompletionDone(
  completion: DocumentRequirementCompletion | undefined,
  requiresApprovedPdf: boolean
): boolean {
  if (!completion) return false;
  if (requiresApprovedPdf) return Boolean(completion.approvedPdfUrl?.trim());
  return !!completion.completedAt || !!completion.approvedPdfUrl;
}

/**
 * Completion flags for the configurable document list + parking while the parent
 * row is still PENDING_DOCUMENTS. Parking is "done" only when `parking_completed_at`
 * is set (not merely `parking_endorsement_url`) — it stays outside `requirements`
 * (hardcoded, not configurable).
 *
 * `gafDone` / `parkingDone` / `petDone` are kept for callers (`workflowOrchestrator`,
 * `telegramAdmin`) mid-cutover; they read `byRequirementId.gaf` / `.pet` and default
 * to `true` (non-blocking) when that id isn't part of the resolved `requirements`.
 */
export function getPendingDocumentsNestedCompletion(
  booking: PendingDocumentsBookingFields & { document_requirement_completions?: unknown },
  requirements: DocumentRequirement[]
): {
  needParking: boolean;
  hasPets: boolean;
  gafDone: boolean;
  parkingDone: boolean;
  petDone: boolean;
  byRequirementId: Record<string, boolean>;
  allConfigurableDocsDone: boolean;
} {
  const needParking = bookingFlagTrue(booking.need_parking);
  const hasPets = bookingFlagTrue(booking.has_pets);
  const completions = readDocumentCompletions(booking);

  const byRequirementId: Record<string, boolean> = {};
  let allConfigurableDocsDone = true;
  for (const req of requirements) {
    if (!requirementApplies(req, booking)) continue;
    const done = isCompletionDone(completions[req.id], requirementNeedsApprovedPdf(req));
    byRequirementId[req.id] = done;
    if (!done) allConfigurableDocsDone = false;
  }

  const parkingDone = !needParking || !!booking.parking_completed_at;
  const gafDone = byRequirementId.gaf ?? true;
  const petDone = byRequirementId.pet ?? true;

  return {
    needParking,
    hasPets,
    gafDone,
    parkingDone,
    petDone,
    byRequirementId,
    allConfigurableDocsDone,
  };
}

// ─── Human labels (for admin UI display) ─────────────────────────────────────

export const STATUS_HUMAN_LABEL: Record<BookingStatus, string> = {
  PENDING_REVIEW: 'Pending Review',
  PENDING_DOCUMENTS: 'Pending Documents',
  PENDING_GAF: 'Pending GAF',
  PENDING_PARKING_REQUEST: 'Pending Parking Request',
  PENDING_PET_REQUEST: 'Pending Pet Request',
  READY_FOR_CHECKIN: 'Ready for Check-in',
  READY_FOR_CHECKOUT: 'Ready for Check-out',
  PENDING_SD_REFUND: 'Pending SD Refund',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  IMPORTED: 'Imported',
};

/** Canonical order of all non-terminal pipeline statuses (excluding CANCELLED). Mirrors UI `workflow.ts`. */
export const PIPELINE_ORDER: readonly BookingStatus[] = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const;

export type BookingPipelineFlags = {
  need_parking?: boolean | null;
  has_pets?: boolean | null;
  security_deposit?: number | string | null;
};

export function bookingPipeline(
  booking: BookingPipelineFlags,
  currentStatus?: BookingStatus,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): BookingStatus[] {
  const sdIsZero = booking.security_deposit != null && Number(booking.security_deposit) === 0;
  const skipPendingDocuments = documentRequirements.length === 0;
  const filtered = PIPELINE_ORDER.filter((s) => {
    if (s === 'PENDING_DOCUMENTS') return !skipPendingDocuments;
    if (s === 'PENDING_PARKING_REQUEST') return !!booking.need_parking;
    if (s === 'PENDING_PET_REQUEST') return !!booking.has_pets;
    if (s === 'PENDING_SD_REFUND') return !sdIsZero;
    return true;
  });

  if (
    currentStatus &&
    currentStatus !== 'CANCELLED' &&
    currentStatus !== 'IMPORTED' &&
    !filtered.includes(currentStatus)
  ) {
    const targetIdx = PIPELINE_ORDER.indexOf(currentStatus);
    let insertAt = filtered.length;
    for (let i = 0; i < filtered.length; i++) {
      if (PIPELINE_ORDER.indexOf(filtered[i]) > targetIdx) {
        insertAt = i;
        break;
      }
    }
    filtered.splice(insertAt, 0, currentStatus);
  }

  return filtered;
}

export function nextStep(
  booking: BookingPipelineFlags,
  currentStatus: BookingStatus,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): BookingStatus | null {
  const pipeline = bookingPipeline(booking, currentStatus, documentRequirements);
  const idx = pipeline.indexOf(currentStatus);
  if (idx < 0 || idx >= pipeline.length - 1) return null;
  return pipeline[idx + 1];
}

export type SubFormKind = 'pricing' | 'parking' | 'guest_balance' | 'sd_refund' | null;

export function requiredSubForm(from: string, to: BookingStatus): SubFormKind {
  if (from === 'PENDING_REVIEW' && (to === 'PENDING_DOCUMENTS' || to === 'READY_FOR_CHECKIN')) {
    return 'pricing';
  }
  if (
    from === 'PENDING_PARKING_REQUEST' &&
    (to === 'PENDING_PET_REQUEST' || to === 'READY_FOR_CHECKIN')
  ) {
    return 'parking';
  }
  if (from === 'READY_FOR_CHECKIN' && to === 'READY_FOR_CHECKOUT') return 'guest_balance';
  if (from === 'PENDING_SD_REFUND' && to === 'COMPLETED') return 'sd_refund';
  return null;
}
