import { useEffect, useState } from 'react';

/**
 * `navigator.onLine` plus `online`/`offline` events. `navigator.onLine` only
 * means "has a network interface", so treat `true` as optimistic — a failing
 * request is still the real signal — but `false` is reliable.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
