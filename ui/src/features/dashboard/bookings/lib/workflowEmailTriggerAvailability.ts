/**
 * When each Automation Triggers send button is enabled, and why it is disabled.
 */

import type {
  BookingForManualWorkflowEmail,
  BookingWorkflowEmailKind,
} from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';
import {
  eligibleManualWorkflowEmailKinds,
  sortManualWorkflowEmailTriggerKinds,
} from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';
import {
  gafRequestSendDisabledReason,
  petRequestSendDisabledReason,
} from '@/features/dashboard/bookings/lib/workflowEmailSendPrerequisites';

export type WorkflowEmailTriggerAvailability = {
  enabled: boolean;
  disabledReason: string | null;
};

function flagTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

function hasUrl(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

const PENDING_DOC_STATUSES = new Set([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
]);

/** Kinds to render in Automation Triggers (includes upcoming / disabled rows). */
export function visibleManualWorkflowEmailKinds(
  booking: BookingForManualWorkflowEmail
): BookingWorkflowEmailKind[] {
  const status = booking.status;
  if (status === 'CANCELLED' || status === 'COMPLETED') return [];

  if (status === 'PENDING_REVIEW') {
    const kinds: BookingWorkflowEmailKind[] = ['booking_acknowledgement', 'gaf_request'];
    if (flagTrue(booking.has_pets)) kinds.push('pet_request');
    return sortManualWorkflowEmailTriggerKinds(kinds);
  }

  const kinds = [...eligibleManualWorkflowEmailKinds(booking)];

  if (PENDING_DOC_STATUSES.has(status) && !kinds.includes('ready_for_checkin')) {
    kinds.push('ready_for_checkin');
  }

  return sortManualWorkflowEmailTriggerKinds(kinds);
}

export function resolveWorkflowEmailTriggerAvailability(
  kind: BookingWorkflowEmailKind,
  booking: BookingForManualWorkflowEmail,
  opts?: { pendingDocumentsComplete?: boolean }
): WorkflowEmailTriggerAvailability {
  const status = booking.status;

  switch (kind) {
    case 'booking_acknowledgement':
      if (status === 'PENDING_REVIEW') {
        return {
          enabled: false,
          disabledReason: 'Proceed from Pending Review first.',
        };
      }
      return { enabled: true, disabledReason: null };

    case 'gaf_request':
      if (status === 'PENDING_REVIEW') {
        return {
          enabled: false,
          disabledReason: 'Proceed from Pending Review first to generate the GAF PDF.',
        };
      }
      if (!hasUrl(booking.gaf_request_pdf_url)) {
        return {
          enabled: false,
          disabledReason: 'Proceed from Pending Review first to generate the GAF PDF.',
        };
      }
      {
        const disabledReason = gafRequestSendDisabledReason(booking);
        if (disabledReason) {
          return { enabled: false, disabledReason };
        }
      }
      return { enabled: true, disabledReason: null };

    case 'pet_request':
      if (!flagTrue(booking.has_pets)) {
        return { enabled: false, disabledReason: 'This stay has no pets.' };
      }
      if (status === 'PENDING_REVIEW') {
        return {
          enabled: false,
          disabledReason: 'Proceed from Pending Review first to generate the pet request PDF.',
        };
      }
      if (!hasUrl(booking.pet_request_pdf_url)) {
        return {
          enabled: false,
          disabledReason: 'Proceed from Pending Review first to generate the pet request PDF.',
        };
      }
      {
        const disabledReason = petRequestSendDisabledReason(booking);
        if (disabledReason) {
          return { enabled: false, disabledReason };
        }
      }
      return { enabled: true, disabledReason: null };

    case 'ready_for_checkin':
      if (status !== 'READY_FOR_CHECKIN') {
        if (PENDING_DOC_STATUSES.has(status) && opts?.pendingDocumentsComplete === false) {
          return {
            enabled: false,
            disabledReason: 'Complete all pending documents, then Proceed to Ready for Check-in.',
          };
        }
        return {
          enabled: false,
          disabledReason: 'Proceed to Ready for Check-in first.',
        };
      }
      return { enabled: true, disabledReason: null };

    case 'sd_refund_form_request':
      if (status !== 'READY_FOR_CHECKIN' && status !== 'READY_FOR_CHECKOUT') {
        return {
          enabled: false,
          disabledReason:
            'Available after you Proceed to Ready for Check-in or Ready for Check-out.',
        };
      }
      return { enabled: true, disabledReason: null };

    default:
      return { enabled: true, disabledReason: null };
  }
}
