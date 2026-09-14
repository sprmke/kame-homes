/**
 * Workflow Orchestrator — single source of truth for booking transition side effects.
 *
 * ALL transitions (from UI, Gmail listener, or cron) must go through
 * `WorkflowOrchestrator.transition()`. Never call emailService directly from a handler.
 *
 * Rules:  .cursor/rules/booking-workflow.mdc §3, §5 (side-effect matrix)
 * Plan:   docs/planning/NEW_FLOW_PLAN.md §3.3
 */

import { DatabaseService } from './databaseService.ts';
import { ensureGuestStayGuideToken } from './guestStayGuide.ts';
import {
  checkGuestBalanceSettlement,
  computeTotalGuestBalanceFromBooking,
  guestBalancePaymentReceiptRequired,
} from './totalGuestBalance.ts';
import { receiptVerdictBlocksAdminTransition } from './receiptValidationService.ts';
import { generatePDF, generatePetPDF } from './pdfService.ts';
import { UploadService } from './uploadService.ts';
import { bookingAssetStorageKey } from './bookingStoragePaths.ts';
import {
  sendEmail,
  sendPetEmail,
  sendBookingAcknowledgement,
  sendReadyForCheckin,
  sendSdRefundFormRequest,
} from './emailService.ts';
import {
  planBlockedAutomationToggleKeys,
  propertyAutomationEnabled,
  type PropertyAutomationToggleKey,
} from './propertyAutomationToggles.ts';
import { createNotification } from './notificationService.ts';
import { bookingNotificationMetadata } from './notificationEnrichment.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import { type ActivityActorType, type ActorContext, logActivity } from './activityLog.ts';
import { capturePostHogEvent } from './posthog.ts';
import {
  BookingStatus,
  canTransition,
  getPendingDocumentsNestedCompletion,
  isLatePendingParkingDocumentTransition,
  isPostPendingDocumentsStatus,
  pendingDocumentsClearPatchForGuestEditRevert,
  readDocumentCompletions,
  STATUS_HUMAN_LABEL,
  type DocumentCompletionsMap,
} from './statusMachine.ts';
import {
  DEFAULT_DOCUMENT_REQUIREMENTS,
  hasApplicableDocumentPdfTemplate,
  requirementDocKind,
  requirementMatchesPdfTemplate,
  resolveDocumentRequirements,
  type DocumentRequirement,
  type DocumentRequirementCompletion,
} from './documentRequirements.ts';
import type { SdRefundBank } from './sdRefundBank.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payload fields that may be required depending on the target status.
 * All are optional; validation of required fields is done per-transition below.
 */
export type TransitionPayload = {
  // Pricing (PENDING_REVIEW → PENDING_GAF | PENDING_DOCUMENTS)
  booking_rate?: number | null;
  down_payment?: number | null;
  security_deposit?: number | null;
  pet_fee?: number | null;
  parking_rate_guest?: number | null;
  guest_additional_fee?: number | null;
  /** Peso discount from an applied next-stay voucher (locked on review). */
  applied_voucher_discount_php?: number | null;
  /** Required on PENDING_REVIEW → initial docs when `guest_requests_surprise_decor` is true. */
  surprise_decor_staff_acknowledged?: boolean;

  // Parking (PENDING_PARKING_REQUEST → *)
  parking_rate_paid?: number | null;
  parking_owner_email?: string | null;
  /** Owner or agent display name (who parking was obtained from). */
  parking_owner?: string | null;
  parking_endorsement_url?: string | null;
  /** Default true — parking fee bundled in downpayment receipt. */
  parking_fee_included_in_downpayment?: boolean | null;
  /** Required when parking_fee_included_in_downpayment is false. */
  parking_payment_receipt_url?: string | null;

  // SD Refund (PENDING_SD_REFUND → COMPLETED)
  sd_additional_expenses?: number[] | null;
  sd_additional_profits?: number[] | null;
  sd_additional_expense_items?: Array<{ label: string; amount: number }> | null;
  sd_additional_profit_items?: Array<{ label: string; amount: number }> | null;
  sd_refund_amount?: number | null;
  sd_refund_receipt_url?: string | null;

  /** READY_FOR_CHECKIN → READY_FOR_CHECKOUT: paid must equal computed total guest balance + receipt. */
  guest_balance_paid_amount?: number | null;
  guest_balance_payment_receipt_url?: string | null;

  // Guest SD form (READY_FOR_CHECKOUT → PENDING_SD_REFUND)
  sd_refund_guest_feedback?: string | null;
  sd_refund_method?: 'same_phone' | 'other_bank' | 'cash' | null;
  sd_refund_phone_confirmed?: boolean | null;
  sd_refund_bank?: SdRefundBank | null;
  sd_refund_account_name?: string | null;
  sd_refund_account_number?: string | null;

  // Approved PDFs (set by Gmail listener in Phase 4; admin can also set manually)
  approved_gaf_pdf_url?: string | null;
  approved_pet_pdf_url?: string | null;

  /**
   * PENDING_DOCUMENTS → PENDING_DOCUMENTS: admin marks a sub-step complete (no status change).
   * Accepts legacy literals (`PENDING_GAF` → `gaf`, `PENDING_PET_REQUEST` → `pet`,
   * `PENDING_PARKING_REQUEST` special-cased) or a bare requirement id (e.g. `"gaf"`).
   */
  document_completion_target?:
    'PENDING_GAF' | 'PENDING_PARKING_REQUEST' | 'PENDING_PET_REQUEST' | string;
};

/**
 * Dev-control checkboxes from the admin panel.
 * All default to `true` (run everything) unless explicitly set to `false`.
 */
export type DevControlFlags = {
  saveToDatabase?: boolean;
  /** Filled GAF (+ pet request PDF if pets) generate + optional Storage upload on PENDING_REVIEW → initial docs. */
  generatePdf?: boolean;
  sendGafRequestEmail?: boolean;
  sendParkingBroadcastEmail?: boolean;
  sendPetRequestEmail?: boolean;
  sendBookingAcknowledgementEmail?: boolean;
  sendReadyForCheckinEmail?: boolean;
  /** Email guest the /sd-form link when moving READY_FOR_CHECKIN → READY_FOR_CHECKOUT (cron + manual). */
  sendSdRefundFormEmail?: boolean;
};

