import { useCallback, useRef, useState } from 'react';

/** Pauses autosave while templates or external editor state are being applied. */
export function useMarketingAutoSaveSuspension(initialSuspended = true) {
  const depthRef = useRef(0);
  const [suspended, setSuspended] = useState(initialSuspended);

  const begin = useCallback(() => {
    depthRef.current += 1;
    setSuspended(true);
  }, []);

  const end = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSuspended(false);
        });
      });
    }
  }, []);

  return { suspended, begin, end };
}
