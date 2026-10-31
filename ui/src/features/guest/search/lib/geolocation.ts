export type GeolocationResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' };

/**
 * Request browser geolocation once. Used for Nearby search.
 * Never throws — callers branch on `ok`.
 */
export function requestGuestGeolocation(options?: {
  timeoutMs?: number;
}): Promise<GeolocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }

  const timeoutMs = options?.timeoutMs ?? 12_000;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ok: false, reason: 'denied' });
          return;
        }
        if (error.code === error.TIMEOUT) {
          resolve({ ok: false, reason: 'timeout' });
          return;
        }
        resolve({ ok: false, reason: 'unavailable' });
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 60_000,
      }
    );
  });
}
