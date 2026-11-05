import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminEdgeFetchError } from '@/lib/api/adminEdgeFetch';

vi.mock('./capture', () => ({ captureError: vi.fn(() => 'event-id') }));

const { captureError } = await import('./capture');
const { reportQueryError } = await import('./reportQueryError');

const captureMock = vi.mocked(captureError);

function edgeError(status: number, requestId: string | null = null) {
  return new AdminEdgeFetchError('boom', status, false, null, requestId);
}

describe('reportQueryError', () => {
  beforeEach(() => {
    captureMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a 5xx with status and request id tags', () => {
    reportQueryError(edgeError(500, 'req-1'), 'query', ['bookings', 'org-1']);

    expect(captureMock).toHaveBeenCalledTimes(1);
    const [, options] = captureMock.mock.calls[0]!;
    expect(options?.tags).toMatchObject({ error_kind: 'query', http_status: '500', request_id: 'req-1' });
    // First key segment only: the org id must not become part of the fingerprint.
    expect(options?.tags?.query_key_root).toBe('bookings');
    expect(options?.fingerprint).toEqual(['query', 'bookings', '5xx']);
  });

  it('does not report a 4xx - the handler answered correctly', () => {
    for (const status of [400, 404, 409, 429]) {
      reportQueryError(edgeError(status), 'query', ['bookings']);
    }
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('does not report a 401 - the auth flow owns it', () => {
    reportQueryError(edgeError(401), 'mutation', ['bookings']);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('does not report an aborted request', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    reportQueryError(abort, 'query', ['bookings']);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('does not report while offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    reportQueryError(new TypeError('Failed to fetch'), 'query', ['bookings']);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('reports a network failure while online', () => {
    vi.stubGlobal('navigator', { onLine: true });
    reportQueryError(new TypeError('Failed to fetch'), 'query', ['bookings']);
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0]?.[1]?.fingerprint).toEqual(['query', 'bookings', 'thrown']);
  });

  it('reports a 0 status while online', () => {
    vi.stubGlobal('navigator', { onLine: true });
    reportQueryError(edgeError(0), 'mutation', ['save-booking']);
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0]?.[1]?.fingerprint).toEqual(['mutation', 'save-booking', 'network']);
  });

  it('honours the meta opt-out for endpoints allowed to fail', () => {
    reportQueryError(edgeError(503), 'query', ['health-poll'], { sentry: false });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('keeps distinct mutation messages in separate issues when there is no key', () => {
    reportQueryError(new Error('ids is not iterable'), 'mutation', undefined);
    reportQueryError(new Error('booking_rate must be a number'), 'mutation', undefined);
    reportQueryError(new Error('booking 04bc05fc-11e3-4770-bc1a-b5ef128e59b1 is locked'), 'mutation', undefined);

    const fingerprints = captureMock.mock.calls.map(([, options]) => options?.fingerprint);
    expect(fingerprints[0]).toEqual(['mutation', 'ids is not iterable', 'thrown']);
    expect(fingerprints[1]).toEqual(['mutation', 'booking_rate must be a number', 'thrown']);
    // Volatile ids are normalised so the same failure keeps grouping.
    expect(fingerprints[2]).toEqual(['mutation', 'booking <id> is locked', 'thrown']);
  });

  it('reports one error object once, even when two hooks see it', () => {
    const error = edgeError(500);
    reportQueryError(error, 'query', ['bookings']);
    reportQueryError(error, 'mutation', ['bookings']);
    expect(captureMock).toHaveBeenCalledTimes(1);
  });
});
