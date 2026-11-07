import { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';

import { disablePush, enablePush, getPushState, type PushState } from '@/lib/pwa/push';

import { SW_MESSAGE } from '@/pwa/shared';

/** How long the card waits for the service worker before showing the last known state. */
const PUSH_STATE_TIMEOUT_MS = 2000;

/**
 * A fresh service worker takes a moment to activate. During that window the row
 * says it is preparing instead of reporting a failure, so a normal first load
 * never looks broken.
 */
const PUSH_WORKER_GRACE_MS = 5000;

const INITIAL: PushState = {
  supported: false,
  needsInstallFirst: false,
  permission: 'default',
  subscribed: false,
};

/**
 * OS push opt-in state for the current device. `enable()` must be called from a
 * user gesture (iOS requirement). On iOS the control should stay hidden until the
 * app is installed — `needsInstallFirst` says so.
 *
 * `ready` is false until the first read lands, so the card can skeleton instead
 * of flashing "unsupported". Every path clears `busy`, so the switch can never
 * sit disabled forever.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [workerGraceElapsed, setWorkerGraceElapsed] = useState(false);

  /* Reset the grace window whenever the worker state changes either way. */
  useEffect(() => {
    if (state.reason !== 'not-ready') {
      setWorkerGraceElapsed(false);
      return;
    }
    if (workerGraceElapsed) return;
    const timer = window.setTimeout(() => setWorkerGraceElapsed(true), PUSH_WORKER_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [state.reason, workerGraceElapsed]);

  /**
   * True while a first-load worker is still activating: show "preparing", not an
   * error. After the grace window it becomes a real limitation.
   */
  const preparing = state.reason === 'not-ready' && !workerGraceElapsed;

  const refresh = useCallback(() => {
    /*
     * `getPushState` waits for the service worker. Under `vite` dev the worker is
     * off by design, so that wait can never settle; the row must not skeleton
     * forever, so fall back to the last known state.
     */
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      setReady(true);
    };
    const timer = window.setTimeout(finish, PUSH_STATE_TIMEOUT_MS);

    void getPushState()
      .then((next) => setState(next))
      .catch(() => undefined)
      .finally(finish);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /*
   * The read above may have raced the worker (it gives up after 2s, and a fresh
   * registration is not `active` until it activates). Re-read once a worker is
   * actually active so `supported` flips on without a reload.
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker.ready.then(() => {
      if (!cancelled) refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // The SW asks for a re-register after the browser rotates the subscription.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === SW_MESSAGE.PUSH_RESYNC) refresh();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      setReady(true);
      if (next.subscribed) {
        toast.success('Notifications on for this device');
      } else if (next.permission === 'denied') {
        toast.error('Notifications are blocked. Allow them in your browser settings.');
      } else if (next.permission !== 'granted') {
        toast.error('Permission not granted. Notifications stayed off.');
      } else {
        toast.error('Notifications are not available on this device yet.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't turn on notifications.");
      try {
        setState(await getPushState());
      } catch {
        // Keep the last known state; the toast already explained the failure.
      }
    } finally {
      setReady(true);
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const next = await disablePush();
      setState(next);
      if (!next.subscribed) toast.success('Notifications off for this device');
    } catch {
      try {
        setState(await getPushState());
      } catch {
        // Keep the last known state.
      }
    } finally {
      setReady(true);
      setBusy(false);
    }
  }, []);

  return { ...state, ready, preparing, busy, enable, disable, refresh };
}
