import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import {
  BACKGROUND_APPLY_MS,
  UPDATE_CHANNEL,
  UPDATE_CHECK_MIN_INTERVAL_MS,
  bumpAutoReloadCount,
  canApplyNow,
  canAutoReload,
  isSnoozed,
  nextSnoozeUntil,
  parseUpdateBroadcast,
  type UpdateBroadcast,
  type UpdateGuardSnapshot,
} from '@/lib/pwa/updateController';

import { SW_MESSAGE } from '@/pwa/shared';


export type RegisterSWOptions = {
  immediate?: boolean;
  /**
   * Read at apply time (never cached): a reload must never clobber an unsaved form,
   * an open sheet, a draining outbox or an in-flight upload.
   */
  getGuardSnapshot?: () => UpdateGuardSnapshot;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisteredSW?: (
    swScriptUrl: string,
    registration: ServiceWorkerRegistration | undefined
  ) => void;
  onRegisterError?: (error: unknown) => void;
};

export type UseRegisterSWReturn = {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
  forceUpdate: [boolean, Dispatch<SetStateAction<boolean>>];
  /** Accept the update now (reloads once; never over a dirty guard). */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  /** "Later": hide the prompt for four hours, not for the whole session. */
  snoozeUpdate: () => void;
  /** Manual "Check for updates" (Help & Support, super-admin health). */
  checkForUpdate: () => void;
  /** Call on every route change — the safest moment to apply a waiting update. */
  notifyRouteChange: () => void;
  /** The SW reported `forceUpdateBelow`: the build must update before continuing. */
  markForceUpdate: () => void;
};

const SNOOZE_KEY = 'gfm:pwa:update-snoozed-until';

const EMPTY_GUARD: UpdateGuardSnapshot = {
  dirtyGuards: 0,
  overlayOpen: false,
  outboxDraining: false,
  taskInFlight: false,
};

function readSnooze(): number | null {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return isSnoozed(value, Date.now()) ? value : null;
  } catch {
    return null;
  }
}

function writeSnooze(until: number): void {
  try {
    if (until > Date.now()) window.localStorage.setItem(SNOOZE_KEY, String(until));
    else window.localStorage.removeItem(SNOOZE_KEY);
  } catch {
    // ignore
  }
}

// ── reload guard ─────────────────────────────────────────────────────────────
// Exactly one `controllerchange` reload listener exists for the page, no matter how
// many components mount the hook (v1 registered two and could double-reload).

let reloadingForActivation = false;

function reloadForActivation(): void {
  if (reloadingForActivation) return;
  reloadingForActivation = true;
  try {
    bumpAutoReloadCount(window.sessionStorage);
  } catch {
    // sessionStorage unavailable (private mode) — still reload once
  }
  window.location.reload();
}

type Controller = {
  acceptUpdate: (reloadPage?: boolean) => Promise<void>;
  checkNow: () => Promise<void>;
  routeChanged: () => void;
  snooze: () => void;
};

let pageController: Controller | null = null;
let onSwActivated: (() => void) | null = null;

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  // One reload listener for the whole page. It only reloads when *we* accepted the
  // update (`accepting`), so the first-install `clients.claim()` never reloads.
  navigator.serviceWorker.addEventListener('controllerchange', () => onSwActivated?.());
}

/**
 * Service-worker registration + update controller.
 *
 * Intentionally **does not** import `virtual:pwa-register/react` — that virtual
 * module is easy to break under a stale Vite process / plugin reload, and the SW
 * is off in normal `vite` serve anyway.
 */
export function useRegisterSW(options: RegisterSWOptions = {}): UseRegisterSWReturn {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  const forceUpdate = useState(false);
  const [, setOfflineReady] = offlineReady;
  const [, setNeedRefresh] = needRefresh;
  const [, setForceUpdate] = forceUpdate;

  // The controller is created once and outlives renders; it reads the latest
  // options through this holder.
  optionsRefStatic.current = options;

  const [controller] = useState<Controller>(() =>
    createController(setNeedRefresh, setOfflineReady)
  );

  const snoozeUpdate = useCallback(() => {
    writeSnooze(nextSnoozeUntil(Date.now()));
    setNeedRefresh(false);
    controller.snooze();
  }, [controller, setNeedRefresh]);

  const markForceUpdate = useCallback(() => setForceUpdate(true), [setForceUpdate]);

  return {
    needRefresh,
    offlineReady,
    forceUpdate,
    updateServiceWorker: controller.acceptUpdate,
    snoozeUpdate,
    checkForUpdate: () => void controller.checkNow(),
    notifyRouteChange: controller.routeChanged,
    markForceUpdate,
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

/** Sheets/Dialogs render `role="dialog"` with `data-state="open"` while mounted. */
function isOverlayOpen(): boolean {
  try {
    return Boolean(
      document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-pwa-overlay="open"]'
      )
    );
  } catch {
    return false;
  }
}

