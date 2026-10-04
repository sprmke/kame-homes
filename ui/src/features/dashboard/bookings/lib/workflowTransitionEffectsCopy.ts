import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  requirementApplies,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  DEFAULT_PROPERTY_AUTOMATION_TOGGLES,
  type PropertyAutomationToggles,
} from '@/features/dashboard/org/lib/propertyEmailAutomation';

/** Mirrors `DevControlFlags` email keys in `_shared/workflowOrchestrator.ts`. */
export type WorkflowEmailDevControlKey =
  | 'sendGafRequestEmail'
  | 'sendBookingAcknowledgementEmail'
  | 'sendPetRequestEmail'
  | 'sendReadyForCheckinEmail'
  | 'sendSdRefundFormEmail';

export type WorkflowEmailEffect = {
  key: WorkflowEmailDevControlKey;
  /** Host-facing checkbox label (matches former effect-line copy). */
  label: string;
};

export type WorkflowTransitionEffectsInput = {
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  direction: 'forward' | 'back';
  booking: Pick<
    BookingRow,
    'has_pets' | 'need_parking' | 'security_deposit' | 'sd_refund_form_emailed_at'
  >;
  documentRequirements: DocumentRequirement[];
  automationToggles?: PropertyAutomationToggles;
  /** When false, treat plan-gated email toggles as off for preview/confirm copy. */
  automatedBookingFlow?: boolean;
  /** When false (below Pro, no `propertyShowcase`), omit the stay guide line. */
  stayGuideAccess?: boolean;
};

function automation(input: WorkflowTransitionEffectsInput): PropertyAutomationToggles {
  const base = input.automationToggles ?? DEFAULT_PROPERTY_AUTOMATION_TOGGLES;
  if (input.automatedBookingFlow !== false) return base;
  return {
    ...base,
    emailGafRequest: false,
    emailBookingAcknowledgement: false,
    emailPetRequest: false,
    emailParkingBroadcast: false,
    emailReadyForCheckin: false,
    emailSdRefundCheckout: false,
  };
}

function applicableRequirements(
  requirements: DocumentRequirement[],
  booking: WorkflowTransitionEffectsInput['booking']
): DocumentRequirement[] {
  return requirements.filter((req) => requirementApplies(req, booking));
}

function hasDocWithTemplate(
  requirements: DocumentRequirement[],
  booking: WorkflowTransitionEffectsInput['booking'],
  templateId: 'gaf' | 'pet'
): boolean {
  return applicableRequirements(requirements, booking).some(
    (req) => req.pdfTemplateId === templateId || req.id === templateId
  );
}

function sdRefundEmailAlreadySent(booking: WorkflowTransitionEffectsInput['booking']): boolean {
  const raw = booking.sd_refund_form_emailed_at;
  return typeof raw === 'string' && raw.trim() !== '';
}

function securityDepositPositive(booking: WorkflowTransitionEffectsInput['booking']): boolean {
  return Number(booking.security_deposit ?? 0) > 0;
}

function pushIf(lines: string[], condition: boolean, line: string): void {
  if (condition) lines.push(line);
}

function pushEmailIf(
  effects: WorkflowEmailEffect[],
  condition: boolean,
  key: WorkflowEmailEffect['key'],
  label: string
): void {
  if (condition) effects.push({ key, label });
}

/** Emails that would fire on this forward transition (property automations on). */
export function workflowTransitionEmailEffects(
  input: WorkflowTransitionEffectsInput
): WorkflowEmailEffect[] {
  const { fromStatus, toStatus, direction, booking, documentRequirements } = input;
  if (direction === 'back') return [];

  const toggles = automation(input);
  const effects: WorkflowEmailEffect[] = [];
  const isReviewProceed =
    fromStatus === 'PENDING_REVIEW' &&
    (toStatus === 'PENDING_DOCUMENTS' ||
      toStatus === 'PENDING_GAF' ||
      toStatus === 'READY_FOR_CHECKIN');
  const isReviewToDocs =
    fromStatus === 'PENDING_REVIEW' &&
    (toStatus === 'PENDING_DOCUMENTS' || toStatus === 'PENDING_GAF');
  const gafDoc = hasDocWithTemplate(documentRequirements, booking, 'gaf');
  const petDoc = hasDocWithTemplate(documentRequirements, booking, 'pet');
  const hasPets = booking.has_pets === true;

  if (isReviewProceed) {
    pushEmailIf(
      effects,
      toggles.emailGafRequest && isReviewToDocs && gafDoc,
      'sendGafRequestEmail',
      'Emails building management the GAF request.'
    );
    pushEmailIf(
      effects,
      toggles.emailBookingAcknowledgement,
      'sendBookingAcknowledgementEmail',
      'Emails the guest the guest acknowledgement email.'
    );
    pushEmailIf(
      effects,
      toggles.emailPetRequest && isReviewToDocs && hasPets && petDoc,
      'sendPetRequestEmail',
      'Emails building management the pet request.'
    );
  }

  const forwardToReadyForCheckin =
    toStatus === 'READY_FOR_CHECKIN' &&
    (fromStatus === 'PENDING_REVIEW' ||
      fromStatus === 'PENDING_DOCUMENTS' ||
      fromStatus === 'PENDING_GAF' ||
      fromStatus === 'PENDING_PARKING_REQUEST' ||
      fromStatus === 'PENDING_PET_REQUEST');

  if (forwardToReadyForCheckin) {
    pushEmailIf(
      effects,
      toggles.emailReadyForCheckin,
      'sendReadyForCheckinEmail',
      'Emails the guest the ready-for-check-in email.'
    );
  }

  if (fromStatus === 'READY_FOR_CHECKIN' && toStatus === 'READY_FOR_CHECKOUT') {
    pushEmailIf(
      effects,
      toggles.emailSdRefundCheckout &&
        securityDepositPositive(booking) &&
        !sdRefundEmailAlreadySent(booking),
      'sendSdRefundFormEmail',
      'Emails the guest the Check-out Instructions email.'
    );
  }

  return effects;
}

