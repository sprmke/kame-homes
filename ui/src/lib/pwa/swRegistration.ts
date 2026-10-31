import { SW_MESSAGE } from '@/pwa/shared';

/**
 * Holds the active ServiceWorkerRegistration once <PwaProvider> has registered it,
 * so non-React modules (push subscribe, sync engine) can reach `pushManager` /
 * `sync` / `periodicSync` without threading it through context.
 */
let current: ServiceWorkerRegistration | null = null;
const waiters: Array<(reg: ServiceWorkerRegistration) => void> = [];

export function setSwRegistration(reg: ServiceWorkerRegistration | null): void {
  current = reg;
  if (reg) {
    while (waiters.length) waiters.shift()?.(reg);
  }
}

export function getSwRegistration(): ServiceWorkerRegistration | null {
  return current;
}

/** Resolves with the registration, waiting for <PwaProvider> if it isn't ready yet. */
export function whenSwReady(timeoutMs = 10_000): Promise<ServiceWorkerRegistration | null> {
  if (current) return Promise.resolve(current);
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(current), timeoutMs);
    waiters.push((reg) => {
      clearTimeout(timer);
      resolve(reg);
    });
  });
}

/** Tell the controlling SW to run its kill-switch check now. */
export function pingVersionCheck(): void {
  navigator?.serviceWorker?.controller?.postMessage({ type: SW_MESSAGE.CHECK_VERSION });
}
