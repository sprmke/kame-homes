import { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';

import { disablePush, enablePush, getPushState, type PushState } from '@/lib/pwa/push';

import { SW_MESSAGE } from '@/pwa/shared';

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
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>(INITIAL);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getPushState().then(setState);
  }, []);

  useEffect(() => {
    refresh();
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
      setState(await enablePush());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't turn on notifications.");
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      setState(await disablePush());
    } catch {
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  }, []);

  return { ...state, busy, enable, disable, refresh };
}
