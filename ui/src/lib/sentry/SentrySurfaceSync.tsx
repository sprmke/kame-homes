import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { setSentrySurface } from './scope';

/**
 * Tags every event with the surface the user was on, reusing the path rules PostHog already
 * applies so an issue and an event describe the same place.
 *
 * Kept separate from `SentryIdentitySync` because this re-runs on navigation and that one
 * must not.
 */
function surfaceFromPath(pathname: string): string {
  if (pathname.startsWith('/admin')) return 'super_admin';
  if (pathname.startsWith('/account')) return 'guest_account';
  if (pathname.includes('/parking/')) return 'parking_dashboard';
  if (pathname.startsWith('/org')) return 'host_dashboard';
  if (
    pathname.startsWith('/properties/') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/form') ||
    pathname.startsWith('/sd-form') ||
    pathname.startsWith('/guest-review') ||
    pathname.startsWith('/bookings/')
  ) {
    return 'guest_ops';
  }
  return 'marketing';
}

export function SentrySurfaceSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    setSentrySurface(surfaceFromPath(pathname));
  }, [pathname]);

  return null;
}
