/**
 * pwaTelemetry — PWA lifecycle events (install, push opt-in, offline usage,
 * updates, launch fallback).
 *
 * Dispatches a `window` CustomEvent (`gfm:pwa-telemetry`) which
 * `ui/src/lib/posthog/bootstrapTelemetry.ts` maps onto the PostHog event catalog
 * (`PWA_EVENT_MAP`). Adding an event here means adding the PostHog mapping too.
 * Never include PII.
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
  | 'kill-switch'
  | 'launch-offline-fallback';

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
