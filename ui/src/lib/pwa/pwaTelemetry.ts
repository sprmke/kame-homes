/**
 * pwaTelemetry — the one sink for PWA lifecycle events (install, push opt-in,
 * offline usage). It keeps the `console.debug` line and the `gfm:pwa-telemetry`
 * CustomEvent for the UI, and forwards the same fact to PostHog through the
 * typed catalog. Never include PII.
 */
import { captureAppEvent } from '@/lib/posthog/capture';
import type { AppAnalyticsEventName } from '@/lib/posthog/catalog';

export type PwaTelemetryEvent =
  | 'install-prompt-shown'
  | 'install-prompt-outcome'
  | 'installed'
  | 'push-enabled'
  | 'push-disabled'
  | 'push-blocked'
  | 'offline-mutation-queued'
  | 'sync-drained'
  | 'sync-item-failed'
  | 'offline-read'
  | 'update-applied'
  | 'kill-switch';

/** Telemetry names are kebab-case; catalog names are snake_case. Kept explicit on purpose. */
const PRODUCT_EVENT: Partial<Record<PwaTelemetryEvent, AppAnalyticsEventName>> = {
  'install-prompt-shown': 'pwa_install_prompt_shown',
  'install-prompt-outcome': 'pwa_install_outcome',
  installed: 'pwa_installed',
  'push-enabled': 'pwa_push_changed',
  'push-disabled': 'pwa_push_changed',
  'push-blocked': 'pwa_push_changed',
  'offline-mutation-queued': 'pwa_offline_queued',
  'sync-item-failed': 'pwa_sync_failed',
  'update-applied': 'pwa_update_applied',
  'kill-switch': 'pwa_kill_switch',
};

export function pwaTelemetry(event: PwaTelemetryEvent, data?: Record<string, unknown>): void {
  const payload = { event, ts: Date.now(), ...data };
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[pwa]', event, data ?? '');
  }
  try {
    window.dispatchEvent(new CustomEvent('gfm:pwa-telemetry', { detail: payload }));
  } catch {
    // ignore
  }

  const productEvent = PRODUCT_EVENT[event];
  if (productEvent) {
    captureAppEvent(productEvent, event.startsWith('push-') ? { outcome: event } : undefined);
  }
}