/** True when this forward transition would send workflow emails on a paid plan (default toggles on). */
export function workflowWouldEmailOnPaidPlan(input: WorkflowTransitionEffectsInput): boolean {
  return (
    workflowTransitionEmailEffects({
      ...input,
      automatedBookingFlow: true,
      automationToggles: DEFAULT_PROPERTY_AUTOMATION_TOGGLES,
    }).length > 0
  );
}

/** Short, host-facing bullets for what a workflow transition will do. */
export function workflowTransitionEffectLines(
  input: WorkflowTransitionEffectsInput,
  opts?: { includeEmailLines?: boolean }
): string[] {
  const { fromStatus, toStatus, direction, booking, documentRequirements } = input;
  const includeEmailLines = opts?.includeEmailLines !== false;

  if (direction === 'back') {
    return [
      'Moves the booking to previous status.',
      'Existing fields and documents on this step will be reset.',
      'No emails will be sent.',
    ];
  }

  const lines: string[] = ['Saves your changes and updates the booking status.'];
  const isReviewProceed =
    fromStatus === 'PENDING_REVIEW' &&
    (toStatus === 'PENDING_DOCUMENTS' ||
      toStatus === 'PENDING_GAF' ||
      toStatus === 'READY_FOR_CHECKIN');
  const isReviewToDocs =
    fromStatus === 'PENDING_REVIEW' &&
    (toStatus === 'PENDING_DOCUMENTS' || toStatus === 'PENDING_GAF');
  const gafDoc = hasDocWithTemplate(documentRequirements, booking, 'gaf');
  const petDoc = hasDocWithTemplate(documentRequirements, booking, 'pet');
  const hasPets = booking.has_pets === true;

  if (isReviewProceed) {
    pushIf(
      lines,
      isReviewToDocs && gafDoc,
      'Creates the Guest Acknowledgment Form (GAF) request document.'
    );
    pushIf(lines, isReviewToDocs && hasPets && petDoc, 'Creates the Pet Request Form document.');
  }

  if (includeEmailLines) {
    for (const effect of workflowTransitionEmailEffects(input)) {
      lines.push(effect.label);
    }
  }

  const forwardToReadyForCheckin =
    toStatus === 'READY_FOR_CHECKIN' &&
    (fromStatus === 'PENDING_REVIEW' ||
      fromStatus === 'PENDING_DOCUMENTS' ||
      fromStatus === 'PENDING_GAF' ||
      fromStatus === 'PENDING_PARKING_REQUEST' ||
      fromStatus === 'PENDING_PET_REQUEST');

  if (forwardToReadyForCheckin && input.stayGuideAccess !== false) {
    lines.push('Prepares a stay guide link for the guest.');
  }

  if (fromStatus === 'READY_FOR_CHECKIN' && toStatus === 'READY_FOR_CHECKOUT') {
    lines.push('Records the guest balance you entered.');
    if (
      includeEmailLines &&
      securityDepositPositive(booking) &&
      sdRefundEmailAlreadySent(booking)
    ) {
      lines.push('Check-out Instructions email was already sent. It will not be sent again.');
    }
  }

  if (fromStatus === 'READY_FOR_CHECKOUT' && toStatus === 'PENDING_SD_REFUND') {
    lines.push('Saves the guest security deposit refund form details.');
  }

  if (toStatus === 'COMPLETED') {
    if (fromStatus === 'PENDING_SD_REFUND') {
      lines.push('Saves security deposit refund details and marks the booking as completed.');
    } else {
      lines.push('Closes the booking.');
    }
  }

  return lines;
}

export function workflowCancelEffectLines(): string[] {
  return [
    'Marks this booking as cancelled.',
    'Keeps all guest information.',
    'No emails will be sent.',
  ];
}
