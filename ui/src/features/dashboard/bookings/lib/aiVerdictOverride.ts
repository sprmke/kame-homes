import { toast } from 'sonner';

import { isAiVerdictBlockedError } from '@/features/dashboard/bookings/hooks/useTransitionBooking';

/**
 * AI receipt checks are advisory. When a transition is blocked only by an AI `invalid` verdict,
 * offer the host an explicit "Proceed anyway" instead of a dead end. The retry re-sends the
 * transition with `override_ai_verdict`, which the server audits. Returns true when handled.
 */
export function offerAiVerdictOverride(err: unknown, proceedAnyway: () => void): boolean {
  if (!isAiVerdictBlockedError(err)) return false;
  toast.warning(err.message, {
    action: { label: 'Proceed anyway', onClick: proceedAnyway },
    duration: 15_000,
  });
  return true;
}
