import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocation } from 'react-router-dom';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { getLastOrgSlug } from '@/features/dashboard/org/lib/tenantPaths';

import { useUnsavedChangesContext } from '@/components/forms/unsavedChangesContext';
import { getPwaCapabilities } from '@/lib/pwa/capabilities';
import {
  evaluateInstallEligibility,
  type InstallEligibility,
} from '@/lib/pwa/installEligibility';
import {
  markDontAskAgain,
  readInstallMemory,
  recordInstallDismissal,
} from '@/lib/pwa/installMemory';
import { markHostInstall, hasHostInstall } from '@/lib/pwa/installMemory';
import {
  canPromptInstall,
  hasInstalledRelatedApp,
  subscribeInstallPrompt,
  wasAppInstalled,
} from '@/lib/pwa/installPrompt';
import { detectPlatform } from '@/lib/pwa/platform';
import { activePwaSurface, usePwaSurfaceStore } from '@/lib/pwa/pwaSurfaceStore';


const RECHECK_INTERVAL_MS = 20_000;

/** Session-scoped so a re-evaluation on every route change cannot re-offer. */
let offeredThisSession = false;

type ViewerRole = 'anonymous' | 'guest' | 'host' | 'staff';

function resolveViewerRole(status: 'loading' | 'signed-out' | 'not-admin' | 'admin'): ViewerRole {
  if (status !== 'admin') return 'anonymous';
  // Both hosts and guests sign in through Supabase Auth; the durable host signal is
  // "this device has had an org context". `NotificationsProvider` sets the flag as
  // soon as a host reaches a dashboard, and the launch resolver sets it too.
  if (hasHostInstall() && getLastOrgSlug()) return 'host';
  return 'guest';
}

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

export type InstallOfferState = {
  /** Engine output for the current moment. */
  decision: InstallEligibility;
  /** True when the sheet/chip should be on screen right now. */
  visible: boolean;
  /** Dismiss the offer (records history + cooldown). */
  dismiss: () => void;
  /** "Don't ask again" from the sheet. */
  dismissForever: () => void;
  /** Mark the offer as answered after a successful install. */
  complete: () => void;
};

/**
 * Evaluates install eligibility for the current route/viewer and keeps it fresh
 * without polling a network. Surfaces render `decision`; they never decide.
 */
export function useInstallOffer(options: { hasUpcomingTrip?: boolean } = {}): InstallOfferState {
  const location = useLocation();
  const { status } = useAdminSession();
  const unsaved = useUnsavedChangesContext();
  const claimed = usePwaSurfaceStore((s) => s.claimed);

  const [installedRelatedApp, setInstalledRelatedApp] = useState(false);
  const [promptAvailable, setPromptAvailable] = useState(canPromptInstall);
  const [dismissedHere, setDismissedHere] = useState(false);
  const [tick, setTick] = useState(0);
  const firstViewRef = useRef(!offeredThisSession);
  const role = resolveViewerRole(status);

  // `beforeinstallprompt` can arrive after first paint.
  useEffect(() => subscribeInstallPrompt(() => setPromptAvailable(canPromptInstall())), []);

  useEffect(() => {
    let active = true;
    void hasInstalledRelatedApp().then((value) => {
      if (active) setInstalledRelatedApp(value);
    });
    return () => {
      active = false;
    };
  }, []);

  // A host context on this device is what makes later launches go to host login.
  useEffect(() => {
    if (role === 'host') markHostInstall();
  }, [role]);

  // Decide once the first page view has been left behind (route change or 8 s).
  useEffect(() => {
    if (!firstViewRef.current) return;
    const timer = window.setTimeout(() => {
      firstViewRef.current = false;
      setTick((n) => n + 1);
    }, 8000);
    const onRoute = () => {
      firstViewRef.current = false;
      window.clearTimeout(timer);
      setTick((n) => n + 1);
    };
    window.addEventListener('popstate', onRoute);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onRoute);
    };
  }, []);

  // Route change ends the "first page view" state too.
  useEffect(() => {
    if (!firstViewRef.current) return;
    firstViewRef.current = false;
    setTick((n) => n + 1);
  }, [location.pathname, location.search]);

  // Re-evaluate while the tab is visible (cooldowns expire, engagement grows).
  useEffect(() => {
    if (dismissedHere) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    }, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [dismissedHere]);

  const caps = getPwaCapabilities();
  const platform = detectPlatform({
    ua: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    platform: typeof navigator === 'undefined' ? '' : navigator.platform,
    maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
  });

  const activeSurface = activePwaSurface(claimed);

  const decision = evaluateInstallEligibility({
    platform,
    pathname: location.pathname,
    standalone: caps.standalone,
    swSupported: caps.serviceWorker,
    nativePromptAvailable: promptAvailable,
    installedRelatedApp,
    appInstalledSeen: wasAppInstalled(),
    viewer: {
      role,
      hasOrg: role === 'host',
      // The inline guest card is owned by the trips page itself
      // (`InstallInlineCard`), so the global surface never claims it.
      hasUpcomingTrip:
        options.hasUpcomingTrip === true && location.pathname.startsWith('/account/trips'),
    },
    memory: readInstallMemory(),
    ui: {
      firstPageViewOfSession: firstViewRef.current,
      dirtyForm: unsaved?.registry.hasBlocking() ?? false,
      overlayOpen: isOverlayOpen(),
      anotherSurfaceVisible: activeSurface !== null && activeSurface !== 'install',
    },
    now: Date.now(),
  });

  const visible = decision.show && !dismissedHere && !offeredThisSession;

  // Marking "shown" here (not on dismiss) is what stops the offer re-appearing on
  // the next route change within the same session.
  useEffect(() => {
    if (visible) offeredThisSession = true;
  }, [visible]);

  const dismiss = useCallback(() => {
    recordInstallDismissal();
    offeredThisSession = true;
    setDismissedHere(true);
  }, []);

  const dismissForever = useCallback(() => {
    markDontAskAgain();
    recordInstallDismissal();
    offeredThisSession = true;
    setDismissedHere(true);
  }, []);

  void tick;

  return {
    decision,
    visible,
    dismiss,
    dismissForever,
    complete: () => {
      offeredThisSession = true;
      setDismissedHere(true);
    },
  };
}
