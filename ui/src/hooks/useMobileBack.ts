import { useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

/**
 * Back handler that never dead-ends.
 *
 * Pops history when this entry was reached from inside the app, and otherwise
 * navigates to `fallbackHref`. The fallback is what makes a shared link or a
 * standalone PWA cold start work: both open with no history to pop, and a
 * standalone PWA has no browser back gesture to fall back on.
 *
 * React Router records a position in `history.state.idx`; index 0 means this is
 * the first entry we own, so there is nothing of ours to go back to.
 */
export function useMobileBack(fallbackHref: string): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackHref, { replace: true });
  }, [navigate, fallbackHref]);
}
