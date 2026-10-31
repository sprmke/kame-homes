import { useCallback, useEffect, useRef, useState } from 'react';

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (t: 'release', cb: () => void) => void;
};

/**
 * Keeps the screen awake while `active` — e.g. a self-service check-in kiosk.
 * The OS drops the lock whenever the tab loses visibility, so we re-acquire it
 * when the tab is shown again. No-ops where the Screen Wake Lock API is absent.
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [held, setHeld] = useState(false);

  const acquire = useCallback(async () => {
    if (sentinelRef.current && !sentinelRef.current.released) return;
    const wl = (
      navigator as Navigator & {
        wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wl) return;
    try {
      const sentinel = await wl.request('screen');
      sentinelRef.current = sentinel;
      setHeld(true);
      // The OS fires `release` on tab hide / power events — reflect it so the
      // visibility handler knows to re-acquire.
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
          setHeld(false);
        }
      });
    } catch {
      setHeld(false);
    }
  }, []);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setHeld(false);
    try {
      await sentinel?.release();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!active) {
      void release();
      return;
    }
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && active) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void release();
    };
  }, [active, acquire, release]);

  return { held };
}
