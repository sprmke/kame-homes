/**
 * pwaTelemetry — thin sink for PWA lifecycle events (install, push opt-in,
 * offline usage). No product-analytics channel is wired into this app yet, so
 * this only `console.debug`s and dispatches a `window` CustomEvent
 * (`gfm:pwa-telemetry`) that a future integration can listen for. Never include
 * PII.
 */
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
}
