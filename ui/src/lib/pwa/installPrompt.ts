/**
 * Captures the Chromium `beforeinstallprompt` event (fires once, early) so the
 * app can offer a custom "Install" affordance later, and remembers an
 * `appinstalled` that already happened in this browser.
 *
 * Imported for side effect from `main.tsx` so the listener is attached before the
 * event can fire.
 */

import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const SESSION_INSTALLED_KEY = 'gfm:install:appinstalled';

let deferred: BeforeInstallPromptEvent | null = null;
let installed = readInstalledFlag();
let prompting = false;
const listeners = new Set<() => void>();

function readInstalledFlag(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeInstalledFlag(): void {
  try {
    window.sessionStorage.setItem(SESSION_INSTALLED_KEY, '1');
  } catch {
    // ignore
  }
}

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    writeInstalledFlag();
    pwaTelemetry('installed');
    emit();
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null && !installed;
}

/** `appinstalled` fired in this browser session (install already happened). */
export function wasAppInstalled(): boolean {
  return installed;
}

export function subscribeInstallPrompt(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * `getInstalledRelatedApps()` where supported (Chromium). Never throws; an
 * unsupported browser just reports `false`.
 */
export async function hasInstalledRelatedApp(): Promise<boolean> {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ platform: string }>>;
  };
  if (typeof nav.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

/**
 * Show the native install dialog. Returns the user's choice.
 * Guarded against a double prompt (two surfaces tapping at once).
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred || prompting) return 'unavailable';
  const evt = deferred;
  prompting = true;
  deferred = null;
  emit();
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    pwaTelemetry('install-prompt-outcome', { outcome });
    return outcome;
  } catch {
    return 'dismissed';
  } finally {
    prompting = false;
  }
}
