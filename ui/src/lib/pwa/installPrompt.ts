/**
 * Captures the Chromium `beforeinstallprompt` event (fires once, early) so the
 * app can offer a custom "Install" affordance later. Import for side effect from
 * `main.tsx` so the listener is attached before the event fires.
 */

import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

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
    pwaTelemetry('installed');
    emit();
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null && !installed;
}

export function subscribeInstallPrompt(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Show the native install dialog. Returns the user's choice. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const evt = deferred;
  deferred = null;
  emit();
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    pwaTelemetry('install-prompt-outcome', { outcome });
    return outcome;
  } catch {
    return 'dismissed';
  }
}
