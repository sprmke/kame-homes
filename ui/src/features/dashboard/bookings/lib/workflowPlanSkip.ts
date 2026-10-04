import { toast } from 'sonner';

import type { BookingWorkflowEmailKind } from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';
import { openUpgradeModalFromBridge } from '@/features/dashboard/plans/lib/upgradeModalBridge';

/** Human labels for `workflowOrchestrator.ts`'s `automationSkippedByPlan` side-effect names. */
export const AUTOMATION_SKIP_LABELS: Record<string, string> = {
  gaf_request: 'GAF request email to Azure',
  pet_request: 'Pet request email to Azure',
  booking_acknowledgement: 'Booking acknowledgement email',
  ready_for_checkin: 'Ready-for-check-in email',
  sd_refund_form_request: 'Check-out & SD refund email',
};

/** Session hint so the workflow rail can expand Automation Triggers after a plan skip. */
export const AUTOMATION_SKIP_SESSION_KEY = 'kh-automation-skipped-by-plan';

export function automationSkipLabelsForKinds(kinds: readonly string[]): string[] {
  return kinds.map((key) => AUTOMATION_SKIP_LABELS[key] ?? key);
}

/** Session hint + toast when plan-gated emails were skipped on transition or sd-cron. */
export function notifyAutomationSkippedByPlan(skipped: string[], bookingId: string): void {
  if (skipped.length === 0) return;
  try {
    sessionStorage.setItem(
      AUTOMATION_SKIP_SESSION_KEY,
      JSON.stringify({ bookingId, kinds: skipped, at: Date.now() })
    );
  } catch {
    /* ignore quota / private mode */
  }
  const labels = automationSkipLabelsForKinds(skipped);
  toast.warning(`Not sent automatically on your plan: ${labels.join(', ')}`, {
    description: 'Send them from Automation Triggers on the booking.',
    action: {
      label: 'Upgrade',
      onClick: () => openUpgradeModalFromBridge('automatedBookingFlow'),
    },
    duration: 10_000,
  });
}

const HOST_SKIP_LABELS: Record<string, string> = {
  gaf_request: 'GAF request email',
  pet_request: 'Pet request email',
  booking_acknowledgement: 'Booking acknowledgement email',
  ready_for_checkin: 'Ready-for-check-in email',
  sd_refund_form_request: 'Check-out Instructions email',
};

/** Toast when emails were skipped because property toggles are off (not plan-blocked). */
export function notifyAutomationSkippedByHost(skipped: string[]): void {
  if (skipped.length === 0) return;
  const labels = skipped.map((key) => HOST_SKIP_LABELS[key] ?? key);
  toast.message(`Not sent. Disabled in Email Automations: ${labels.join(', ')}`, {
    description: 'Turn them on under Property Settings → Email automations.',
    duration: 8_000,
  });
}

export function workflowEmailKindFromSkipKey(key: string): BookingWorkflowEmailKind | null {
  if (key in AUTOMATION_SKIP_LABELS) return key as BookingWorkflowEmailKind;
  return null;
}
