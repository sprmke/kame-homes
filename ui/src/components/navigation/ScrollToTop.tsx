import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import {
  applyScrollPosition,
  consumeScrollPosition,
  isReloadNavigation,
  saveScrollPosition,
} from '@/lib/pwa/scrollMemory';

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
 *
 * A build that applies a service-worker update reloads the same path; the scroll
 * offsets saved on `pagehide` are restored once so the update does not lose the
 * operator's place in a list (PWA v2 task 4.5).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Only a reload restores: the update controller reloads the same URL, and the
    // operator should stay where they were in the list.
    const saved = isReloadNavigation() ? consumeScrollPosition(pathname) : null;
    if (saved) {
      applyScrollPosition(saved);
      return;
    }
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollAdminViewToTop(reducedMotion ? 'auto' : 'smooth');
  }, [pathname]);

  useEffect(() => {
    const save = () => saveScrollPosition(window.location.pathname);
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, []);

  return null;
}
