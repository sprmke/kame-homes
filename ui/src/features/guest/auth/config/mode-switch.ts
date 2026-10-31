export type AppMode = 'guest' | 'host' | 'admin';

export const ADMIN_MODE_ROOT = '/admin';

const HOST_DASHBOARD_PREFIXES = [
  '/org/',
  '/onboarding',
  '/accept-',
  '/bookings',
  '/finance',
  '/maintenance',
  '/notifications',
  '/settings',
  '/dashboard',
] as const;

/** True when the user is in the signed-in admin shell (not public marketing). */
export function isHostDashboardPath(pathname: string): boolean {
  return HOST_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix)
  );
}

export function getAppModeFromPath(pathname: string): AppMode {
  if (pathname === ADMIN_MODE_ROOT || pathname.startsWith(`${ADMIN_MODE_ROOT}/`)) {
    return 'admin';
  }
  if (pathname.startsWith('/for-hosts') || isHostDashboardPath(pathname)) {
    return 'host';
  }
  return 'guest';
}

const HOST_AUTH_PATHS = ['/for-hosts/login', '/for-hosts/register'] as const;

export function isHostAuthPath(pathname: string): boolean {
  return HOST_AUTH_PATHS.some((path) => pathname === path);
}

/** Target path when switching app mode. */
export function resolveModeSwitchPath(
  mode: AppMode,
  pathname: string,
  orgDashboardHref?: string | null
): string {
  if (mode === 'admin') {
    return ADMIN_MODE_ROOT;
  }
  if (mode === 'host') {
    // When switching from the admin/super-admin context, go to the org dashboard instead of
    // the marketing host landing page.
    const fromAdminContext =
      pathname === ADMIN_MODE_ROOT || pathname.startsWith(`${ADMIN_MODE_ROOT}/`);
    if (fromAdminContext && orgDashboardHref) {
      return orgDashboardHref;
    }
    return '/for-hosts';
  }
  if (isHostAuthPath(pathname)) {
    return '/';
  }
  return '/';
}

export function getModeSwitchHref(mode: AppMode): string {
  if (mode === 'admin') return ADMIN_MODE_ROOT;
  return mode === 'host' ? '/for-hosts' : '/';
}
