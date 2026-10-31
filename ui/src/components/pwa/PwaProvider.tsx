import { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';

import { useOfflineSync } from '@/features/dashboard/offline/hooks/useOfflineSync';

import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPwaCapabilities, isStandalone, requestPersistentStorage } from '@/lib/pwa/capabilities';
import { purgeOfflineState } from '@/lib/pwa/purgeOfflineState';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { pingVersionCheck, setSwRegistration } from '@/lib/pwa/swRegistration';
import { initSyncEngine } from '@/lib/pwa/syncEngine';
import { useRegisterSW } from '@/lib/pwa/useRegisterSW';

import { SW_MESSAGE } from '@/pwa/shared';

const SW_UPDATE_POLL_MS = 60 * 60 * 1000; // hourly: re-check for a new deployed SW

/**
 * Owns the service-worker lifecycle for the whole app:
 *  - registers the SW and publishes the registration to `swRegistration`
 *  - polls for new deployments and surfaces a non-blocking update prompt
 *  - renders the offline / sync banner
 *  - reacts to the SW kill-switch (`KILLED`) by purging caches + hard-reloading
 *  - requests durable storage so offline data isn't evicted
 *
 * Mount once, near the app root, inside the router + query providers.
 */
export function PwaProvider() {
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const { pendingCount, syncing } = useOfflineSync();
  const [killed, setKilled] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const swUpdatePollIdRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  // Belt-and-suspenders: clear the SW-update poll interval on unmount even though
  // this component is meant to mount once near the app root.
  useEffect(() => {
    return () => {
      if (swUpdatePollIdRef.current != null) {
        window.clearInterval(swUpdatePollIdRef.current);
        swUpdatePollIdRef.current = null;
      }
    };
  }, []);

  // Offline write queue — listeners for online/foreground/background-sync + an
  // initial drain.
  useEffect(() => {
    initSyncEngine(queryClient);
  }, [queryClient]);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      setSwRegistration(registration);
      // Poll for a freshly deployed SW while the app stays open. Clear any prior
      // interval first — `onRegisteredSW` can fire more than once (React Strict
      // Mode double-invoke, or a rare re-registration) and would otherwise stack.
      if (swUpdatePollIdRef.current != null) window.clearInterval(swUpdatePollIdRef.current);
      swUpdatePollIdRef.current = window.setInterval(() => {
        registration.update().catch(() => {});
      }, SW_UPDATE_POLL_MS);
    },
    onRegisterError(error) {
      // eslint-disable-next-line no-console
      console.error('[pwa] service worker registration failed', error);
    },
  });

  // Service-worker → app messages: kill-switch, push-notification click-through,
  // and cache revalidation. Handled here (mounted app-wide inside the router) so
  // a push click navigates regardless of which surface the open tab is on.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string; keys?: string[] } | undefined;
      if (data?.type === SW_MESSAGE.KILLED) {
        setKilled(true);
        pwaTelemetry('kill-switch');
        void purgeOfflineState().finally(() => {
          window.location.reload();
        });
      } else if (data?.type === SW_MESSAGE.NOTIFICATION_CLICK && data.path) {
        // Only same-origin, app-relative targets (belt-and-suspenders — the SW
        // already sanitises before posting).
        if (data.path.startsWith('/') && !data.path.startsWith('//')) navigate(data.path);
      } else if (data?.type === SW_MESSAGE.REVALIDATE && Array.isArray(data.keys)) {
        for (const key of data.keys) void queryClient.invalidateQueries({ queryKey: [key] });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate, queryClient]);

  // Fast update + kill-switch reaction whenever the app is foregrounded.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      pingVersionCheck();
      registrationRef.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

  // Ask for durable storage once the app is idle — but only for a committed
  // operator (installed, or has granted notifications), so a casual browser visit
  // is never nagged (Firefox is the only engine that prompts here; Chromium /
  // Safari decide silently).
  useEffect(() => {
    const committed =
      isStandalone() ||
      (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    if (!committed) return;
    const run = () => {
      void requestPersistentStorage();
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run);
    else window.setTimeout(run, 3000);
  }, []);

  // Periodic Background Sync (Chromium installed) — background cache refresh.
  useEffect(() => {
    if (!getPwaCapabilities().periodicSync) return;
    const id = window.setTimeout(async () => {
      try {
        const reg = registrationRef.current;
        const status = await navigator.permissions?.query({
          name: 'periodic-background-sync' as PermissionName,
        });
        if (status && status.state !== 'granted') return;
        await (
          reg as unknown as {
            periodicSync?: { register: (t: string, o: { minInterval: number }) => Promise<void> };
          }
        )?.periodicSync?.register('gfm-periodic-refresh', { minInterval: 6 * 60 * 60 * 1000 });
      } catch {
        // no-op
      }
    }, 5000);
    return () => window.clearTimeout(id);
  }, []);

  if (killed) return null;

  return (
    <>
      <OfflineBanner online={online} pendingCount={pendingCount} syncing={syncing} />
      <InstallPrompt />
      {needRefresh && (
        <UpdatePrompt
          onReload={() => {
            pwaTelemetry('update-applied');
            updateServiceWorker(true);
          }}
        />
      )}
    </>
  );
}
