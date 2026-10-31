/**
 * How a pipeline stage (or nested doc step) advances to the next one.
 *
 * Auto — guest, inbound email, or orchestrator/cron moves it.
 * Manual — the host must update or Proceed.
 */

import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { DocumentApprovalSource } from '@/features/dashboard/bookings/lib/documentRequirements';

export type WorkflowAdvanceMode = 'auto' | 'manual';

export const WORKFLOW_ADVANCE_MODE_LABEL: Record<WorkflowAdvanceMode, string> = {
  auto: 'Auto',
  manual: 'Manual',
};

/** Host-facing tooltip on the card-title badge. */
export const WORKFLOW_ADVANCE_MODE_HINT: Record<WorkflowAdvanceMode, string> = {
  auto: 'This moves to the next step automatically once all required fields and documents are complete.',
  manual: 'This requires you to Proceed or mark it as complete to move to the next step.',
};

/** Purpose line under the Booking Workflow map title. */
export const WORKFLOW_ADVANCE_LEGEND =
  'This guide will walk you through each step of the booking workflow, including what’s required and how things work for each status.';

/** One-line Free vs Paid difference under the Booking Workflow map title. */
export const WORKFLOW_PLAN_PREVIEW_SUMMARY = {
  free: 'You send workflow emails from Automation Triggers.',
  paid: 'Workflow emails send automatically at each step.',
} as const;

/** Plan-aware subtitle for the Booking Workflow map. */
export function workflowAdvanceLegend(automatedBookingFlow?: boolean): string {
  if (automatedBookingFlow === false) {
    return `${WORKFLOW_ADVANCE_LEGEND} Manual badges mean you Proceed, mark complete, or send workflow emails from Automation Triggers. Signed PDFs can still complete GAF and pet steps automatically when they arrive by email.`;
  }
  return `${WORKFLOW_ADVANCE_LEGEND} Starter and above send workflow emails automatically when each step completes.`;
}

/** Free-tier pill labels — host-facing; outbound emails are never automatic. */
const FREE_MANUAL_EMAILS_LABEL = 'Manual · emails';
const FREE_MANUAL_SEND_LABEL = 'Manual · send';

const DEFAULT_LEAD_MINUTES = 120;

type PipelineAdvanceOpts = {
  /** When the deposit is 0, Ready for Check-out skips the guest form. */
  sdIsZero?: boolean;
  /** Property setting — used in the Ready for Check-in guide. */
  sdRefundEmailLeadMinutes?: number;
  /**
   * When false (Free / no `automatedBookingFlow`), guide copy must not promise
   * auto-sent GAF / ack / ready emails — host sends via Automation Triggers.
   */
  automatedBookingFlow?: boolean;
};

