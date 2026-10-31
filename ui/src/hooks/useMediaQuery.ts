import { useEffect, useState } from 'react';

/**
 * Subscribes to `window.matchMedia` and updates when the query result changes
 * (resize, orientation, devtools device toolbar) without a page refresh.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Matches Tailwind `sm` — phone-tier (below 640px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 639px)');
}

/** Matches Tailwind `md` — below 768px uses compact mobile booking detail layout. */
export function useIsBelowMd(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/** Matches Tailwind `lg` — below 1024px is treated as mobile/tablet bookings layout. */
export function useIsBelowLg(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

/** Matches Tailwind `xl` — below 1280px keeps finance controls stacked / wrapped. */
export function useIsBelowXl(): boolean {
  return useMediaQuery('(max-width: 1279px)');
}

/** True when the user has requested reduced motion at the OS level. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
