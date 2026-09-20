import { setMediaTelemetrySink } from '@/lib/media/mediaTelemetry';
import { captureAppEvent } from '@/lib/posthog/capture';
import type { PwaTelemetryEvent } from '@/lib/pwa/pwaTelemetry';

const PWA_EVENT_MAP: Record<PwaTelemetryEvent, Parameters<typeof captureAppEvent>[0]> = {
  'install-prompt-shown': 'pwa_install_prompt_shown',
  'install-prompt-outcome': 'pwa_install_outcome',
  installed: 'pwa_installed',
  'push-enabled': 'pwa_push_changed',
  'push-disabled': 'pwa_push_changed',
  'push-blocked': 'pwa_push_changed',
  'offline-mutation-queued': 'pwa_offline_queued',
  'sync-drained': 'pwa_update_applied',
  'sync-item-failed': 'pwa_sync_failed',
  'offline-read': 'pwa_offline_queued',
  'update-applied': 'pwa_update_applied',
  'kill-switch': 'pwa_kill_switch',
};

/** Wire PWA + media sinks to PostHog once at app bootstrap. */
export function bootstrapPostHogTelemetry(): void {
  setMediaTelemetrySink((event) => {
    captureAppEvent('media_optimized', {
      surface: event.surface,
      preset: event.preset,
      path: event.path,
      ratio_bucket: Math.round(event.ratio * 100),
      duration_ms_bucket: Math.round(event.durationMs / 100) * 100,
      input_bytes_bucket: Math.round(event.inputBytes / 1024),
      output_bytes_bucket: Math.round(event.outputBytes / 1024),
    });
  });

  if (typeof window === 'undefined') return;

  window.addEventListener('gfm:pwa-telemetry', (ev) => {
    const detail = (ev as CustomEvent<{ event?: PwaTelemetryEvent; ts?: number }>).detail;
    const name = detail?.event ? PWA_EVENT_MAP[detail.event] : undefined;
    if (!name) return;
    captureAppEvent(name, {
      ...(detail.event === 'push-enabled' || detail.event === 'push-disabled'
        ? { enabled: detail.event === 'push-enabled' }
        : {}),
    });
  });
}
