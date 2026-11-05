/**
 * Service worker error relay.
 *
 * The worker runs in its own global scope, cannot import `@/` modules or the Sentry SDK,
 * and has no DOM. Before this, a throw inside `push`, `notificationclick`, `sync`,
 * `periodicsync`, the version check or the fetch fallback vanished: the browser logs it to
 * DevTools, which nobody has open, and the user just sees a notification that did nothing.
 *
 * Strategy: one pair of global hooks rather than try/catch in every handler. Anything the
 * handlers leave uncaught lands here, which is exactly the class of failure that was
 * invisible. Handlers that already catch specific errors keep their own handling.
 *
 * Delivery: post the error to every open client, where `lib/sentry/swBridge.ts` captures it
 * with the page's SDK. If no client is open the error is buffered and flushed with the next
 * message the page sends, which is the first moment anyone can report it. The worker
 * deliberately holds no DSN: the browser project key belongs in one place, and a copy in the
 * worker bundle would be a second one to rotate.
 */

declare const self: ServiceWorkerGlobalScope;

export const SW_ERROR_MESSAGE_TYPE = 'gfm:sw-error';

export type SwErrorPayload = {
  type: typeof SW_ERROR_MESSAGE_TYPE;
  /** Which listener threw (`push`, `sync`, `global`, …). Becomes a Sentry tag. */
  handler: string;
  message: string;
  stack?: string;
};

/** Small on purpose: a broken SW can throw on every event and must not grow unbounded. */
const MAX_BUFFERED = 10;

let buffered: SwErrorPayload[] = [];

function toPayload(handler: string, error: unknown): SwErrorPayload {
  if (error instanceof Error) {
    return {
      type: SW_ERROR_MESSAGE_TYPE,
      handler,
      message: error.message || error.name || 'Service worker error',
      ...(error.stack ? { stack: error.stack.slice(0, 4000) } : {}),
    };
  }
  return {
    type: SW_ERROR_MESSAGE_TYPE,
    handler,
    message: typeof error === 'string' ? error.slice(0, 1000) : 'Service worker error',
  };
}

async function postToClients(payload: SwErrorPayload): Promise<void> {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clientList.length === 0) {
    buffered.push(payload);
    if (buffered.length > MAX_BUFFERED) buffered = buffered.slice(-MAX_BUFFERED);
    return;
  }
  for (const client of clientList) client.postMessage(payload);
}

/**
 * Report one handled failure the worker decided not to rethrow (for example the
 * kill-switch fetch failing while offline, which is expected but worth counting).
 */
export function relaySwError(handler: string, error: unknown): void {
  try {
    void postToClients(toPayload(handler, error)).catch(() => {
      // A worker that cannot report must not also fail.
    });
  } catch {
    // never throw from the reporter
  }
}

/** Flush anything buffered while no client was open. Called on every inbound message. */
export function flushBufferedSwErrors(): void {
  if (buffered.length === 0) return;
  const pending = buffered;
  buffered = [];
  for (const payload of pending) {
    try {
      void postToClients(payload).catch(() => {});
    } catch {
      // ignore
    }
  }
}

/**
 * Install the global hooks. Safe to call once at worker startup; calling twice would
 * double-report, so the caller guards with a module-level flag.
 */
export function installSwErrorRelay(): void {
  self.addEventListener('error', (event) => {
    const errorEvent = event as ErrorEvent;
    relaySwError('global', errorEvent.error ?? errorEvent.message);
  });

  self.addEventListener('unhandledrejection', (event) => {
    const rejection = event as PromiseRejectionEvent;
    relaySwError('unhandledrejection', rejection.reason);
  });

  self.addEventListener('message', () => {
    flushBufferedSwErrors();
  });
}

/** Test seam — the worker module is not unit-tested for delivery, only for shape. */
export function resetBufferedSwErrorsForTests(): void {
  buffered = [];
}
