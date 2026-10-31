/**
 * Booking workflow — client-side mirror of statusMachine.ts.
 *
 * Keeps the transition graph and calendar meta in sync with the server so
 * the admin UI can drive the WorkflowPanel without an extra round-trip.
 *
 * ⚠️  When you change statusMachine.ts on the server, update this file too.
 *     Rule: .cursor/rules/booking-workflow.mdc §1 ("single source of truth").
 *     Plan: docs/planning/NEW_FLOW_PLAN.md §1.3 + §1.4 + §6.1 Q1.3
 */

import { statusLabel, type BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  DEFAULT_DOCUMENT_REQUIREMENTS,
  requirementApplies,
  requirementNeedsApprovedPdf,
  type DocumentApprovalSource,
  type DocumentRequirement,
  type DocumentRequirementCompletion,
} from '@/features/dashboard/bookings/lib/documentRequirements';

// ─── Allowed transitions ──────────────────────────────────────────────────────

/**
 * Primary workflow graph (automation + normal admin clicks).
 * Mirrors TRANSITION_GRAPH in statusMachine.ts.
 */
const TRANSITION_GRAPH: Record<string, ReadonlyArray<BookingStatus>> = {
  // READY_FOR_CHECKIN is always graph-legal here (D2): the server only takes it
  // when resolved documentRequirements are empty — see statusMachine.ts.
  PENDING_REVIEW: ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED'],
  PENDING_DOCUMENTS: ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'CANCELLED'],
  // Legacy compatibility for already-in-flight rows:
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
 * Admin-only override edges — exposed in the WorkflowPanel for manual recovery
 * when cron / inbound approval is late or skipped, or when the admin needs to
 * step the booking back one stage to redo a step.
 *
 * Mirrors MANUAL_OVERRIDE_GRAPH in statusMachine.ts.
 */