function createController(
  setNeedRefresh: Dispatch<SetStateAction<boolean>>,
  setOfflineReady: Dispatch<SetStateAction<boolean>>
): Controller {
  if (!shouldRegisterServiceWorker()) {
    const noop: Controller = {
      acceptUpdate: async () => {},
      checkNow: async () => {},
      routeChanged: () => {},
      snooze: () => {},
    };
    pageController = noop;
    return noop;
  }

  let sendSkipWaiting: (() => void) | undefined;
  let registration: ServiceWorkerRegistration | null = null;
  let lastCheckAt = 0;
  let waiting = false;
  let accepting = false;
  let channel: BroadcastChannel | null = null;
  let hiddenSince: number | null = null;

  const guard = (): UpdateGuardSnapshot => {
    const base = optionsRefStatic.current.getGuardSnapshot?.() ?? EMPTY_GUARD;
    return { ...base, overlayOpen: base.overlayOpen || isOverlayOpen() };
  };

  const post = (message: UpdateBroadcast) => {
    try {
      channel?.postMessage(message);
    } catch {
      // channel closed / unsupported — single-tab behaviour still works
    }
  };

  const reveal = () => {
    if (isSnoozed(readSnooze(), Date.now())) return;
    setNeedRefresh(true);
    optionsRefStatic.current.onNeedRefresh?.();
  };

  const accept = async (reloadPage = true): Promise<void> => {
    if (accepting) return;
    if (reloadPage && !canAutoReload(window.sessionStorage)) {
      // Loop guard: never reload again automatically in this tab session.
      return;
    }
    accepting = true;
    post({ type: 'update-applying', nonce: String(Date.now()) });
    sendSkipWaiting?.();
    if (!reloadPage) accepting = false;
  };

  const autoApply = (_reason: string) => {
    if (!waiting || accepting) return;
    if (isSnoozed(readSnooze(), Date.now())) return;
    if (!canAutoReload(window.sessionStorage)) {
      reveal();
      return;
    }
    if (!canApplyNow(guard())) {
      reveal();
      return;
    }
    void accept(true);
  };

  const checkNow = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastCheckAt < UPDATE_CHECK_MIN_INTERVAL_MS) return;
    lastCheckAt = now;
    try {
      await registration?.update();
    } catch {
      // offline / server hiccup — the next foreground retries
    }
  };

  const markWaiting = () => {
    waiting = true;
    reveal();
    post({ type: 'update-ready', nonce: String(Date.now()) });
    autoApply('waiting');
  };

  onSwActivated = () => {
    if (!accepting) return;
    accepting = false;
    reloadForActivation();
  };

  void (async () => {
    try {
      const { Workbox } = await import('workbox-window');
      const url = swScriptUrl();
      const wb = new Workbox(url, {
        scope: '/',
        type: import.meta.env.DEV ? 'module' : 'classic',
      });

      sendSkipWaiting = () => {
        wb.messageSkipWaiting();
        void wb.messageSW({ type: SW_MESSAGE.SKIP_WAITING });
      };

      wb.addEventListener('waiting', markWaiting);

      wb.addEventListener('installed', (event) => {
        if (!event.isUpdate) {
          setOfflineReady(true);
          optionsRefStatic.current.onOfflineReady?.();
        }
      });

      const registered = await wb.register({ immediate: optionsRefStatic.current.immediate ?? true });
      registration = registered ?? null;
      optionsRefStatic.current.onRegisteredSW?.(url, registered);
      optionsRefStatic.current.onRegistered?.(registered);

      // Cold start: an update may already be waiting from a previous session.
      if (registered?.waiting && !navigator.serviceWorker.controller) {
        // First ever install — nothing to prompt about.
      } else if (registered?.waiting) {
        markWaiting();
      }

      try {
        channel = new BroadcastChannel(UPDATE_CHANNEL);
        channel.onmessage = (event: MessageEvent) => {
          const message = parseUpdateBroadcast(event.data);
          if (!message) return;
          if (message.type === 'update-ready') {
            waiting = true;
            reveal();
            return;
          }
          if (message.type === 'update-applying') {
            // Another tab accepted the update: reload only when this tab is clean,
            // otherwise let the user finish and show the prompt afterwards.
            waiting = true;
            if (!accepting && canApplyNow(guard()) && canAutoReload(window.sessionStorage)) {
              accepting = true;
              reloadForActivation();
            } else {
              reveal();
            }
          }
        };
      } catch {
        // BroadcastChannel unsupported (Safari < 15.4) — single-tab behaviour.
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          hiddenSince = Date.now();
          return;
        }
        const awayFor = hiddenSince === null ? 0 : Date.now() - hiddenSince;
        hiddenSince = null;
        void checkNow();
        if (awayFor >= BACKGROUND_APPLY_MS) autoApply('backgrounded');
      });
      window.addEventListener('online', () => void checkNow());
      window.addEventListener('pageshow', (event) => {
        if ((event as PageTransitionEvent).persisted) autoApply('restored');
      });
    } catch (error) {
      optionsRefStatic.current.onRegisterError?.(error);
    }
  })();

  const controller: Controller = {
    acceptUpdate: accept,
    checkNow,
    routeChanged: () => autoApply('route-change'),
    snooze: () => {
      // Nothing else to do: the snooze timestamp is read at every decision point.
    },
  };
  pageController = controller;
  return controller;
}

/**
 * The controller outlives the React tree; options are read through this holder so
 * a re-render never re-registers the worker.
 */
const optionsRefStatic: { current: RegisterSWOptions } = { current: {} };

/** Exposed for the page-level "check for updates" affordance. */
export function checkForPwaUpdate(): void {
  void pageController?.checkNow();
}