export type TransitionResult = {
  success: boolean;
  booking: any;
  sideEffects: {
    emails: string[];
    /**
     * Automation emails this transition would have sent had the property's plan included
     * `automatedBookingFlow` — e.g. `'gaf_request'`. Client surfaces a manual-action prompt for
     * these; distinct from a property owner deliberately turning a toggle off (no prompt there).
     */
    automationSkippedByPlan: string[];
    /**
     * Workflow emails skipped because the property owner turned the toggle off (not plan-blocked).
     * Client may surface a settings hint — distinct from `automationSkippedByPlan`.
     */
    automationSkippedByHost: string[];
    /**
     * True when every guest-facing side effect (acknowledgement / ready-for-check-in /
     * SD-refund-form emails, stay-guide token, guest bell notifications) was skipped because
     * this is an OTA-ingested booking with no guest contact yet — see calendar sync Phase 2.
     */
    externalSuppressed?: boolean;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flag(flags: DevControlFlags, key: keyof DevControlFlags): boolean {
  const val = flags[key];
  return val === undefined ? true : val;
}

function computeBalance(bookingRate?: number | null, downPayment?: number | null): number | null {
  if (bookingRate == null || downPayment == null) return null;
  return bookingRate - downPayment;
}

/**
 * `document_completion_target` accepts the legacy `PENDING_GAF` / `PENDING_PET_REQUEST`
 * literals or a bare requirement id (e.g. `"gaf"`). Parking stays special-cased on
 * `PENDING_PARKING_REQUEST` (not a `documentRequirements` id).
 */
const LEGACY_DOC_TARGET_TO_REQUIREMENT_ID: Record<string, string> = {
  PENDING_GAF: 'gaf',
  PENDING_PET_REQUEST: 'pet',
};

type ResolvedDocTarget = {
  /** Requirement id whose `document_requirement_completions` entry gets written. */
  requirementId: string;
  /** False when the id is not in this property's resolved list (legacy caller fallback). */
  configured: boolean;
};

/**
 * Resolve a doc-completion target to the requirement id to write. Admin clients send
 * the requirement id straight from the stepper (`gaf`, `custom-2`, …); inbound approval webhook
 * still sends the legacy `PENDING_GAF` / `PENDING_PET_REQUEST` literals, matched to a
 * renamed requirement via `pdfTemplateId`. Returns `null` when this property has no
 * matching requirement — callers must throw instead of writing nothing.
 */
function resolveDocTarget(
  target: string,
  requirements: DocumentRequirement[]
): ResolvedDocTarget | null {
  const legacyId = LEGACY_DOC_TARGET_TO_REQUIREMENT_ID[target];
  const normalized = legacyId ?? target;

  if (requirements.some((req) => req.id === normalized)) {
    return { requirementId: normalized, configured: true };
  }
  if (legacyId) {
    const byTemplate = requirements.find((req) => req.pdfTemplateId === legacyId);
    if (byTemplate) return { requirementId: byTemplate.id, configured: true };
  }
  // A property may have renamed or dropped `gaf`/`pet`; keep writing their named
  // columns so inbound approval intake never hard-fails on a legacy literal.
  if (normalized === 'gaf' || normalized === 'pet') {
    return { requirementId: normalized, configured: false };
  }
  return null;
}

/** Requirement id a legacy `PENDING_GAF` / `PENDING_PET_REQUEST` literal writes to. */
function resolveLegacyCompletionId(
  legacyTarget: 'PENDING_GAF' | 'PENDING_PET_REQUEST',
  requirements: DocumentRequirement[]
): string {
  return (
    resolveDocTarget(legacyTarget, requirements)?.requirementId ??
    LEGACY_DOC_TARGET_TO_REQUIREMENT_ID[legacyTarget]
  );
}

/**
 * Same as `resolveDocTarget`, but throws for an unmatched target so a mark-complete
 * call can never report success after writing nothing.
 */
function requireResolvedDocTarget(
  field: 'document_completion_target',
  target: string,
  requirements: DocumentRequirement[]
): ResolvedDocTarget {
  const resolved = resolveDocTarget(target, requirements);
  const configuredIds = requirements.map((req) => req.id).join(', ') || 'none';
  if (!resolved) {
    throw new Error(
      `${field} "${target}" does not match any document requirement for this property (configured: ${configuredIds})`
    );
  }
  if (!resolved.configured) {
    console.warn(
      `[orchestrator] ${field} "${target}" is not in this property's document requirements (${configuredIds}) — writing legacy ${resolved.requirementId} columns only. Set that requirement's pdfTemplateId to "${resolved.requirementId}" so the sub-step tracks it.`
    );
  }
  return resolved;
}

/** Dual-write the legacy named columns for the two requirement ids that still have them. */
function applyLegacyCompletionColumns(
  fields: Record<string, unknown>,
  requirementId: string,
  completedAt: string | null
): void {
  if (requirementId === 'gaf') {
    fields.gaf_completed_at = completedAt;
  } else if (requirementId === 'pet') {
    fields.pet_completed_at = completedAt;
  }
}

function readApprovedPdfUrlForRequirement(
  booking: Record<string, unknown>,
  requirementId: string,
  requirements: DocumentRequirement[]
): string | null {
  const column = approvedPdfColumnForRequirement(requirementId, requirements);
  if (!column) return null;

  const completions = readDocumentCompletions(
    booking as Parameters<typeof readDocumentCompletions>[0]
  );
  const fromMap = completions[requirementId]?.approvedPdfUrl;
  if (typeof fromMap === 'string' && fromMap.trim()) return fromMap.trim();

  const raw = booking[column] as string | null | undefined;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function approvedPdfColumnForRequirement(
  requirementId: string,
  requirements: DocumentRequirement[]
): 'approved_gaf_pdf_url' | 'approved_pet_pdf_url' | null {
  const req = requirements.find((entry) => entry.id === requirementId);
  const kind = requirementDocKind(req, requirementId);
  if (kind === 'gaf') return 'approved_gaf_pdf_url';
  if (kind === 'pet') return 'approved_pet_pdf_url';
  return null;
}

function assertParkingPaymentReceiptIfRequired(
  payload: TransitionPayload,
  booking?: Record<string, unknown>
): void {
  const included = payload.parking_fee_included_in_downpayment !== false;
  if (included) return;
  const receipt =
    typeof payload.parking_payment_receipt_url === 'string'
      ? payload.parking_payment_receipt_url.trim()
      : '';
  if (!receipt) {
    throw new Error('Upload a parking payment receipt before completing parking');
  }
  if (booking && receiptVerdictBlocksAdminTransition(booking.parking_receipt_ai_verdict)) {
    throw new Error(
      'Parking payment receipt failed AI validation. Upload a valid payment screenshot before completing parking.'
    );
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class WorkflowOrchestrator {
  /**
   * Execute a booking status transition with all its side effects.
   *
   * @param bookingId   UUID of the booking to transition.
   * @param toStatus    Target status (validated against canTransition).
   * @param payload     Sub-form data for this transition step.
   * @param devControls Admin checkbox overrides (all default true when omitted).
   * @param manual      Whether this is a manual admin transition (enables override edges).
   */
  static async transition(
    bookingId: string,
    toStatus: BookingStatus,
    payload: TransitionPayload = {},
    devControls: DevControlFlags = {},
    manual = true,
    /**
     * Who initiated this transition — threaded to the activity log. Omit for
     * automated / unattributed callers (degrades to `system`, never crashes).
     * Build it with `buildActorContext(...)` in the calling edge handler.
     */
    actor?: ActorContext
  ): Promise<TransitionResult> {
    console.log(
      `[orchestrator] Transitioning booking ${bookingId} → ${toStatus} (manual=${manual})`
    );

    // 1. Fetch booking
    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const fromStatus = booking.status as BookingStatus;
    const propertyId =
      typeof booking.property_id === 'string' ? booking.property_id.trim() || null : null;

    // ── OTA-ingested bookings (calendar sync Phase 2) ─────────────────────────
    // A row created by calendar-sync-cron from an Airbnb/OTA reservation has dates but
    // no guest contact. Suppress every guest-facing side effect until the guest completes
    // the forwarded guest form (§6.5) — at which point guest_email is populated and the
    // normal flow resumes. `guest_email` blank is the single source of truth (an ingested
    // row always has it blank; `external_source` merely records provenance and is *kept*
    // after completion so emails must not key off it).
    const suppressGuestSideEffects = !String(booking.guest_email ?? '').trim();

    // Notification Center — resolved lazily by the (few) transitions that emit one.
    const resolveNotificationOrgId = async (): Promise<string | null> => {
      if (!propertyId) return null;
      try {
        return await resolveOrganizationIdForProperty(propertyId);
      } catch (err) {
        console.error(
          '[orchestrator] Could not resolve organization for notification (non-fatal):',
          err
        );
        return null;
      }
    };

    // First step after review: either legacy PENDING_GAF or parent PENDING_DOCUMENTS,
    // or (D2) a direct skip to READY_FOR_CHECKIN — all share the same pricing capture
    // and outbound "document request" email bundle (minus GAF/pet when skipped/absent).
    const isReviewProceedAttempt =
      fromStatus === 'PENDING_REVIEW' &&
      (toStatus === 'PENDING_GAF' ||
        toStatus === 'PENDING_DOCUMENTS' ||
        toStatus === 'READY_FOR_CHECKIN');

    // D2: empty configurable document requirements → rewrite the target straight to
    // READY_FOR_CHECKIN so old clients (still sending PENDING_DOCUMENTS) keep working.
    // Also resolved whenever the target is PENDING_DOCUMENTS (even outside a review
    // proceed attempt — e.g. same-status document_completion_target marks, or legacy
    // PENDING_GAF/PENDING_PARKING_REQUEST/PENDING_PET_REQUEST → PENDING_DOCUMENTS edges)
    // so document completion / nested labels always reflect this property's actual list.
    // Doc-completion targets also need the real list: their requirement id is looked
    // up in it (late parking at RFCI+ keeps `toStatus` off PENDING_DOCUMENTS).
    let documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS;
    if (
      isReviewProceedAttempt ||
      toStatus === 'PENDING_DOCUMENTS' ||
      payload.document_completion_target
    ) {
      documentRequirements = propertyId
        ? await resolveDocumentRequirements(propertyId)
        : DEFAULT_DOCUMENT_REQUIREMENTS;
    }
    if (isReviewProceedAttempt) {
      if (documentRequirements.length === 0 && toStatus !== 'READY_FOR_CHECKIN') {
        console.log(
          `[orchestrator] Empty document requirements for property ${propertyId ?? 'unknown'} — rewriting ${toStatus} → READY_FOR_CHECKIN`
        );
        toStatus = 'READY_FOR_CHECKIN';
      } else if (documentRequirements.length > 0 && toStatus === 'READY_FOR_CHECKIN') {
        // Graph gap fix: TRANSITION_GRAPH.PENDING_REVIEW allows READY_FOR_CHECKIN
        // unconditionally (to support the D2 empty-requirements rewrite above and
        // any caller that already resolved reqs itself). Reject an explicit client
        // request to skip PENDING_DOCUMENTS when this property still has pending
        // document requirements — otherwise GAF/pet can be bypassed by sending
        // toStatus=READY_FOR_CHECKIN directly from PENDING_REVIEW.
        throw new Error(
          `Cannot skip to READY_FOR_CHECKIN from PENDING_REVIEW: this property has ${documentRequirements.length} pending document requirement(s). Proceed to PENDING_DOCUMENTS first.`
        );
      }
    }
    const gafPdfRequired = hasApplicableDocumentPdfTemplate(documentRequirements, booking, 'gaf');
    const petPdfRequired = hasApplicableDocumentPdfTemplate(documentRequirements, booking, 'pet');

    // 2. Validate transition (late parking doc actions stay on current status at RFCI+)
    const isLateParkingDocAction = isLatePendingParkingDocumentTransition(
      fromStatus,
      toStatus,
      payload,
      manual
    );
    if (!isLateParkingDocAction && !canTransition(fromStatus, toStatus, { manual })) {
      throw new Error(`Transition ${fromStatus} → ${toStatus} is not allowed (manual=${manual})`);
    }

    // Whether GAF/pet PDF + email side effects should run — false when the
    // requirements list is empty (D2 skip) or the admin skipped straight to
    // READY_FOR_CHECKIN with a non-empty list (explicit override).
    const isReviewToInitialDocs = isReviewProceedAttempt && toStatus !== 'READY_FOR_CHECKIN';

    const wantsSurpriseDecor =
      booking.guest_requests_surprise_decor === true ||
      booking.guest_requests_surprise_decor === 'true';

    if (
      isReviewProceedAttempt &&
      wantsSurpriseDecor &&
      !payload.surprise_decor_staff_acknowledged
    ) {
      throw new Error(
        'Confirm with staff that this guest’s surprise decor (theme and agreed price) is coordinated before proceeding.'
      );
    }

    // 3. Compute derived fields
    const balance = isReviewProceedAttempt
      ? computeBalance(payload.booking_rate, payload.down_payment)
      : null;

    // 4. Build workflow fields to persist in DB
    const workflowFields: Record<string, unknown> = {};

    if (isReviewProceedAttempt) {
      // Strip any stale workflow data from a prior cycle so nested substeps and
      // pricing/parking forms do not read as “complete” before admins re-enter them.
      Object.assign(workflowFields, pendingDocumentsClearPatchForGuestEditRevert());
      if (payload.booking_rate != null) workflowFields.booking_rate = payload.booking_rate;
      if (payload.down_payment != null) workflowFields.down_payment = payload.down_payment;
      if (balance != null) workflowFields.balance = balance;
      if (payload.security_deposit != null)
        workflowFields.security_deposit = payload.security_deposit;
      if (payload.pet_fee != null && bookingFlagTrue(booking.has_pets)) {
        workflowFields.pet_fee = payload.pet_fee;
      } else if (!bookingFlagTrue(booking.has_pets)) {
        workflowFields.pet_fee = null;
      }
      if (payload.parking_rate_guest != null && bookingFlagTrue(booking.need_parking)) {
        workflowFields.parking_rate_guest = payload.parking_rate_guest;
      } else if (!bookingFlagTrue(booking.need_parking)) {
        workflowFields.parking_rate_guest = null;
      }
      if (payload.guest_additional_fee != null) {
        workflowFields.guest_additional_fee = payload.guest_additional_fee;
      }
      if (
        booking.applied_voucher_code &&
        payload.applied_voucher_discount_php != null &&
        Number.isFinite(Number(payload.applied_voucher_discount_php))
      ) {
        workflowFields.applied_voucher_discount_php = Number(payload.applied_voucher_discount_php);
      }
      if (wantsSurpriseDecor && payload.surprise_decor_staff_acknowledged) {
        workflowFields.surprise_decor_staff_acknowledged = true;
      }
    }

    // D1: dual-write completion state — JSONB map is the forward-looking source of
    // truth, named gaf_*/pet_* columns stay in sync during cutover. Base off the
    // dual-read map (which already falls back to named columns) so a merge here
    // never drops an entry that only exists in one representation.
    const completionsMap: DocumentCompletionsMap = readDocumentCompletions(
      booking as Parameters<typeof readDocumentCompletions>[0]
    );
    let completionsChanged = false;
    function patchCompletion(id: string, patch: Partial<DocumentRequirementCompletion>): void {
      const prev: DocumentRequirementCompletion = completionsMap[id] ?? {
        completedAt: null,
        approvedPdfUrl: null,
      };
      completionsMap[id] = { ...prev, ...patch };
      completionsChanged = true;
    }

    if (isReviewProceedAttempt) {
      // Mirror pendingDocumentsClearPatchForGuestEditRevert()'s named-column reset in
      // the JSONB map so dual-read doesn't show a substep "done" from a prior cycle —
      // every id, not just gaf/pet, or a renamed requirement keeps last cycle's tick.
      const idsToReset = new Set([
        ...Object.keys(completionsMap),
        ...documentRequirements.map((req) => req.id),
      ]);
      for (const id of idsToReset) {
        patchCompletion(id, { completedAt: null, approvedPdfUrl: null });
      }
    }

    // Approved GAF: Gmail listener uses PENDING_DOCUMENTS → PENDING_DOCUMENTS; forward
    // transitions (→ parking / pet / ready) also carry the URL from the prior step.
    if (payload.approved_gaf_pdf_url) {
      if (
        toStatus === 'PENDING_DOCUMENTS' ||
        toStatus === 'PENDING_PARKING_REQUEST' ||
        toStatus === 'PENDING_PET_REQUEST' ||
        toStatus === 'READY_FOR_CHECKIN'
      ) {
        workflowFields.approved_gaf_pdf_url = payload.approved_gaf_pdf_url;
        // The map entry follows this property's GAF requirement id, which may be a
        // renamed one (matched on pdfTemplateId) rather than a literal `gaf`.
        patchCompletion(resolveLegacyCompletionId('PENDING_GAF', documentRequirements), {
          approvedPdfUrl: payload.approved_gaf_pdf_url,
        });
      }
    }

    // Approved pet PDF: same listener pattern on PENDING_DOCUMENTS, or pet → ready.
    if (payload.approved_pet_pdf_url) {
      if (
        toStatus === 'PENDING_DOCUMENTS' ||
        (toStatus === 'READY_FOR_CHECKIN' && fromStatus === 'PENDING_PET_REQUEST')
      ) {
        workflowFields.approved_pet_pdf_url = payload.approved_pet_pdf_url;
        patchCompletion(resolveLegacyCompletionId('PENDING_PET_REQUEST', documentRequirements), {
          approvedPdfUrl: payload.approved_pet_pdf_url,
        });
      }
    }

    const docComplete = payload.document_completion_target;

    // Admin "Mark … as complete" under Pending Documents (no PDF): persist *_completed_at.
    // Parking may also be completed late at RFCI+ without changing parent status.
    if (docComplete) {
      const now = new Date().toISOString();
      const lateParkingComplete =
        manual &&
        fromStatus === toStatus &&
        isPostPendingDocumentsStatus(fromStatus) &&
        docComplete === 'PENDING_PARKING_REQUEST';

      if (docComplete === 'PENDING_PARKING_REQUEST' && manual) {
        assertParkingPaymentReceiptIfRequired(payload, booking as Record<string, unknown>);
      }

      if (fromStatus === 'PENDING_DOCUMENTS' && toStatus === 'PENDING_DOCUMENTS') {
        if (docComplete === 'PENDING_PARKING_REQUEST') {
          workflowFields.parking_completed_at = now;
        } else {
          const resolved = requireResolvedDocTarget(
            'document_completion_target',
            docComplete,
            documentRequirements
          );
          const approvedColumn = approvedPdfColumnForRequirement(
            resolved.requirementId,
            documentRequirements
          );
          const approvedUrl = approvedColumn
            ? readApprovedPdfUrlForRequirement(
                booking as Record<string, unknown>,
                resolved.requirementId,
                documentRequirements
              )
            : null;
          if (approvedColumn && !approvedUrl) {
            throw new Error(
              'Upload or receive the approved document before marking this step complete.'
            );
          }
          patchCompletion(resolved.requirementId, {
            completedAt: now,
            ...(approvedUrl ? { approvedPdfUrl: approvedUrl } : {}),
          });
          if (approvedColumn && approvedUrl) {
            workflowFields[approvedColumn] = approvedUrl;
          }
          applyLegacyCompletionColumns(workflowFields, resolved.requirementId, now);
        }
      } else if (lateParkingComplete) {
        workflowFields.parking_completed_at = now;
      }
    }

    if (
      fromStatus === 'PENDING_PARKING_REQUEST' ||
      (docComplete === 'PENDING_PARKING_REQUEST' && manual)
    ) {
      if (fromStatus === 'PENDING_PARKING_REQUEST') {
        assertParkingPaymentReceiptIfRequired(payload, booking as Record<string, unknown>);
      }
      if (payload.parking_rate_paid != null)
        workflowFields.parking_rate_paid = payload.parking_rate_paid;
      if (payload.parking_owner_email)
        workflowFields.parking_owner_email = payload.parking_owner_email;
      if (payload.parking_owner !== undefined) {
        const po = typeof payload.parking_owner === 'string' ? payload.parking_owner.trim() : '';
        workflowFields.parking_owner = po || null;
      }
      if (payload.parking_endorsement_url) {
        workflowFields.parking_endorsement_url = payload.parking_endorsement_url;
      }
      if (payload.parking_fee_included_in_downpayment !== undefined) {
        workflowFields.parking_fee_included_in_downpayment =
          payload.parking_fee_included_in_downpayment !== false;
        if (payload.parking_fee_included_in_downpayment !== false) {
          workflowFields.parking_payment_receipt_url = null;
          workflowFields.parking_receipt_ai_verdict = null;
          workflowFields.parking_receipt_ai_summary = null;
        }
      }
      if (payload.parking_payment_receipt_url !== undefined) {
        const receipt =
          typeof payload.parking_payment_receipt_url === 'string'
            ? payload.parking_payment_receipt_url.trim()
            : '';
        workflowFields.parking_payment_receipt_url = receipt || null;
      }
    }

    // Guest /sd-form submit includes sd_refund_method; admin "skip details" advance omits it.
    if (
      fromStatus === 'READY_FOR_CHECKOUT' &&
      toStatus === 'PENDING_SD_REFUND' &&
      payload.sd_refund_method != null
    ) {
      workflowFields.sd_refund_guest_feedback = payload.sd_refund_guest_feedback ?? null;
      workflowFields.sd_refund_method = payload.sd_refund_method;
      workflowFields.sd_refund_phone_confirmed = payload.sd_refund_phone_confirmed ?? null;
      workflowFields.sd_refund_bank = payload.sd_refund_bank ?? null;
      workflowFields.sd_refund_account_name = payload.sd_refund_account_name ?? null;
      workflowFields.sd_refund_account_number = payload.sd_refund_account_number ?? null;
      workflowFields.sd_refund_form_submitted_at = new Date().toISOString();
    }

    if (toStatus === 'COMPLETED') {
      if (payload.sd_additional_expenses != null)
        workflowFields.sd_additional_expenses = payload.sd_additional_expenses;
      if (payload.sd_additional_profits != null)
        workflowFields.sd_additional_profits = payload.sd_additional_profits;
      if (payload.sd_additional_expense_items != null) {
        workflowFields.sd_additional_expense_items = payload.sd_additional_expense_items;
      }
      if (payload.sd_additional_profit_items != null) {
        workflowFields.sd_additional_profit_items = payload.sd_additional_profit_items;
      }
      if (payload.sd_refund_amount != null)
        workflowFields.sd_refund_amount = payload.sd_refund_amount;
      if (payload.sd_refund_receipt_url)
        workflowFields.sd_refund_receipt_url = payload.sd_refund_receipt_url;
      workflowFields.settled_at = new Date().toISOString();
    }

    // READY_FOR_CHECKIN → READY_FOR_CHECKOUT: paid = total; receipt required only when total > 0.
    if (fromStatus === 'READY_FOR_CHECKIN' && toStatus === 'READY_FOR_CHECKOUT') {
      const settlement = checkGuestBalanceSettlement(booking as Record<string, unknown>, {
        paidAmount: payload.guest_balance_paid_amount,
        receiptUrl: payload.guest_balance_payment_receipt_url,
      });
      if (!settlement.ok) {
        const messages: Record<string, string> = {
          missing_total_guest_balance:
            'Total guest balance cannot be computed. Complete pricing (booking rate and related fields) before this step.',
          missing_guest_balance_paid_amount: 'guest_balance_paid_amount is required',
          invalid_guest_balance_paid_amount:
            'guest_balance_paid_amount must be a valid non-negative number',
          guest_balance_paid_exceeds_balance: 'Amount paid cannot exceed total guest balance',
          guest_balance_not_fully_paid:
            'Amount paid must equal total guest balance before advancing to ready for check-out',
          missing_guest_balance_payment_receipt: 'guest_balance_payment_receipt_url is required',
        };
        throw new Error(messages[settlement.reason] ?? settlement.reason);
      }
      workflowFields.guest_balance_paid_amount = settlement.paidAmount;
      workflowFields.guest_balance_payment_receipt_url = settlement.receiptUrl;

      const totalDue = computeTotalGuestBalanceFromBooking(booking as Record<string, unknown>);
      if (
        totalDue !== null &&
        guestBalancePaymentReceiptRequired(totalDue) &&
        settlement.receiptUrl &&
        receiptVerdictBlocksAdminTransition(booking.balance_receipt_ai_verdict)
      ) {
        throw new Error(
          'Balance payment receipt failed AI validation. Upload a valid payment screenshot before advancing.'
        );
      }
    }

    if (completionsChanged) {
      workflowFields.document_requirement_completions = completionsMap;
    }

    // 5. Persist workflow fields + update status
    if (flag(devControls, 'saveToDatabase')) {
      if (Object.keys(workflowFields).length > 0) {
        await DatabaseService.setWorkflowFields(bookingId, workflowFields);
      }
      if (fromStatus !== toStatus) {
        await DatabaseService.updateBookingStatus(bookingId, toStatus, fromStatus);
      }
    }

    // Re-fetch to get latest row (needed for email content)
    const persistedStatus = fromStatus !== toStatus ? toStatus : fromStatus;
    let updatedBooking = (await DatabaseService.getBookingById(bookingId)) ?? {
      ...booking,
      status: persistedStatus,
    };

    // ── Auto-advance: PENDING_DOCUMENTS → READY_FOR_CHECKIN ──────────────────
    // When a sub-step is marked complete (document_completion_target) and every
    // required sub-step (GAF + parking if needed + pet if needed) is now done,
    // immediately advance to READY_FOR_CHECKIN instead of leaving the booking
    // stranded in PENDING_DOCUMENTS waiting for a manual "Proceed" click.
    // This fires for every caller (approval-email-webhook, admin parking form,
    // reconciliation) since they all route through the orchestrator.
    if (
      fromStatus === 'PENDING_DOCUMENTS' &&
      toStatus === 'PENDING_DOCUMENTS' &&
      docComplete &&
      flag(devControls, 'saveToDatabase')
    ) {
      const autoAdvanceRequirements = propertyId
        ? await resolveDocumentRequirements(propertyId)
        : DEFAULT_DOCUMENT_REQUIREMENTS;
      const { allConfigurableDocsDone, parkingDone } = getPendingDocumentsNestedCompletion(
        updatedBooking as Parameters<typeof getPendingDocumentsNestedCompletion>[0],
        autoAdvanceRequirements
      );
      if (allConfigurableDocsDone && parkingDone) {
        console.log(
          `[orchestrator] All document sub-steps complete for ${bookingId} — auto-advancing to READY_FOR_CHECKIN`
        );
        try {
          // Recursive call: preserve caller email flags but always send
          // the ready-for-check-in email (automated behaviour, not a manual click).
          return await WorkflowOrchestrator.transition(
            bookingId,
            'READY_FOR_CHECKIN',
            {},
            { ...devControls, sendReadyForCheckinEmail: true },
            false, // automated — not a manual admin click
            actor // preserve attribution across the auto-advance
          );
        } catch (err) {
          // Non-fatal: log and fall through so the caller still gets a valid
          // PENDING_DOCUMENTS result. Admin can advance manually.
          console.error(
            '[orchestrator] Auto-advance to READY_FOR_CHECKIN failed (non-fatal):',
            err
          );
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    let gafPdfBuffer: Uint8Array | null = null;
    let petPdfBuffer: Uint8Array | null = null;
    // Skipped entirely when requirements are empty (D2) or the admin skipped straight
    // to READY_FOR_CHECKIN; gated per-requirement so a property without "gaf" (or "pet")
    // never gets that PDF even when the other one is configured.
    const missingGafRequestPdf =
      gafPdfRequired && !String(updatedBooking.gaf_request_pdf_url ?? '').trim();
    const missingPetRequestPdf =
      petPdfRequired &&
      bookingFlagTrue(updatedBooking.has_pets) &&
      !String(updatedBooking.pet_request_pdf_url ?? '').trim();
    const shouldGenerateGafRequestPdf =
      gafPdfRequired && (isReviewToInitialDocs || missingGafRequestPdf);
    const shouldGeneratePetRequestPdf =
      petPdfRequired && (isReviewToInitialDocs || missingPetRequestPdf);
    const shouldGenerateRequestPdfs =
      flag(devControls, 'generatePdf') &&
      (isReviewToInitialDocs ||
        (updatedBooking.status === 'PENDING_DOCUMENTS' &&
          (missingGafRequestPdf || missingPetRequestPdf)));

    if (shouldGenerateRequestPdfs) {
      const fd = buildGuestFormData(updatedBooking);
      // GAF and pet PDFs are independent — generate them concurrently instead of
      // sequentially (each keeps its own descriptive error message on failure).
      const [gafResult, petResult] = await Promise.all([
        shouldGenerateGafRequestPdf
          ? generatePDF(fd, propertyId).catch((err) => {
              console.error('[orchestrator] GAF PDF generation failed:', err);
              throw new Error(
                `GAF request PDF could not be generated. Ensure templates/guest-form-template.pdf exists in Storage. ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            })
          : Promise.resolve(null),
        shouldGeneratePetRequestPdf
          ? generatePetPDF(fd, propertyId).catch((err) => {
              console.error('[orchestrator] Pet request PDF generation failed:', err);
              throw new Error(
                `Pet request PDF could not be generated. Ensure templates/pet-form-template.pdf exists in Storage. ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            })
          : Promise.resolve(null),
      ]);
      gafPdfBuffer = gafResult;
      petPdfBuffer = petResult;

      if (flag(devControls, 'saveToDatabase')) {
        const pdfPropertyId = String(updatedBooking.property_id ?? '').trim() || undefined;
        if (shouldGenerateGafRequestPdf && !gafPdfBuffer) {
          throw new Error('GAF request PDF buffer is empty after generation.');
        }
        if (shouldGeneratePetRequestPdf && !petPdfBuffer) {
          throw new Error('Pet request PDF buffer is empty after generation.');
        }
        // Independent uploads to different buckets — also safe to run concurrently.
        const [gafUrl, petUrl] = await Promise.all([
          shouldGenerateGafRequestPdf
            ? UploadService.uploadPdfBytes(
                'approved-gafs',
                bookingAssetStorageKey(pdfPropertyId, bookingId, 'gaf-request.pdf'),
                gafPdfBuffer!
              )
            : Promise.resolve(null),
          shouldGeneratePetRequestPdf
            ? UploadService.uploadPdfBytes(
                'approved-pet-forms',
                bookingAssetStorageKey(pdfPropertyId, bookingId, 'pet-request.pdf'),
                petPdfBuffer!
              )
            : Promise.resolve(null),
        ]);

        const pdfFields: Record<string, unknown> = {};
        if (gafUrl) pdfFields.gaf_request_pdf_url = gafUrl;
        if (petUrl) pdfFields.pet_request_pdf_url = petUrl;
        if (Object.keys(pdfFields).length > 0) {
          await DatabaseService.setWorkflowFields(bookingId, pdfFields);
          Object.assign(updatedBooking, pdfFields);
        }
      }
    }

    // 8. Emails — based on side-effect matrix in booking-workflow.mdc §3
    const emailsSent: string[] = [];
    const automationSkippedByPlan: string[] = [];
    const automationSkippedByHost: string[] = [];
    let externalSuppressed = false;
    if (suppressGuestSideEffects) {
      console.log(
        `[orchestrator] Guest-facing side effects suppressed for ${bookingId} (OTA-ingested booking, no guest contact yet)`
      );
    }

    const propertyEmailAllowed = async (key: PropertyAutomationToggleKey): Promise<boolean> =>
      propertyAutomationEnabled(propertyId, key);
    const planBlockedKeys = new Set(await planBlockedAutomationToggleKeys(propertyId));
    const recordIfEmailSkipped = (key: PropertyAutomationToggleKey, sideEffectName: string) => {
      if (planBlockedKeys.has(key)) automationSkippedByPlan.push(sideEffectName);
      else automationSkippedByHost.push(sideEffectName);
    };

    // PENDING_REVIEW → PENDING_GAF | PENDING_DOCUMENTS | READY_FOR_CHECKIN (D2 skip), same bundle:
    // - GAF request to Azure (only when "gaf" is in the resolved requirements)
    // - Booking acknowledgement to guest (always)
    // - Pet request to Azure (only when has_pets AND "pet" is in the resolved requirements)
    if (isReviewProceedAttempt) {
      const formData = buildGuestFormData(updatedBooking);

      if (
        isReviewToInitialDocs &&
        gafPdfRequired &&
        flag(devControls, 'sendGafRequestEmail') &&
        (await propertyEmailAllowed('emailGafRequest'))
      ) {
        try {
          await sendEmail(formData, gafPdfBuffer, false, updatedBooking);
          emailsSent.push('gaf_request');
        } catch (err) {
          console.error('[orchestrator] GAF request email failed:', err);
        }
      } else if (
        isReviewToInitialDocs &&
        gafPdfRequired &&
        flag(devControls, 'sendGafRequestEmail')
      ) {
        console.log('[orchestrator] GAF request email skipped (org automation off)');
        recordIfEmailSkipped('emailGafRequest', 'gaf_request');
      }

      if (suppressGuestSideEffects && flag(devControls, 'sendBookingAcknowledgementEmail')) {
        externalSuppressed = true;
        console.log(
          '[orchestrator] Booking acknowledgement email skipped (OTA-ingested, no guest)'
        );
      } else if (
        flag(devControls, 'sendBookingAcknowledgementEmail') &&
        (await propertyEmailAllowed('emailBookingAcknowledgement'))
      ) {
        try {
          await sendBookingAcknowledgement(updatedBooking);
          emailsSent.push('booking_acknowledgement');
        } catch (err) {
          console.error('[orchestrator] Booking acknowledgement email failed:', err);
        }
      } else if (flag(devControls, 'sendBookingAcknowledgementEmail')) {
        console.log('[orchestrator] Booking acknowledgement email skipped (org automation off)');
        recordIfEmailSkipped('emailBookingAcknowledgement', 'booking_acknowledgement');
      }

      if (
        isReviewToInitialDocs &&
        updatedBooking.has_pets &&
        petPdfRequired &&
        flag(devControls, 'sendPetRequestEmail') &&
        (await propertyEmailAllowed('emailPetRequest'))
      ) {
        try {
          await sendPetEmail(
            formData,
            petPdfBuffer,
            updatedBooking.pet_image_url,
            updatedBooking.pet_vaccination_url,
            false,
            updatedBooking.property_id
          );
          emailsSent.push('pet_request');
        } catch (err) {
          console.error('[orchestrator] Pet request email failed:', err);
        }
      } else if (
        isReviewToInitialDocs &&
        updatedBooking.has_pets &&
        petPdfRequired &&
        flag(devControls, 'sendPetRequestEmail')
      ) {
        console.log('[orchestrator] Pet request email skipped (org automation off)');
        recordIfEmailSkipped('emailPetRequest', 'pet_request');
      }

      // Phase 7: retired — property bookings no longer send legacy BCC parking-owner emails.
      // Hosts use Find parking / marketplace linkStay; marketplace host fan-out is separate.
    }

    // Issue stay-guide token whenever booking reaches READY_FOR_CHECKIN.
    if (toStatus === 'READY_FOR_CHECKIN' && suppressGuestSideEffects) {
      externalSuppressed = true;
      console.log('[orchestrator] Stay-guide token skipped (OTA-ingested, no guest)');
    } else if (toStatus === 'READY_FOR_CHECKIN') {
      try {
        await ensureGuestStayGuideToken(updatedBooking);
        const refreshed = await DatabaseService.getBookingById(bookingId);
        if (refreshed) updatedBooking = refreshed;
      } catch (err) {
        console.error('[orchestrator] Stay guide token failed (non-fatal):', err);
      }
    }

    // forward → READY_FOR_CHECKIN: send ready-for-check-in to guest.
    // PENDING_REVIEW is included for the D2 empty-requirements skip (and explicit
    // admin skip) — the only way that specific edge fires.
    const isForwardToReady =
      fromStatus === 'PENDING_REVIEW' ||
      fromStatus === 'PENDING_DOCUMENTS' ||
      fromStatus === 'PENDING_GAF' ||
      fromStatus === 'PENDING_PARKING_REQUEST' ||
      fromStatus === 'PENDING_PET_REQUEST';
    if (
      toStatus === 'READY_FOR_CHECKIN' &&
      isForwardToReady &&
      suppressGuestSideEffects &&
      flag(devControls, 'sendReadyForCheckinEmail')
    ) {
      externalSuppressed = true;
      console.log('[orchestrator] Ready-for-check-in email skipped (OTA-ingested, no guest)');
    } else if (
      toStatus === 'READY_FOR_CHECKIN' &&
      isForwardToReady &&
      flag(devControls, 'sendReadyForCheckinEmail') &&
      (await propertyEmailAllowed('emailReadyForCheckin'))
    ) {
      try {
        await sendReadyForCheckin(updatedBooking);
        emailsSent.push('ready_for_checkin');
      } catch (err) {
        console.error('[orchestrator] Ready-for-check-in email failed:', err);
      }
    } else if (
      toStatus === 'READY_FOR_CHECKIN' &&
      isForwardToReady &&
      flag(devControls, 'sendReadyForCheckinEmail')
    ) {
      console.log('[orchestrator] Ready-for-check-in email skipped (org automation off)');
      recordIfEmailSkipped('emailReadyForCheckin', 'ready_for_checkin');
    }

    const sdAmount = Number(updatedBooking.security_deposit ?? 0);
    if (
      fromStatus === 'READY_FOR_CHECKIN' &&
      toStatus === 'READY_FOR_CHECKOUT' &&
      suppressGuestSideEffects &&
      flag(devControls, 'sendSdRefundFormEmail') &&
      sdAmount > 0
    ) {
      externalSuppressed = true;
      console.log('[orchestrator] SD refund form email skipped (OTA-ingested, no guest)');
    } else if (
      fromStatus === 'READY_FOR_CHECKIN' &&
      toStatus === 'READY_FOR_CHECKOUT' &&
      flag(devControls, 'sendSdRefundFormEmail') &&
      sdAmount > 0 &&
      (await propertyEmailAllowed('emailSdRefundCheckout'))
    ) {
      const emailedRaw = (updatedBooking as { sd_refund_form_emailed_at?: string | null })
        .sd_refund_form_emailed_at;
      const alreadyEmailed = typeof emailedRaw === 'string' && emailedRaw.trim() !== '';
      if (alreadyEmailed) {
        console.log(
          '[orchestrator] Check-out instructions email skipped (already sent for this stay)'
        );
      } else {
        try {
          await sendSdRefundFormRequest(updatedBooking);
          emailsSent.push('sd_refund_form_request');
          if (flag(devControls, 'saveToDatabase')) {
            await DatabaseService.setWorkflowFields(bookingId, {
              sd_refund_form_emailed_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error('[orchestrator] SD refund form request email failed:', err);
        }
      }
    } else if (
      fromStatus === 'READY_FOR_CHECKIN' &&
      toStatus === 'READY_FOR_CHECKOUT' &&
      flag(devControls, 'sendSdRefundFormEmail') &&
      sdAmount > 0
    ) {
      console.log('[orchestrator] SD refund form email skipped (org automation off)');
      recordIfEmailSkipped('emailSdRefundCheckout', 'sd_refund_form_request');
    }

    // Notification Center — status transitions; not gated on workflow email sends so Free
    // hosts still get bell alerts when emails are plan-skipped (manual send via Automation Triggers).
    if (toStatus === 'READY_FOR_CHECKIN' && isForwardToReady && !suppressGuestSideEffects) {
      const organizationId = await resolveNotificationOrgId();
      if (organizationId) {
        await createNotification({
          organizationId,
          propertyId,
          type: 'booking_ready_for_checkin',
          title: STATUS_HUMAN_LABEL.READY_FOR_CHECKIN,
          body: `${updatedBooking.primary_guest_name ?? 'A guest'}'s booking is ready for check-in.`,
          bookingId,
          metadata: bookingNotificationMetadata(updatedBooking),
          dedupeKey: `${bookingId}:${toStatus}`,
        });
      }
    }

    if (
      fromStatus === 'READY_FOR_CHECKIN' &&
      toStatus === 'READY_FOR_CHECKOUT' &&
      sdAmount > 0 &&
      !suppressGuestSideEffects
    ) {
      const organizationId = await resolveNotificationOrgId();
      if (organizationId) {
        await createNotification({
          organizationId,
          propertyId,
          type: 'booking_ready_for_checkout',
          title: STATUS_HUMAN_LABEL.READY_FOR_CHECKOUT,
          body: `${updatedBooking.primary_guest_name ?? 'A guest'}'s booking is ready for check-out.`,
          bookingId,
          metadata: bookingNotificationMetadata(updatedBooking),
          dedupeKey: `${bookingId}:${toStatus}`,
        });
      }
    }

    if (
      fromStatus === 'READY_FOR_CHECKOUT' &&
      toStatus === 'PENDING_SD_REFUND' &&
      payload.sd_refund_method != null
    ) {
      const organizationId = await resolveNotificationOrgId();
      if (organizationId) {
        await createNotification({
          organizationId,
          propertyId,
          type: 'booking_sd_refund_due',
          title: STATUS_HUMAN_LABEL.PENDING_SD_REFUND,
          body: `${updatedBooking.primary_guest_name ?? 'A guest'} submitted their SD refund details.`,
          bookingId,
          metadata: bookingNotificationMetadata(updatedBooking),
          dedupeKey: `${bookingId}:${toStatus}`,
        });
      }
    }

    console.log(`[orchestrator] Transition complete: ${fromStatus} → ${toStatus}`, {
      emailsSent,
    });

    if (flag(devControls, 'saveToDatabase')) {
      const refreshedFinal = await DatabaseService.getBookingById(bookingId);
      if (refreshedFinal) updatedBooking = refreshedFinal;
    }

    // ── Activity log — one row per transition, emitted here so every caller
    //    (dashboard, cron, webhook, guest form, AI assistant) is covered once.
    if (flag(devControls, 'saveToDatabase')) {
      await this.logTransitionActivity({
        booking: updatedBooking,
        propertyId,
        fromStatus,
        toStatus: String(updatedBooking.status ?? toStatus) as BookingStatus,
        completionTarget: payload.document_completion_target ?? null,
        completionsChanged,
        manual,
        actor,
        resolveOrgId: resolveNotificationOrgId,
      });
      await this.logTransitionPostHog({
        booking: updatedBooking,
        propertyId,
        fromStatus,
        toStatus: String(updatedBooking.status ?? toStatus) as BookingStatus,
        completionTarget: payload.document_completion_target ?? null,
        completionsChanged,
        manual,
        actor,
      });
    }

    return {
      success: true,
      booking: updatedBooking,
      sideEffects: {
        emails: emailsSent,
        automationSkippedByPlan,
        automationSkippedByHost,
        ...(externalSuppressed ? { externalSuppressed: true } : {}),
      },
    };
  }

  /**
   * Emit the single activity-log row for a completed transition. Never throws
   * (logActivity swallows) and never blocks — a logging gap must not fail a
   * booking transition.
   */
  private static mapActorTypeForAnalytics(actor?: ActorContext): string {
    const t: ActivityActorType = actor?.actorType ?? 'system';
    if (t === 'guest' || t === 'public') return 'guest';
    if (t === 'cron') return 'cron';
    if (t === 'webhook' || t === 'email_inbound') return 'webhook';
    if (t === 'ai_assistant') return 'ai_assistant';
    if (t === 'team_member' || t === 'super_admin') return 'host';
    return 'system';
  }

  private static async logTransitionPostHog(args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    booking: any;
    propertyId: string | null;
    fromStatus: BookingStatus;
    toStatus: BookingStatus;
    completionTarget: string | null;
    completionsChanged: boolean;
    manual: boolean;
    actor?: ActorContext;
  }): Promise<void> {
    try {
      const statusChanged = args.fromStatus !== args.toStatus;
      const isDocSubstep = !statusChanged && (args.completionsChanged || !!args.completionTarget);
      if (!statusChanged && !isDocSubstep) return;

      const actorType = this.mapActorTypeForAnalytics(args.actor);
      const baseProps = {
        property_id: args.propertyId ?? undefined,
        from_status: args.fromStatus,
        to_status: args.toStatus,
        actor_type: actorType,
        manual: args.manual,
      };

      if (isDocSubstep) {
        await capturePostHogEvent('booking_document_step_completed', {
          logPrefix: 'orchestrator',
          system: true,
          properties: {
            ...baseProps,
            document_step: args.completionTarget ?? 'unknown',
          },
        });
        return;
      }

      if (args.toStatus === 'CANCELLED') {
        await capturePostHogEvent('booking_cancelled', {
          logPrefix: 'orchestrator',
          system: true,
          properties: {
            ...baseProps,
            previous_status: args.fromStatus,
          },
        });
        return;
      }

      await capturePostHogEvent('booking_workflow_transitioned', {
        logPrefix: 'orchestrator',
        system: true,
        properties: baseProps,
      });
    } catch (err) {
      console.error('[orchestrator] logTransitionPostHog failed (non-fatal):', err);
    }
  }

  private static async logTransitionActivity(args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    booking: any;
    propertyId: string | null;
    fromStatus: BookingStatus;
    toStatus: BookingStatus;
    completionTarget: string | null;
    completionsChanged: boolean;
    manual: boolean;
    actor?: ActorContext;
    resolveOrgId: () => Promise<string | null>;
  }): Promise<void> {
    try {
      const { booking, propertyId, fromStatus, toStatus } = args;
      const statusChanged = fromStatus !== toStatus;
      const isDocSubstep = !statusChanged && (args.completionsChanged || !!args.completionTarget);
      if (!statusChanged && !isDocSubstep) return; // pure no-op

      const organizationId = await args.resolveOrgId();
      if (!organizationId) return;

      const actor: ActorContext = args.actor ?? { actorType: 'system', source: 'cron' };
      const guestName =
        (typeof booking.primary_guest_name === 'string' && booking.primary_guest_name.trim()) ||
        (typeof booking.guest_facebook_name === 'string' && booking.guest_facebook_name.trim()) ||
        null;
      const checkIn = typeof booking.check_in_date === 'string' ? booking.check_in_date : null;
      const targetLabel = guestName ? `${guestName}${checkIn ? ` · ${checkIn}` : ''}` : 'a booking';

      const action = isDocSubstep
        ? 'booking.document_substep_completed'
        : toStatus === 'CANCELLED'
          ? 'booking.cancelled'
          : 'booking.status_changed';

      await logActivity({
        action,
        organizationId,
        propertyId: propertyId ?? undefined,
        actor,
        targetType: 'booking',
        targetId: String(booking.id ?? ''),
        targetLabel,
        metadata: {
          from_status: fromStatus,
          to_status: toStatus,
          manual: args.manual,
          ...(isDocSubstep && args.completionTarget ? { requirement: args.completionTarget } : {}),
        },
      });
    } catch (err) {
      console.error('[orchestrator] logTransitionActivity failed (non-fatal):', err);
    }
  }
}

// ─── Helper: build GuestFormData shape for legacy email functions ─────────────

function buildGuestFormData(booking: any): any {
  return {
    guestFacebookName: booking.guest_facebook_name,
    primaryGuestName: booking.primary_guest_name,
    primaryGuestAge: booking.primary_guest_age,
    guestEmail: booking.guest_email,
    guestPhoneNumber: booking.guest_phone_number,
    guestAddress: booking.guest_address,
    checkInDate: booking.check_in_date,
    checkOutDate: booking.check_out_date,
    checkInTime: booking.check_in_time,
    checkOutTime: booking.check_out_time,
    nationality: booking.nationality,
    numberOfAdults: booking.number_of_adults,
    numberOfChildren: booking.number_of_children,
    numberOfNights: booking.number_of_nights,
    guest2Name: booking.guest2_name,
    guest2Age: booking.guest2_age,
    guest3Name: booking.guest3_name,
    guest3Age: booking.guest3_age,
    guest4Name: booking.guest4_name,
    guest4Age: booking.guest4_age,
    guest5Name: booking.guest5_name,
    guest5Age: booking.guest5_age,
    guestSpecialRequests: booking.guest_special_requests,
    findUs: booking.find_us,
    findUsDetails: booking.find_us_details,
    bookingSource: booking.booking_source || 'Facebook',
    needParking: booking.need_parking,
    carPlateNumber: booking.car_plate_number,
    carBrandModel: booking.car_brand_model,
    carColor: booking.car_color,
    hasPets: booking.has_pets,
    petName: booking.pet_name,
    petType: booking.pet_type,
    petBreed: booking.pet_breed,
    petAge: booking.pet_age,
    petVaccinationDate: booking.pet_vaccination_date,
    petVaccinationUrl: booking.pet_vaccination_url,
    petImageUrl: booking.pet_image_url,
    paymentReceiptUrl: booking.payment_receipt_url,
    validIdUrl: booking.valid_id_url,
    guest2ValidIdUrl: booking.guest2_valid_id_url,
    guest3ValidIdUrl: booking.guest3_valid_id_url,
    guest4ValidIdUrl: booking.guest4_valid_id_url,
    guest5ValidIdUrl: booking.guest5_valid_id_url,
    unitOwner: booking.unit_owner,
    towerAndUnitNumber: booking.tower_and_unit_number,
    ownerOnsiteContactPerson: booking.owner_onsite_contact_person,
    ownerContactNumber: booking.owner_contact_number,
  };
}

function bookingFlagTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

/** @internal Exported for Deno unit tests only — do not import from production handlers. */
export const __workflowOrchestratorTesting = {
  computeBalance,
  flag,
  resolveDocTarget,
  resolveLegacyCompletionId,
  assertParkingPaymentReceiptIfRequired,
};
