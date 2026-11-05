import { afterEach, describe, expect, it } from 'vitest';

import {
  isTransportFailure,
  reportNetworkFailure,
  reportNetworkSuccess,
  useConnectivityStore,
} from '@/lib/pwa/connectivity';

function reset() {
  useConnectivityStore.setState({
    status: 'online',
    consecutiveFailures: 0,
    lastSuccessAt: null,
    wentOfflineAt: null,
  });
}

afterEach(reset);

describe('connectivity model', () => {
  it('moves online → degraded when requests fail but the browser is online', () => {
    reportNetworkFailure();
    expect(useConnectivityStore.getState().status).toBe('degraded');
    expect(useConnectivityStore.getState().consecutiveFailures).toBe(1);
  });

  it('recovers to online on the next successful response', () => {
    reportNetworkFailure();
    reportNetworkSuccess(1234);
    const state = useConnectivityStore.getState();
    expect(state.status).toBe('online');
    expect(state.consecutiveFailures).toBe(0);
    expect(state.lastSuccessAt).toBe(1234);
  });

  it('keeps counting consecutive failures', () => {
    reportNetworkFailure();
    reportNetworkFailure();
    expect(useConnectivityStore.getState().consecutiveFailures).toBe(2);
  });

  it('does not churn state on repeated successes', () => {
    reportNetworkSuccess(1);
    reportNetworkSuccess(2);
    expect(useConnectivityStore.getState().lastSuccessAt).toBe(2);
  });
});

describe('isTransportFailure', () => {
  it('recognises network-level errors', () => {
    expect(isTransportFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransportFailure(new Error('Load failed'))).toBe(true);
    expect(isTransportFailure(new Error('network error'))).toBe(true);
    expect(
      isTransportFailure(new Error('The Internet connection appears to be offline.'))
    ).toBe(true);
  });

  it('does not mistake a server rejection for a network problem', () => {
    expect(isTransportFailure(new Error('Request failed'))).toBe(false);
    expect(isTransportFailure(new Error('Your session expired'))).toBe(false);
    expect(isTransportFailure('nope')).toBe(false);
  });
});
