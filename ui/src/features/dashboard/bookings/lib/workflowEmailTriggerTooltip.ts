/**
 * Hover copy for Automation Triggers — what each send does, plus blockers when disabled.
 */

import type { BookingWorkflowEmailKind } from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';

/** What happens when the host clicks Send (first sentence of every tooltip). */
export const BOOKING_WORKFLOW_EMAIL_TRIGGER_HELP: Record<BookingWorkflowEmailKind, string> = {
  booking_acknowledgement:
    'Emails the guest that their booking is approved. GAF and pet emails to the PMO are separate buttons below.',
  gaf_request: 'Emails the PMO or developer the GAF request PDF and guest valid IDs.',
  pet_request:
    'Emails the PMO or developer the pet request PDF, vaccination record, and pet photo.',
  ready_for_checkin: 'Emails the guest that they are ready for check-in.',
  sd_refund_form_request:
    'Emails the guest Check-out Instructions and the security deposit refund form link.',
};

export const SD_CHECKOUT_AUTOMATION_TRIGGER_HELP = {
  paid: 'Runs check-out automation for this booking and sends Check-out Instructions when enabled.',
  free: 'Moves this booking to Ready for Check-out only. Email Check-out Instructions separately below.',
} as const;

export const SD_CHECKOUT_INSTRUCTIONS_RESEND_HELP =
  'Emails the guest Check-out Instructions and the security deposit refund form link again. Does not change booking status.';

/** Enabled: action only. Disabled: action + blocker in one tooltip. */
export function buildWorkflowEmailTriggerTooltip(
  actionHelp: string,
  blocker?: string | null
): string {
  const action = actionHelp.trim();
  const block = blocker?.trim();
  if (block) return action ? `${action} ${block}` : block;
  return action;
}

export function workflowEmailTriggerTooltip(
  kind: BookingWorkflowEmailKind,
  blocker?: string | null
): string {
  return buildWorkflowEmailTriggerTooltip(BOOKING_WORKFLOW_EMAIL_TRIGGER_HELP[kind], blocker);
}

export function resolveWorkflowEmailTriggerBlocker(opts: {
  enabled: boolean;
  disabledReason: string | null;
  blockedByAnotherSend: boolean;
  cooldownBlocks: boolean;
  cooldownReason: string | null;
}): string | null {
  if (!opts.enabled) return opts.disabledReason;
  if (opts.cooldownBlocks) return opts.cooldownReason;
  if (opts.blockedByAnotherSend) return 'Wait for the current send to finish.';
  return null;
}