const MANUAL_OVERRIDE_GRAPH: Record<string, ReadonlyArray<BookingStatus>> = {
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

export type WorkflowContext = {
  /** Whether the transition is triggered by an admin (vs cron / automation). */
  manual: boolean;
};

/**
 * Returns true when the `from → to` transition is valid for the given context.
 * The server validates again — this is for optimistic UI feedback.
 */
export function canTransition(from: string, to: BookingStatus, ctx: WorkflowContext): boolean {
  const primary = TRANSITION_GRAPH[from] ?? [];
  if (primary.includes(to)) return true;

  if (ctx.manual) {
    const overrides = MANUAL_OVERRIDE_GRAPH[from] ?? [];
    if (overrides.includes(to)) return true;
  }

  return false;
}

/**
 * Returns all statuses the admin may transition to from `from`.
 * Used to build the WorkflowPanel's action buttons / dropdown.
 */
export function availableTransitions(from: string, ctx: WorkflowContext): BookingStatus[] {
  const primary = [...(TRANSITION_GRAPH[from] ?? [])] as BookingStatus[];
  if (ctx.manual) {
    for (const s of MANUAL_OVERRIDE_GRAPH[from] ?? []) {
      if (!primary.includes(s)) primary.push(s);
    }
  }
  return primary;
}

// ─── Booking-data-aware filtering ────────────────────────────────────────────
//
// The state machine knows which transitions are *graph-legal*, but the UI
// should only surface the ones that actually apply to this booking's guest
// data. e.g. don't offer "Pending Parking Request" when the guest didn't ask
// for parking. The natural order matches the side-effect matrix:
//   PENDING_GAF → PENDING_PARKING_REQUEST → PENDING_PET_REQUEST → READY_FOR_CHECKIN
// so when parking AND pets both apply, parking is surfaced first; the pet step
// only appears once parking has been handled.
//
// Rule: .cursor/rules/booking-workflow.mdc §2.1 (graph) + §3 (side-effect order)

type ApplicabilityFlags = {
  need_parking?: boolean | null;
  has_pets?: boolean | null;
  approved_gaf_pdf_url?: string | null;
  parking_endorsement_url?: string | null;
  approved_pet_pdf_url?: string | null;
  gaf_completed_at?: string | null;
  parking_completed_at?: string | null;
  pet_completed_at?: string | null;
  security_deposit?: number | string | null;
};

export type PendingDocumentSubStatus =
  'PENDING_GAF' | 'PENDING_PARKING_REQUEST' | 'PENDING_PET_REQUEST';

/**
 * `requirements` defaults to `DEFAULT_DOCUMENT_REQUIREMENTS` (GAF always + pet on
 * `has_pets`) for Azure parity when a caller has no resolved list handy — but a
 * property with a custom (or empty) override must not show GAF/pet as required
 * just because they aren't in that list. Pass the property's resolved
 * `resolvedDocumentRequirements` (from `useAppSettings`) whenever available.
 */
export function isSubStatusRequired(
  subStatus: PendingDocumentSubStatus,
  booking: ApplicabilityFlags,
  requirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): boolean {
  if (subStatus === 'PENDING_PARKING_REQUEST') return !!booking.need_parking;
  const requirementId = subStatus === 'PENDING_GAF' ? 'gaf' : 'pet';
  const req = requirements.find((r) => r.id === requirementId);
  return !!req && requirementApplies(req, booking);
}

/** Statuses at or after Ready for Check-in (parent Pending Documents is behind). */
export const POST_PENDING_DOCUMENTS_STATUSES: readonly BookingStatus[] = [
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const;

export function isPostPendingDocumentsStatus(status: string): status is BookingStatus {
  return (POST_PENDING_DOCUMENTS_STATUSES as readonly string[]).includes(status);
}

/**
 * Pending Parking Request stays clickable in the stepper when parking is still
 * incomplete — including after pay parking is added at Ready for Check-in+.
 * Completed parking substeps are not navigatable (handled by callers).
 */
export function canNavigatePendingParkingSubStep(
  booking: ApplicabilityFlags,
  currentStatus: string
): boolean {
  if (!isSubStatusRequired('PENDING_PARKING_REQUEST', booking)) return false;
  if (isSubStatusCompleted('PENDING_PARKING_REQUEST', booking)) return false;
  if (currentStatus === 'PENDING_DOCUMENTS') return true;
  return isPostPendingDocumentsStatus(currentStatus);
}

export function isSubStatusCompleted(
  subStatus: PendingDocumentSubStatus,
  booking: ApplicabilityFlags,
  requirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): boolean {
  if (!isSubStatusRequired(subStatus, booking, requirements)) return true;
  if (subStatus === 'PENDING_GAF') {
    return Boolean(booking.approved_gaf_pdf_url?.trim());
  }
  if (subStatus === 'PENDING_PARKING_REQUEST') {
    // Endorsement upload only fills `parking_endorsement_url`; admin must still
    // click "Mark as Complete" so `transition-booking` sets `parking_completed_at`.
    return !!booking.parking_completed_at;
  }
  return Boolean(booking.approved_pet_pdf_url?.trim());
}

/**
 * Pipeline stepper nested rows under **Pending Documents**: when the booking is
 * back in **PENDING_REVIEW** (e.g. sensitive-field revert), substeps must not
 * show green "complete" from a prior cycle — DB may still hold old completion
 * URLs until the next admin transition, and the UX should match "fresh review".
 */
export function isSubStatusCompletedInStepper(
  booking: ApplicabilityFlags & { status?: string | null },
  subStatus: PendingDocumentSubStatus
): boolean {
  if (!isSubStatusRequired(subStatus, booking)) return true;
  if (booking.status === 'PENDING_REVIEW') return false;
  return isSubStatusCompleted(subStatus, booking);
}

export function arePendingDocumentsComplete(booking: ApplicabilityFlags): boolean {
  return (
    isSubStatusCompleted('PENDING_GAF', booking) &&
    isSubStatusCompleted('PENDING_PARKING_REQUEST', booking) &&
    isSubStatusCompleted('PENDING_PET_REQUEST', booking)
  );
}

// ─── Configurable document requirements (mirror of statusMachine.ts — D3) ────
//
// Generalized nested-completion + calendar-prefix helpers driven by a
// per-property `DocumentRequirement[]` list. Wired into the stepper /
// WorkflowPanel below (Task 7) — keep this file in lockstep with statusMachine.ts.

export type DocumentCompletionsMap = Record<string, DocumentRequirementCompletion>;

type ConfigurableDocsBooking = ApplicabilityFlags & { document_requirement_completions?: unknown };

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
 * to the legacy named `gaf_*` / `pet_*` fields for those ids when the map has no
 * entry for them. Mirrors `statusMachine.ts#readDocumentCompletions`.
 */
export function readDocumentCompletions(booking: ConfigurableDocsBooking): DocumentCompletionsMap {
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

function isCompletionDone(
  completion: DocumentRequirementCompletion | undefined,
  requiresApprovedPdf: boolean
): boolean {
  if (!completion) return false;
  if (requiresApprovedPdf) return Boolean(completion.approvedPdfUrl?.trim());
  return !!completion.completedAt || !!completion.approvedPdfUrl;
}

/** Mirrors `statusMachine.ts#getPendingDocumentsNestedCompletion`. */
export function getPendingDocumentsNestedCompletion(
  booking: ConfigurableDocsBooking,
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
  const needParking = !!booking.need_parking;
  const hasPets = !!booking.has_pets;
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

// ─── Generalized nested-doc stepper keys (Task 7) ────────────────────────────
//
// `PendingDocumentSubStatus` above stays for Kanban + the legacy GAF/parking/pet
// literal call sites. The stepper + WorkflowPanel render *any* configured
// `DocumentRequirement`, so nested-doc UI keys are plain requirement ids (or
// the `PENDING_PARKING_REQUEST` sentinel below for the hardcoded parking step,
// which stays outside `documentRequirements` — see documentRequirements.ts).

export type PendingDocNestedKey = string;

export const PARKING_NESTED_KEY: PendingDocNestedKey = 'PENDING_PARKING_REQUEST';

export type PendingDocNestedItem = {
  key: PendingDocNestedKey;
  label: string;
  completed: boolean;
  /** null for parking — it has no configurable approval source. */
  approvalSource: DocumentApprovalSource | null;
};

/**
 * Ordered nested items under Pending Documents: `requirements.filter(requirementApplies)`
 * sorted by `order`, with the parking subtree appended last when `need_parking`
 * (GAF → pet → parking display order when using defaults).
 * Empty requirements + no parking → empty list (D2: no nested tree to show).
 */
export function pendingDocumentsNestedItems(
  booking: ConfigurableDocsBooking,
  requirements: DocumentRequirement[]
): PendingDocNestedItem[] {
  const { byRequirementId, parkingDone, needParking } = getPendingDocumentsNestedCompletion(
    booking,
    requirements
  );
  const applicable = [...requirements]
    .sort((a, b) => a.order - b.order)
    .filter((req) => requirementApplies(req, booking));

  const items: PendingDocNestedItem[] = [];
  let parkingInserted = false;
  const insertParkingIfNeeded = () => {
    if (parkingInserted) return;
    parkingInserted = true;
    if (needParking) {
      items.push({
        key: PARKING_NESTED_KEY,
        label: statusLabel(PARKING_NESTED_KEY),
        completed: parkingDone,
        approvalSource: null,
      });
    }
  };

  for (const req of applicable) {
    items.push({
      key: req.id,
      label: req.label,
      completed: !!byRequirementId[req.id],
      approvalSource: req.approvalSource,
    });
  }
  insertParkingIfNeeded();

  return items;
}

/**
 * Stepper-display variant of `pendingDocumentsNestedItems` — forces every item
 * to show incomplete while `status === PENDING_REVIEW`, matching
 * `isSubStatusCompletedInStepper`'s "fresh review" guard (DB may still hold a
 * prior cycle's completion until the next admin transition).
 */
export function pendingDocumentsNestedItemsForStepper(
  booking: ConfigurableDocsBooking & { status?: string | null },
  requirements: DocumentRequirement[]
): PendingDocNestedItem[] {
  const items = pendingDocumentsNestedItems(booking, requirements);
  if (booking.status === 'PENDING_REVIEW') {
    return items.map((item) => ({ ...item, completed: false }));
  }
  return items;
}

/** Resolves a display label for a nested key even when it's not in the current item list. */
export function nestedKeyLabel(
  key: PendingDocNestedKey,
  requirements: DocumentRequirement[]
): string {
  if (key === PARKING_NESTED_KEY) return statusLabel(PARKING_NESTED_KEY);
  return requirements.find((req) => req.id === key)?.label ?? key;
}

/**
 * Nested doc key the Pending Documents view should open on, or `null` when none
 * apply (D2). Prefers the first *incomplete* step so the rail lands on the work
 * that is actually outstanding; falls back to the first step once all are done.
 */
export function defaultPendingDocNestedKey(
  booking: ConfigurableDocsBooking,
  requirements: DocumentRequirement[]
): PendingDocNestedKey | null {
  const items = pendingDocumentsNestedItems(booking, requirements);
  if (items.length === 0) return null;
  return (items.find((item) => !item.completed) ?? items[0]).key;
}

/**
 * Tab to focus after marking a nested doc step complete: next incomplete in
 * display order, or — when the host completed steps out of order (e.g. Parking
 * before Pet) — the first incomplete step anywhere. `null` when all are done.
 */
export function nextIncompletePendingDocKeyAfter(
  booking: ConfigurableDocsBooking,
  requirements: DocumentRequirement[],
  afterKey: PendingDocNestedKey
): PendingDocNestedKey | null {
  const items = pendingDocumentsNestedItems(booking, requirements);
  const startIdx = items.findIndex((item) => item.key === afterKey);
  if (startIdx >= 0) {
    for (let i = startIdx + 1; i < items.length; i++) {
      if (!items[i].completed) return items[i].key;
    }
  }
  return items.find((item) => !item.completed)?.key ?? null;
}

/**
 * Whether a graph-legal transition should actually be shown for this booking.
 * Filters out steps that don't apply based on guest data:
 *   - Hides parking step when `need_parking` is false.
 *   - Hides pet step when `has_pets` is false.
 *   - Hides "skip to Ready for Check-in" when sub-stages still apply.
 */
export function isTransitionApplicable(
  from: string,
  to: BookingStatus,
  booking: ApplicabilityFlags
): boolean {
  const needsParking = !!booking.need_parking;
  const hasPets = !!booking.has_pets;

  if (from === 'PENDING_GAF') {
    if (to === 'PENDING_PARKING_REQUEST') return needsParking;
    // Parking must be handled before pet when both apply.
    if (to === 'PENDING_PET_REQUEST') return hasPets && !needsParking;
    // Skip-to-ready only when no sub-stages remain.
    if (to === 'READY_FOR_CHECKIN') return !needsParking && !hasPets;
  }

  if (from === 'PENDING_PARKING_REQUEST') {
    if (to === 'PENDING_PET_REQUEST') return hasPets;
    if (to === 'READY_FOR_CHECKIN') return !hasPets;
  }

  return true;
}

/**
 * Convenience wrapper that combines `availableTransitions` + applicability.
 * Always excludes CANCELLED — cancel is rendered separately in the UI.
 */
export function applicableTransitions(
  from: string,
  ctx: WorkflowContext,
  booking: ApplicabilityFlags
): BookingStatus[] {
  return availableTransitions(from, ctx)
    .filter((to) => to !== 'CANCELLED')
    .filter((to) => isTransitionApplicable(from, to, booking));
}

// ─── Pipeline helpers (booking-aware stepper) ────────────────────────────────
//
// `bookingPipeline(booking)` returns the *ordered* list of statuses this
// booking will walk through, hiding parking / pet stages that don't apply.
// `nextStep` and `previousStep` give the immediately adjacent step so the
// WorkflowPanel can render explicit "Proceed →" and "← Back" buttons. CANCELLED
// is intentionally excluded — cancel is a side path, not a pipeline step.

/** Canonical order of all non-terminal pipeline statuses (excluding CANCELLED). */
export const PIPELINE_ORDER: readonly BookingStatus[] = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const;

/**
 * Returns the steps that apply to this booking, in order.
 *
 * Conditional steps are filtered:
 *   - PENDING_PARKING_REQUEST is included only when `need_parking`.
 *   - PENDING_PET_REQUEST     is included only when `has_pets`.
 *
 * `currentStatus` is included as a defensive measure: if a booking somehow
 * sits at a status that the booking flags say shouldn't apply (data drift),
 * we still surface it so the stepper has a valid "current" position.
 */
export function bookingPipeline(
  booking: ApplicabilityFlags,
  currentStatus?: BookingStatus,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): BookingStatus[] {
  const sdIsZero = booking.security_deposit != null && Number(booking.security_deposit) === 0;
  // D2: empty resolved requirements skip PENDING_DOCUMENTS entirely, regardless
  // of parking — late parking is still available at RFCI+ (§3 booking-workflow.mdc).
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

/** Immediately previous step in the booking's pipeline, or null at the start. */
export function previousStep(
  booking: ApplicabilityFlags,
  currentStatus: BookingStatus,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): BookingStatus | null {
  const pipeline = bookingPipeline(booking, currentStatus, documentRequirements);
  const idx = pipeline.indexOf(currentStatus);
  if (idx <= 0) return null;
  return pipeline[idx - 1];
}

/** Immediately next step in the booking's pipeline, or null at the end. */
export function nextStep(
  booking: ApplicabilityFlags,
  currentStatus: BookingStatus,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): BookingStatus | null {
  const pipeline = bookingPipeline(booking, currentStatus, documentRequirements);
  const idx = pipeline.indexOf(currentStatus);
  if (idx < 0 || idx >= pipeline.length - 1) return null;
  return pipeline[idx + 1];
}

/**
 * Direction of a transition relative to this booking's pipeline.
 * Used in the UI to label buttons ("Proceed to" vs "Back to") and decide
 * whether sub-form gating applies.
 */
export type TransitionDirection = 'forward' | 'backward' | 'lateral';

export function transitionDirection(
  from: BookingStatus,
  to: BookingStatus,
  booking: ApplicabilityFlags,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): TransitionDirection {
  const pipeline = bookingPipeline(booking, from, documentRequirements);
  const fromIdx = pipeline.indexOf(from);
  const toIdx = pipeline.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return 'lateral';
  if (toIdx > fromIdx) return 'forward';
  if (toIdx < fromIdx) return 'backward';
  return 'lateral';
}

// ─── Human-readable action labels for transition buttons ─────────────────────

const TRANSITION_ACTION_LABEL: Partial<Record<BookingStatus, string>> = {
  PENDING_DOCUMENTS: 'Proceed to Pending Documents',
  PENDING_GAF: 'Mark as Complete - Pending GAF',
  PENDING_PARKING_REQUEST: 'Proceed to Pending Parking Request',
  PENDING_PET_REQUEST: 'Proceed to Pending Pet Request',
  READY_FOR_CHECKIN: 'Proceed to Ready for Check-in',
  READY_FOR_CHECKOUT: 'Proceed to Ready for Check-out',
  PENDING_SD_REFUND: 'Proceed to Pending SD Refund',
  COMPLETED: 'Complete Booking',
  PENDING_REVIEW: 'Revert to Pending Review',
  CANCELLED: 'Cancel Booking',
};

export function transitionActionLabel(to: BookingStatus): string {
  return TRANSITION_ACTION_LABEL[to] ?? `Move to ${to}`;
}

// ─── Sub-form requirement per target status ───────────────────────────────────
// Each transition may require additional input from the admin before it can fire.
// Phase 3 will render these sub-forms in the WorkflowPanel.

export type SubFormKind =
  | 'pricing' // ReviewPricingForm (booking rate, down payment, SD, pet fee)
  | 'parking' // ParkingRequestForm (parking rates, endorsement upload)
  | 'guest_balance' // GuestBalanceSettlementForm (paid = total guest balance + receipt)
  | 'sd_refund' // SdRefundForm (expenses, profits, refund amount, receipt upload)
  | null;

export const TRANSITION_SUB_FORM: Partial<Record<BookingStatus, SubFormKind>> = {
  PENDING_DOCUMENTS: 'pricing', // admin must enter rates before proceeding
  PENDING_PARKING_REQUEST: null,
  READY_FOR_CHECKIN: null, // use requiredSubForm(from, to) — RFCI → READY_FOR_CHECKOUT uses guest_balance
  COMPLETED: null,
};

export function requiredSubForm(from: string, to: BookingStatus): SubFormKind {
  // D2: pricing is still required on the direct PENDING_REVIEW → READY_FOR_CHECKIN
  // skip — the orchestrator computes `balance` for every `isReviewProceedAttempt`,
  // regardless of whether documentRequirements is empty.
  if (from === 'PENDING_REVIEW' && (to === 'PENDING_DOCUMENTS' || to === 'READY_FOR_CHECKIN')) {
    return 'pricing';
  }
  if (
    from === 'PENDING_PARKING_REQUEST' &&
    (to === 'PENDING_PET_REQUEST' || to === 'READY_FOR_CHECKIN')
  )
    return 'parking';
  if (from === 'READY_FOR_CHECKIN' && to === 'READY_FOR_CHECKOUT') return 'guest_balance';
  if (from === 'PENDING_SD_REFUND' && to === 'COMPLETED') return 'sd_refund';
  return null;
}

// ─── Progress stepper — read-only preview ─────────────────────────────────────

export type WorkflowViewContent =
  | SubFormKind
  | 'sd_guest_info'
  | 'doc_sub_status'
  /** Terminal stage has no form — the rail shows what the booking closed with. */
  | 'completed_summary';

export type ViewedWorkflowStep =
  | { kind: 'pipeline'; status: BookingStatus }
  | { kind: 'pending-doc-sub'; sub: PendingDocNestedKey };

export function initialViewedWorkflowStep(
  status: BookingStatus,
  booking: ConfigurableDocsBooking,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): ViewedWorkflowStep {
  if (status === 'PENDING_DOCUMENTS') {
    const key = defaultPendingDocNestedKey(booking, documentRequirements);
    if (key) return { kind: 'pending-doc-sub', sub: key };
  }
  return { kind: 'pipeline', status };
}

/** Which sub-form / info card to render for a stepper selection. */
export function workflowContentForView(
  viewed: ViewedWorkflowStep,
  booking: ConfigurableDocsBooking,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): WorkflowViewContent | null {
  if (viewed.kind === 'pending-doc-sub') {
    if (viewed.sub === PARKING_NESTED_KEY) {
      return isSubStatusRequired('PENDING_PARKING_REQUEST', booking) ? 'parking' : null;
    }
    const req = documentRequirements.find((r) => r.id === viewed.sub);
    if (!req || !requirementApplies(req, booking)) return null;
    return 'doc_sub_status';
  }

  switch (viewed.status) {
    case 'PENDING_REVIEW':
    case 'PENDING_DOCUMENTS':
      return 'pricing';
    case 'READY_FOR_CHECKIN':
      return 'guest_balance';
    case 'READY_FOR_CHECKOUT':
      return 'sd_guest_info';
    case 'PENDING_SD_REFUND':
      return 'sd_refund';
    case 'COMPLETED':
      return 'completed_summary';
    default:
      return null;
  }
}

/** True when the panel shows the live editable workflow for the booking's current status. */
export function isLiveWorkflowView(
  viewed: ViewedWorkflowStep,
  currentStatus: BookingStatus,
  booking: ApplicabilityFlags
): boolean {
  if (
    currentStatus === 'CANCELLED' ||
    currentStatus === 'COMPLETED' ||
    currentStatus === 'IMPORTED'
  ) {
    return viewed.kind === 'pipeline' && viewed.status === currentStatus;
  }
  if (viewed.kind === 'pending-doc-sub') {
    if (currentStatus === 'PENDING_DOCUMENTS') return true;
    return (
      viewed.sub === 'PENDING_PARKING_REQUEST' &&
      canNavigatePendingParkingSubStep(booking, currentStatus)
    );
  }
  return viewed.status === currentStatus;
}

// ─── Workflow Details edit form (BookingEditForm) ─────────────────────────────

/** Sub-forms shown under Edit booking → Workflow Details. */
export type ProgressEditFormKind =
  'pricing' | 'parking' | 'guest_balance' | 'sd_refund_guest' | 'sd_settlement';

/** Pipeline stage when each Progress-rail form first becomes editable. */
export const PROGRESS_EDIT_FORM_UNLOCK: Record<ProgressEditFormKind, BookingStatus> = {
  pricing: 'PENDING_REVIEW',
  parking: 'PENDING_DOCUMENTS',
  guest_balance: 'READY_FOR_CHECKIN',
  sd_refund_guest: 'READY_FOR_CHECKOUT',
  sd_settlement: 'PENDING_SD_REFUND',
};

/** Map nested statuses onto the main pipeline for ordering. */
function progressEditStatusRank(status: string): number {
  if (status === 'CANCELLED' || status === 'IMPORTED') return -1;
  const direct = PIPELINE_ORDER.indexOf(status as BookingStatus);
  if (direct >= 0) return direct;
  if (
    status === 'PENDING_GAF' ||
    status === 'PENDING_PARKING_REQUEST' ||
    status === 'PENDING_PET_REQUEST'
  ) {
    return PIPELINE_ORDER.indexOf('PENDING_DOCUMENTS');
  }
  return -1;
}

/** True when the booking has reached the pipeline stage for this Progress-rail form. */
export function isProgressEditFormEnabled(
  booking: ApplicabilityFlags & { status?: string | null },
  form: ProgressEditFormKind
): boolean {
  const status = (booking.status ?? '').trim();
  if (!status || status === 'CANCELLED' || status === 'IMPORTED') return false;

  const currentRank = progressEditStatusRank(status);
  const unlockRank = progressEditStatusRank(PROGRESS_EDIT_FORM_UNLOCK[form]);
  if (currentRank < 0 || unlockRank < 0) return false;
  return currentRank >= unlockRank;
}

// ─── Terminal status check ────────────────────────────────────────────────────

export const TERMINAL_STATUSES = new Set<string>(['COMPLETED', 'CANCELLED']);

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
