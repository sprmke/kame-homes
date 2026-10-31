import { captureAppEvent } from '@/lib/posthog/capture';

const STARTED_KEY = 'gfm:guest_form_started';

const STEP_ANALYTICS_NAMES: Record<number, string> = {
  1: 'guest',
  2: 'stay',
  3: 'parking',
  4: 'pets',
  5: 'payment',
};

export function guestFormStepAnalyticsName(stepId: number): string {
  return STEP_ANALYTICS_NAMES[stepId] ?? 'unknown';
}

export function trackGuestFormStarted(params: {
  bookingSource: string;
  stepCount: number;
  propertyId?: string;
}): void {
  try {
    if (sessionStorage.getItem(STARTED_KEY)) return;
    sessionStorage.setItem(STARTED_KEY, String(Date.now()));
    captureAppEvent('guest_form_started', {
      booking_source: params.bookingSource,
      step_count: params.stepCount,
      ...(params.propertyId ? { property_id: params.propertyId } : {}),
    });
  } catch {
    captureAppEvent('guest_form_started', {
      booking_source: params.bookingSource,
      step_count: params.stepCount,
    });
  }
}

export function trackGuestFormStepCompleted(params: { stepId: number; stepName: string }): void {
  captureAppEvent('guest_form_step_completed', {
    step_id: params.stepId,
    step_name: params.stepName,
  });
}

export function trackGuestFormStepFailed(params: {
  stepId: number;
  stepName: string;
  errorCount: number;
}): void {
  captureAppEvent('guest_form_step_failed', {
    step_id: params.stepId,
    step_name: params.stepName,
    error_count: params.errorCount,
  });
}

export function trackGuestFormAbandoned(lastStepId: number): void {
  let secondsOnForm = 0;
  try {
    const raw = sessionStorage.getItem(STARTED_KEY);
    if (!raw) return;
    const started = Number(raw);
    if (Number.isFinite(started) && started > 0) {
      secondsOnForm = Math.round((Date.now() - started) / 1000);
    }
    sessionStorage.removeItem(STARTED_KEY);
  } catch {
    return;
  }
  captureAppEvent('guest_form_abandoned', {
    last_step_id: lastStepId,
    seconds_on_form: secondsOnForm,
  });
}

export function clearGuestFormStartedMarker(): void {
  try {
    sessionStorage.removeItem(STARTED_KEY);
  } catch {
    // ignore
  }
}
