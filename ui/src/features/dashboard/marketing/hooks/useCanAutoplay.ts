import { useEffect, useState } from 'react';

/** Autoplay is off for reduced motion and Data Saver; a poster frame stays instead. */
export function useCanAutoplay(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    );
    const update = () => setAllowed(!saveData && !query?.matches);
    update();
    query?.addEventListener?.('change', update);
    return () => query?.removeEventListener?.('change', update);
  }, []);
  return allowed;
}
