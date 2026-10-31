import { useState, type Dispatch, type SetStateAction } from 'react';

import { SW_MESSAGE } from '@/pwa/shared';

export type RegisterSWOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisteredSW?: (
    swScriptUrl: string,
    registration: ServiceWorkerRegistration | undefined
  ) => void;
  onRegisterError?: (error: unknown) => void;
};

type UseRegisterSWReturn = {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
};

/**
 * Service-worker registration for the app shell.
 *
 * Intentionally **does not** import `virtual:pwa-register/react` — that virtual
 * module is easy to break under a stale Vite process / plugin reload, and the SW
 * is off in normal `vite` serve anyway. Production / preview / `VITE_PWA_DEV`
 * register via `workbox-window`; plain `vite` serve returns a no-op stub so HMR
 * is never contested.
 */
export function useRegisterSW(options: RegisterSWOptions = {}): UseRegisterSWReturn {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  const [, setNeedRefresh] = needRefresh;
  const [, setOfflineReady] = offlineReady;

  const [updateServiceWorker] = useState(() =>
    createRegisterSW(options, setNeedRefresh, setOfflineReady)
  );

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
  };
}

function shouldRegisterServiceWorker(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  // Match vite.config.ts `devOptions.enabled` — SW stays off under plain vite serve.
  if (import.meta.env.DEV && import.meta.env.VITE_PWA_DEV !== 'true') return false;
  return true;
}

function swScriptUrl(): string {
  if (import.meta.env.DEV && import.meta.env.VITE_PWA_DEV === 'true') {
    // vite-plugin-pwa injectManifest dev SW URL when `VITE_PWA_DEV=true`.
    return 'dev-sw.js?dev-sw';
  }
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}sw.js`;
}

function createRegisterSW(
  options: RegisterSWOptions,
  setNeedRefresh: Dispatch<SetStateAction<boolean>>,
  setOfflineReady: Dispatch<SetStateAction<boolean>>
): (reloadPage?: boolean) => Promise<void> {
  const {
    immediate = true,
    onNeedRefresh,
    onOfflineReady,
    onRegistered,
    onRegisteredSW,
    onRegisterError,
  } = options;

  if (!shouldRegisterServiceWorker()) {
    return async () => {};
  }

  let sendSkipWaiting: (() => void) | undefined;
  let registerPromise: Promise<void>;

  const updateServiceWorker = async (reloadPage = true) => {
    await registerPromise;
    sendSkipWaiting?.();
    if (reloadPage) {
      // Controlling change after skipWaiting → hard reload so the new SW owns the page.
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          window.location.reload();
        },
        { once: true }
      );
    }
  };

  registerPromise = (async () => {
    try {
      const { Workbox } = await import('workbox-window');
      const url = swScriptUrl();
      const wb = new Workbox(url, {
        scope: '/',
        type: import.meta.env.DEV ? 'module' : 'classic',
      });

      sendSkipWaiting = () => {
        // Workbox posts `SKIP_WAITING`; our SW also accepts `gfm:skip-waiting`.
        wb.messageSkipWaiting();
        void wb.messageSW({ type: SW_MESSAGE.SKIP_WAITING });
      };

      let promptShown = false;
      const showRefreshPrompt = () => {
        if (promptShown) return;
        promptShown = true;
        wb.addEventListener('controlling', () => {
          window.location.reload();
        });
        setNeedRefresh(true);
        onNeedRefresh?.();
      };

      wb.addEventListener('waiting', () => showRefreshPrompt());
      wb.addEventListener('installed', (event) => {
        if (!event.isUpdate) {
          setOfflineReady(true);
          onOfflineReady?.();
        }
      });

      const registration = await wb.register({ immediate });
      onRegisteredSW?.(url, registration);
      onRegistered?.(registration);
    } catch (error) {
      onRegisterError?.(error);
    }
  })();

  return updateServiceWorker;
}
