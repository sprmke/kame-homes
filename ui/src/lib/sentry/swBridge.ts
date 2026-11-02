import { captureError } from './capture';

/**
 * Page-side half of the service worker error relay.
 *
 * The worker cannot load the SDK, so it posts errors to open clients and this bridge
 * captures them with the page's already-initialised Sentry. Tagged `runtime:
 * service_worker` so a broken notification handler is never confused with a render crash.
 *
 * No-op when the browser has no service worker or nothing is registered.
 */

const SW_ERROR_MESSAGE_TYPE = 'gfm:sw-error';

type SwErrorPayload = {
  type?: string;
  handler?: unknown;
  message?: unknown;
  stack?: unknown;
};

let installed = false;

export function installServiceWorkerErrorBridge(): void {
  if (installed) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  installed = true;

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as SwErrorPayload | undefined;
    if (!data || data.type !== SW_ERROR_MESSAGE_TYPE) return;

    const handler = typeof data.handler === 'string' && data.handler ? data.handler : 'unknown';
    const message =
      typeof data.message === 'string' && data.message ? data.message : 'Service worker error';

    const error = new Error(`Service worker (${handler}): ${message}`);
    if (typeof data.stack === 'string' && data.stack) error.stack = data.stack;

    captureError(error, {
      tags: { runtime: 'service_worker', sw_handler: handler },
      // One broken handler is one issue, not one per device.
      fingerprint: ['service_worker', handler],
    });
  });
}
