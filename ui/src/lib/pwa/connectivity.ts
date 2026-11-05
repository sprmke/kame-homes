import { create } from 'zustand';

/**
 * Three-state connectivity.
 *
 * `navigator.onLine` only means "an interface is up". On a captive portal, a
 * dead Wi-Fi hotspot or a flaky mobile link it stays `true` while every request
 * fails — the "lie-fi" case that made v1 show online-only buttons that silently
 * did nothing (P1-7 / 5.1).
 *
 * There is no polling: the state is driven by real request outcomes, so it costs
 * nothing when the app is idle.
 */
export type ConnectivityStatus = 'online' | 'offline' | 'degraded';

type ConnectivityState = {
  status: ConnectivityStatus;
  /** Consecutive failed requests while the browser believed it was online. */
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  /** Set when the browser went offline; used to detect a real reconnect. */
  wentOfflineAt: number | null;
};

export const useConnectivityStore = create<ConnectivityState>(() => ({
  status: typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline',
  consecutiveFailures: 0,
  lastSuccessAt: null,
  wentOfflineAt: null,
}));

/** A response (any status) counts as reachable — the server answered. */
export function reportNetworkSuccess(now = Date.now()): void {
  const state = useConnectivityStore.getState();
  if (state.status === 'online' && state.consecutiveFailures === 0) {
    useConnectivityStore.setState({ lastSuccessAt: now });
    return;
  }
  useConnectivityStore.setState({
    status: 'online',
    consecutiveFailures: 0,
    lastSuccessAt: now,
    wentOfflineAt: null,
  });
}

/**
 * A request failed at the transport layer. If the browser still claims to be
 * online, this is `degraded` (lie-fi); if it is offline, stay offline.
 */
export function reportNetworkFailure(): void {
  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const state = useConnectivityStore.getState();
  useConnectivityStore.setState({
    status: browserOffline ? 'offline' : 'degraded',
    consecutiveFailures: state.consecutiveFailures + 1,
  });
}

/** `true` for `TypeError: Failed to fetch` and friends — never a 4xx/5xx. */
export function isTransportFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('load failed') ||
    message.includes('networkerror') ||
    message.includes('the internet connection appears to be offline')
  );
}

let wired = false;

/** Call once at app start. Idempotent. */
export function initConnectivityListeners(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;

  const goOffline = () => {
    useConnectivityStore.setState({
      status: 'offline',
      wentOfflineAt: Date.now(),
      consecutiveFailures: 0,
    });
  };
  const goOnline = () => {
    // Optimistic: the first successful request confirms it (see reportNetworkSuccess).
    const state = useConnectivityStore.getState();
    if (state.status === 'offline') {
      useConnectivityStore.setState({ status: state.consecutiveFailures > 0 ? 'degraded' : 'online' });
      return;
    }
    if (state.status === 'degraded') return;
    useConnectivityStore.setState({ status: 'online' });
  };

  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);
  if (navigator.onLine === false) goOffline();
}
