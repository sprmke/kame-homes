import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

/**
 * Reset window + admin nested scrollports (`main`, fill-main content).
 * Admin shell keeps `main` mounted across routes, so window-only scroll is a no-op.
 */
export function scrollAdminViewToTop(behavior: ScrollBehavior = 'auto') {
  window.scrollTo({ top: 0, left: 0, behavior });

  if (typeof document === 'undefined') return;

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  for (const el of document.querySelectorAll<HTMLElement>('main, [data-admin-content-scroll]')) {
    if (el.scrollTop !== 0) {
      el.scrollTo({ top: 0, behavior });
    }
  }
}

/**
 * Scroll to top whenever the route changes.
 * Place inside the Router; renders nothing.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollAdminViewToTop(reducedMotion ? 'auto' : 'smooth');
  }, [pathname]);

  return null;
}
