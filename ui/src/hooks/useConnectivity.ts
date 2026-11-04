import { useConnectivityStore, type ConnectivityStatus } from '@/lib/pwa/connectivity';

export type Connectivity = {
  status: ConnectivityStatus;
  /** `false` for both `offline` and `degraded` — a request will not succeed. */
  connected: boolean;
  /** Short reason to show inline next to a disabled action. */
  reason: string | null;
};

/**
 * Connectivity for action-level gating: online-only buttons disable themselves and
 * say why instead of failing with a generic error (5.4).
 */
export function useConnectivity(): Connectivity {
  const status = useConnectivityStore((s) => s.status);
  return {
    status,
    connected: status === 'online',
    reason:
      status === 'offline'
        ? 'You are offline.'
        : status === 'degraded'
          ? 'No internet connection.'
          : null,
  };
}
