/**
 * One place that answers "can this browser do X?" for every PWA feature the app
 * touches. UI reads from here — never sniffs the user agent.
 */

export type PwaCapabilities = {
  serviceWorker: boolean;
  /** `beforeinstallprompt` fires (Chromium). iOS never fires it — see `isIos`. */
  installPrompt: boolean;
  push: boolean;
  notifications: boolean;
  badging: boolean;
  backgroundSync: boolean;
  periodicSync: boolean;
  share: boolean;
  shareFiles: boolean;
  wakeLock: boolean;
  persistentStorage: boolean;
  storageEstimate: boolean;
  /** Running as an installed app (home-screen / desktop window). */
  standalone: boolean;
  isIos: boolean;
  isSafari: boolean;
};

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'];
  const mql = displayModes.some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  // iOS Safari exposes navigator.standalone instead of matching display-mode.
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mql || iosStandalone;
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac; disambiguate with touch points.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
}

export function getPwaCapabilities(): PwaCapabilities {
  const hasWindow = typeof window !== 'undefined';
  const hasNav = typeof navigator !== 'undefined';
  const sw = hasNav && 'serviceWorker' in navigator;

  return {
    serviceWorker: sw,
    installPrompt: hasWindow && 'onbeforeinstallprompt' in window,
    push: sw && 'PushManager' in window,
    notifications: hasWindow && 'Notification' in window,
    badging: hasNav && 'setAppBadge' in navigator,
    backgroundSync:
      sw &&
      typeof ServiceWorkerRegistration !== 'undefined' &&
      'sync' in ServiceWorkerRegistration.prototype,
    periodicSync:
      sw &&
      typeof ServiceWorkerRegistration !== 'undefined' &&
      'periodicSync' in ServiceWorkerRegistration.prototype,
    share: hasNav && 'share' in navigator,
    shareFiles: hasNav && 'canShare' in navigator,
    wakeLock: hasNav && 'wakeLock' in navigator,
    persistentStorage: hasNav && !!navigator.storage && 'persist' in navigator.storage,
    storageEstimate: hasNav && !!navigator.storage && 'estimate' in navigator.storage,
    standalone: isStandalone(),
    isIos: isIos(),
    isSafari: isSafari(),
  };
}

/** Request durable storage so the offline cache + outbox survive eviction. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}
