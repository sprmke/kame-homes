import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';


import { useQueryClient } from '@tanstack/react-query';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { useOfflineSyncStore } from '@/features/dashboard/offline/store/offlineSyncStore';

import { useUnsavedChangesContext } from '@/components/forms/unsavedChangesContext';
import { FirstLaunchWelcome } from '@/components/pwa/FirstLaunchWelcome';
import { ForceUpdateSheet } from '@/components/pwa/ForceUpdateSheet';
import { InstallOfferSheet } from '@/components/pwa/InstallOfferSheet';
import { LegacyOriginNotice } from '@/components/pwa/LegacyOriginNotice';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';
import { useInstallOffer } from '@/components/pwa/useInstallOffer';
import { usePwaEnvironment } from '@/components/pwa/usePwaEnvironment';
import { getPwaCapabilities, requestPersistentStorage } from '@/lib/pwa/capabilities';
import { initConnectivityListeners } from '@/lib/pwa/connectivity';
import { hasHostInstall } from '@/lib/pwa/installMemory';
import { purgeOfflineState } from '@/lib/pwa/purgeOfflineState';
import { resyncPushSubscription } from '@/lib/pwa/push';
import {
  activePwaSurface,
  PWA_SURFACE_PRIORITY,
  usePwaSurfaceStore,
} from '@/lib/pwa/pwaSurfaceStore';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { setSwRegistration } from '@/lib/pwa/swRegistration';
import { initSyncEngine } from '@/lib/pwa/syncEngine';
import { useRegisterSW } from '@/lib/pwa/useRegisterSW';
import { captureError } from '@/lib/sentry/capture';
import { supabase } from '@/lib/supabase/client';

import { PERIODIC_REFRESH_TAG, SW_MESSAGE } from '@/pwa/shared';

const SW_UPDATE_POLL_MS = 60 * 60 * 1000; // hourly: re-check for a new deployed SW
const RESUME_REFRESH_MS = 60 * 1000;
const WARM_FLAG_KEY = 'gfm:pwa:host-tier-warmed';

/**
 * Owns the service-worker lifecycle and every PWA surface for the whole app:
 *  - registers the SW, publishes the registration, keeps it updating
 *  - decides when a waiting update may apply (never over unsaved work)
 *  - renders the connectivity strip, update prompt, force-update sheet,
 *    first-launch welcome and the install offer, one floating surface at a time
 *  - recovers after the app resumes (session, realtime socket, active queries)
 *  - warms the host precache tier after a host signs in
 *
 * Mount once, near the app root, inside the router + query providers.
 */