/** Host-facing phrase for the property’s check-out email lead. */
export function formatSdRefundLeadPhrase(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'At checkout';
  if (minutes < 60) {
    return minutes === 1 ? '1 minute before checkout' : `${minutes} minutes before checkout`;
  }
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return hours === 1 ? '1 hour before checkout' : `${hours} hours before checkout`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hours before checkout`;
}

/** How this pipeline stage leaves for the next one. Null = terminal / no forward path. */
export function pipelineAdvanceMode(
  status: BookingStatus,
  opts?: PipelineAdvanceOpts
): WorkflowAdvanceMode | null {
  switch (status) {
    case 'PENDING_REVIEW':
    case 'READY_FOR_CHECKIN':
    case 'PENDING_SD_REFUND':
      return 'manual';
    case 'PENDING_DOCUMENTS':
    case 'PENDING_GAF':
    case 'PENDING_PET_REQUEST':
      return 'auto';
    case 'READY_FOR_CHECKOUT':
      return opts?.sdIsZero ? 'manual' : 'auto';
    case 'PENDING_PARKING_REQUEST':
      return 'manual';
    default:
      return null;
  }
}

/** Nested Pending Documents row — email-listener is Auto; parking and manual docs are Manual. */
export function nestedAdvanceMode(
  approvalSource: DocumentApprovalSource | null | undefined
): WorkflowAdvanceMode {
  return approvalSource === 'email-listener' ? 'auto' : 'manual';
}

/** Host-facing guide lines for the Booking Workflow map. */
export function pipelineAdvanceGuide(status: BookingStatus, opts?: PipelineAdvanceOpts): string[] {
  const leadPhrase = formatSdRefundLeadPhrase(
    opts?.sdRefundEmailLeadMinutes ?? DEFAULT_LEAD_MINUTES
  );
  const automated = opts?.automatedBookingFlow !== false;

  switch (status) {
    case 'PENDING_REVIEW':
      return automated
        ? [
            'Confirm booking details, pricing, and uploaded IDs & downpayment receipts.',
            'Proceed when everything looks correct. This will send the guest acknowledgement email to the guest and send applicable email requests (GAF, pet) to building management.',
          ]
        : [
            'Confirm booking details, pricing, and uploaded IDs & downpayment receipts.',
            'Proceed when everything looks correct. Workflow emails are not automatic. Send GAF, pet, or acknowledgement from Automation Triggers after you proceed. For parking, use Find parking.',
          ];
    case 'PENDING_DOCUMENTS':
      return automated
        ? [
            'These are the building paperwork required for this stay. All documents below must be completed.',
            'Once everything is done, this will move to the next step automatically and the guest will receive the ready-for-check-in email.',
          ]
        : [
            'These are the building paperwork required for this stay. All documents below must be completed.',
            'Once everything is done, this will move to the next step automatically. Send the ready-for-check-in email from Automation Triggers if the guest needs it.',
          ];
    case 'PENDING_GAF':
      return nestedAdvanceGuide('gaf', 'email-listener', opts);
    case 'PENDING_PET_REQUEST':
      return nestedAdvanceGuide('pet', 'email-listener', opts);
    case 'PENDING_PARKING_REQUEST':
      return nestedAdvanceGuide('PENDING_PARKING_REQUEST', null);
    case 'READY_FOR_CHECKIN':
      return automated
        ? [
            'The guest is checked in. To move to the next step, the remaining balance must be settled with a receipt uploaded.',
            `Once you did that, ${leadPhrase.toLowerCase()}, the guest gets the Check-out Instructions email automatically, even if the balance is unpaid. If the balance is already settled, the booking also moves automatically to Ready for Check-out at that time.`,
            'You can Proceed sooner once settlement is done. If the email or move did not happen, open Automation Triggers and run the check-out automation.',
          ]
        : [
            'The guest is checked in. To move to the next step, the remaining balance must be settled with a receipt uploaded.',
            'Check-out Instructions email is not automatic. Use Automation Triggers to send it, and to run the check-out move when settlement is done.',
            'You can Proceed sooner once settlement is done.',
          ];
    case 'READY_FOR_CHECKOUT':
      if (opts?.sdIsZero) {
        return [
          'This stay has no security deposit, so there is no guest refund form.',
          'Tap Proceed to finish the booking.',
        ];
      }
      return automated
        ? [
            'Waiting for the guest to submit the security deposit refund form.',
            'Once guest submitted the SD refund form, the booking will move to the next step automatically.',
            'If guest did not receive the Check-out Instructions email, open Automation Triggers and resend it.',
          ]
        : [
            'Waiting for the guest to submit the security deposit refund form.',
            'Once they submit, the booking moves to the next step automatically.',
            'Check-out Instructions email is not automatic. Send or resend it from Automation Triggers.',
          ];
    case 'PENDING_SD_REFUND':
      return [
        "Settle the guest's security deposit refund.",
        'You can also add additional transactions, such as profits and expenses, which will be factored into the security deposit refund calculation.',
        'Once everything is done, click Proceed to mark the booking as completed.',
      ];
    case 'COMPLETED':
      return [
        'This stay is complete. You can go back to previous steps to make adjustments, but changes will not affect the booking status once it has been completed.',
      ];
    case 'CANCELLED':
      return cancelledAdvanceGuide(true);
    default:
      return [];
  }
}

/**
 * Off-pipeline Cancelled note on the Booking Workflow map.
 * Not a rail step — cancel is offered through Ready for Check-in only.
 */
export function cancelledAdvanceGuide(isCancelled = false): string[] {
  if (isCancelled) {
    return [
      'This booking was cancelled.',
      'Guest details and uploaded files stay on our system. No emails were sent.',
    ];
  }
  return [
    'You can cancel anytime as long as the booking is not Ready for Check-out.',
    'Guest details and uploaded files stay on our system. No emails will be sent.',
  ];
}

/** Host-facing guide lines for a nested document row. */
export function nestedAdvanceGuide(
  key: string,
  approvalSource: DocumentApprovalSource | null | undefined,
  opts?: Pick<PipelineAdvanceOpts, 'automatedBookingFlow'>
): string[] {
  const automated = opts?.automatedBookingFlow !== false;
  if (key === 'PENDING_PARKING_REQUEST') {
    return [
      'Record the vehicle and parking fee for this stay.',
      'Required: parking endorsement and settlement details.',
      'Mark as complete when those are filled. This does not wait for an email.',
    ];
  }
  if (key === 'gaf' || key === 'PENDING_GAF') {
    return automated
      ? [
          "Request for building's signed copy of Guest Acknowledgment Form (GAF) document.",
          'Required: guest valid IDs (sent with the request) and the signed GAF back.',
          "It's automatically marked as complete when the signed PDF received via email. You can also manually upload it and mark it as complete.",
        ]
      : [
          "Request for building's signed copy of Guest Acknowledgment Form (GAF) document.",
          'Required: guest valid IDs and the signed GAF back.',
          'Send the GAF request from Automation Triggers. This step completes automatically when the signed PDF arrives by email, or after you upload it and mark complete.',
        ];
  }
  if (key === 'pet' || key === 'PENDING_PET_REQUEST') {
    return automated
      ? [
          "Request for building's signed copy of Pet Request Form (Pet) document.",
          'Required: pet photo, vaccination record, and the signed pet form.',
          "It's automatically marked as complete when the signed PDF received via email. You can also manually upload it and mark it as complete.",
        ]
      : [
          "Request for building's signed copy of Pet Request Form (Pet) document.",
          'Required: pet photo, vaccination record, and the signed pet form.',
          'Send the pet request from Automation Triggers. This step completes automatically when the signed PDF arrives by email, or after you upload it and mark complete.',
        ];
  }
  if (approvalSource === 'email-listener') {
    return automated
      ? [
          "Request for building's signed copy of Guest Acknowledgment Form (GAF) document.",
          "It's automatically marked as complete when the signed PDF received via email. You can also manually upload it and mark it as complete.",
        ]
      : [
          "Request for building's signed copy of Guest Acknowledgment Form (GAF) document.",
          'Send the request from Automation Triggers. Mark complete when the signed PDF arrives by email or after you upload it.',
        ];
  }
  return [
    'Complete the required fields or files for this item.',
    'Mark as complete when it is done.',
  ];
}

export function workflowAdvanceModeAria(mode: WorkflowAdvanceMode): string {
  return `${WORKFLOW_ADVANCE_MODE_LABEL[mode]}. ${WORKFLOW_ADVANCE_MODE_HINT[mode]}`;
}

/** Pill label + tooltip — plan-aware where emails differ from status automation. */
export type WorkflowAdvanceDisplay = {
  mode: WorkflowAdvanceMode;
  label: string;
  hint: string;
};

function advanceDisplay(
  mode: WorkflowAdvanceMode,
  label: string,
  hint: string
): WorkflowAdvanceDisplay {
  return { mode, label, hint };
}

export function pipelineAdvanceDisplay(
  status: BookingStatus,
  opts?: PipelineAdvanceOpts
): WorkflowAdvanceDisplay | null {
  const mode = pipelineAdvanceMode(status, opts);
  if (!mode) return null;

  const automated = opts?.automatedBookingFlow !== false;
  if (automated) {
    return advanceDisplay(
      mode,
      WORKFLOW_ADVANCE_MODE_LABEL[mode],
      WORKFLOW_ADVANCE_MODE_HINT[mode]
    );
  }

  switch (status) {
    case 'PENDING_REVIEW':
      return advanceDisplay(
        'manual',
        WORKFLOW_ADVANCE_MODE_LABEL.manual,
        'Confirm details and Proceed. Workflow emails are not automatic. Send GAF, pet, or acknowledgement from Automation Triggers after you proceed.'
      );
    case 'PENDING_DOCUMENTS':
      return advanceDisplay(
        'manual',
        FREE_MANUAL_EMAILS_LABEL,
        'Status advances when required documents are complete. Workflow emails are not automatic. Send ready-for-check-in and other emails from Automation Triggers.'
      );
    case 'READY_FOR_CHECKIN':
      return advanceDisplay(
        'manual',
        WORKFLOW_ADVANCE_MODE_LABEL.manual,
        'Proceed after guest balance is settled. Check-out Instructions email is not automatic. Send from Automation Triggers.'
      );
    case 'READY_FOR_CHECKOUT':
      if (opts?.sdIsZero) {
        return advanceDisplay(
          mode,
          WORKFLOW_ADVANCE_MODE_LABEL[mode],
          WORKFLOW_ADVANCE_MODE_HINT[mode]
        );
      }
      return advanceDisplay(
        'manual',
        FREE_MANUAL_EMAILS_LABEL,
        'Guest SD refund form submission moves the booking forward. Check-out Instructions email is not automatic. Send from Automation Triggers.'
      );
    default:
      return advanceDisplay(
        mode,
        WORKFLOW_ADVANCE_MODE_LABEL[mode],
        WORKFLOW_ADVANCE_MODE_HINT[mode]
      );
  }
}

export function nestedAdvanceDisplay(
  key: string,
  approvalSource: DocumentApprovalSource | null | undefined,
  opts?: Pick<PipelineAdvanceOpts, 'automatedBookingFlow'>
): WorkflowAdvanceDisplay {
  const mode = nestedAdvanceMode(approvalSource);
  const automated = opts?.automatedBookingFlow !== false;

  if (!automated && approvalSource === 'email-listener') {
    return advanceDisplay(
      'manual',
      FREE_MANUAL_SEND_LABEL,
      'Send the request from Automation Triggers. Completes automatically when the signed PDF arrives by email, or after you upload it and mark complete.'
    );
  }

  if (!automated && (key === 'gaf' || key === 'PENDING_GAF')) {
    return advanceDisplay(
      'manual',
      FREE_MANUAL_SEND_LABEL,
      'Send the GAF request from Automation Triggers. Completes automatically when the signed GAF arrives by email, or after you upload it and mark complete.'
    );
  }

  if (!automated && (key === 'pet' || key === 'PENDING_PET_REQUEST')) {
    return advanceDisplay(
      'manual',
      FREE_MANUAL_SEND_LABEL,
      'Send the pet request from Automation Triggers. Completes automatically when the signed form arrives by email, or after you upload it and mark complete.'
    );
  }

  return advanceDisplay(mode, WORKFLOW_ADVANCE_MODE_LABEL[mode], WORKFLOW_ADVANCE_MODE_HINT[mode]);
}