export function PwaProvider() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const unsaved = useUnsavedChangesContext();
  const { status: adminStatus } = useAdminSession();
  const { platform, standalone } = usePwaEnvironment();
  const installOffer = useInstallOffer();
  const claimed = usePwaSurfaceStore((s) => s.claimed);
  const [killed, setKilled] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const swUpdatePollIdRef = useRef<number | null>(null);
  const hiddenSinceRef = useRef<number | null>(null);

  const activeSurface = activePwaSurface(claimed);

  // ── service worker lifecycle ──────────────────────────────────────────────
  const {
    needRefresh: [needRefresh],
    forceUpdate: [forceUpdate],
    updateServiceWorker,
    snoozeUpdate,
    markForceUpdate,
    notifyRouteChange,
  } = useRegisterSW({
    getGuardSnapshot: () => ({
      dirtyGuards: unsaved?.registry.hasBlocking() ? 1 : 0,
      overlayOpen: false, // filled in by the controller's DOM probe
      outboxDraining: useOfflineSyncStore.getState().syncing,
      taskInFlight: false,
    }),
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      setSwRegistration(registration);
      // Poll for a freshly deployed SW while the app stays open. Clear any prior
      // interval first — `onRegisteredSW` can fire more than once and would
      // otherwise stack.
      if (swUpdatePollIdRef.current != null) window.clearInterval(swUpdatePollIdRef.current);
      swUpdatePollIdRef.current = window.setInterval(() => {
        registration.update().catch(() => {});
      }, SW_UPDATE_POLL_MS);
    },
    onRegisterError(error) {
      // eslint-disable-next-line no-console
      console.error('[pwa] service worker registration failed', error);
      // Automated browsers (Playwright, Lighthouse) block service worker registration. That
      // is the harness, not a dead worker for a real user, and it can never be fixed here.
      if (typeof navigator !== 'undefined' && navigator.webdriver) return;
      // A dead service worker silently loses push notifications and offline reads for this
      // user until they clear site data. Nothing else reports it.
      captureError(error, {
        level: 'warning',
        tags: { runtime: 'service_worker' },
        fingerprint: ['service_worker', 'registration'],
      });
    },
  });

  useEffect(() => {
    return () => {
      if (swUpdatePollIdRef.current != null) {
        window.clearInterval(swUpdatePollIdRef.current);
        swUpdatePollIdRef.current = null;
      }
    };
  }, []);

  // Route changes are the safest auto-apply point for a waiting update.
  useEffect(() => {
    notifyRouteChange();
  }, [location.pathname, location.search, notifyRouteChange]);

  // ── boot: connectivity model + offline outbox ────────────────────────────
  useEffect(() => {
    initConnectivityListeners();
  }, []);

  useEffect(() => {
    initSyncEngine(queryClient);
  }, [queryClient]);

  // ── SW → app messages ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; path?: string; keys?: string[]; markReadId?: string }
        | undefined;
      if (!data?.type) return;

      if (data.type === SW_MESSAGE.KILLED) {
        setKilled(true);
        pwaTelemetry('kill-switch');
        void purgeOfflineState().finally(() => {
          window.location.reload();
        });
        return;
      }
      if (data.type === SW_MESSAGE.FORCE_UPDATE) {
        markForceUpdate();
        return;
      }
      if (data.type === SW_MESSAGE.NOTIFICATION_CLICK && data.path) {
        // Only same-origin, app-relative targets (belt-and-suspenders — the SW
        // already sanitises before posting).
        if (data.path.startsWith('/') && !data.path.startsWith('//')) navigate(data.path);
        return;
      }
      if (data.type === SW_MESSAGE.PUSH_RESYNC) {
        void resyncPushSubscription();
        return;
      }
      if (data.type === SW_MESSAGE.REVALIDATE && Array.isArray(data.keys)) {
        for (const key of data.keys) void queryClient.invalidateQueries({ queryKey: [key] });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate, queryClient, markForceUpdate]);

  // ── resume: session, realtime socket, active queries (5.5) ──────────────
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') hiddenSinceRef.current = Date.now();
    };
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const awayFor = hiddenSinceRef.current === null ? 0 : Date.now() - hiddenSinceRef.current;
      hiddenSinceRef.current = null;
      if (awayFor < RESUME_REFRESH_MS) return;
      try {
        // iOS drops sockets and lets tokens expire in the background; refresh both
        // before touching any data.
        await supabase.auth.getSession();
        supabase.realtime.connect();
      } catch {
        // offline: the next successful request repairs the session
      }
      await queryClient.invalidateQueries({ refetchType: 'active' });
    };
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queryClient]);

  // Fast update + kill-switch reaction whenever the app is foregrounded.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      registrationRef.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

  // ── durable storage ──────────────────────────────────────────────────────
  // Asked for when the user is committed (installed, or notifications granted) so a
  // casual browser visit is never prompted; Firefox is the only engine that shows a
  // prompt here, Chromium/Safari decide silently.
  useEffect(() => {
    const committed =
      standalone ||
      (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    if (!committed) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(() => void requestPersistentStorage());
    else window.setTimeout(() => void requestPersistentStorage(), 3000);
  }, [standalone]);

  // ── periodic background sync (Chromium installed) ────────────────────────
  useEffect(() => {
    if (!getPwaCapabilities().periodicSync) return;
    const id = window.setTimeout(async () => {
      try {
        const status = await navigator.permissions?.query({
          name: 'periodic-background-sync' as PermissionName,
        });
        if (status && status.state !== 'granted') return;
        await (
          registrationRef.current as unknown as {
            periodicSync?: { register: (t: string, o: { minInterval: number }) => Promise<void> };
          }
        )?.periodicSync?.register(PERIODIC_REFRESH_TAG, { minInterval: 6 * 60 * 60 * 1000 });
      } catch {
        // unsupported / denied — no-op
      }
    }, 5000);
    return () => window.clearTimeout(id);
  }, []);

  // ── host precache warming (1.6 / 1.8 / D8) ───────────────────────────────
  const warmHostTier = useCallback(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      if (window.sessionStorage.getItem(WARM_FLAG_KEY) === '1') return;
    } catch {
      // ignore
    }
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return;
    // Only a host device (or an install) is worth the background download.
    if (!standalone && !hasHostInstall()) return;
    navigator.serviceWorker.controller?.postMessage({ type: SW_MESSAGE.WARM_HOST_TIER });
    try {
      window.sessionStorage.setItem(WARM_FLAG_KEY, '1');
    } catch {
      // ignore
    }
  }, [standalone]);

  useEffect(() => {
    if (adminStatus !== 'admin') return;
    const id = window.setTimeout(warmHostTier, 8000);
    return () => window.clearTimeout(id);
  }, [adminStatus, warmHostTier]);

  if (killed) return null;

  // A higher-priority surface (offline strip, kill notice) owns the screen; the
  // update prompt waits instead of stacking on top of it.
  const higherPrioritySurface =
    activeSurface !== null && PWA_SURFACE_PRIORITY[activeSurface] > PWA_SURFACE_PRIORITY.update;
  const updateVisible = needRefresh && !higherPrioritySurface;

  return (
    <>
      <OfflineBanner />
      {forceUpdate ? (
        <ForceUpdateSheet onUpdate={() => void updateServiceWorker(true)} />
      ) : needRefresh && updateVisible ? (
        <UpdatePrompt
          onReload={() => {
            pwaTelemetry('update-applied');
            void updateServiceWorker(true);
          }}
          onLater={snoozeUpdate}
        />
      ) : null}
      <InstallOfferSheet offer={installOffer} platform={platform} />
      <FirstLaunchWelcome />
      <LegacyOriginNotice />
    </>
  );
}
