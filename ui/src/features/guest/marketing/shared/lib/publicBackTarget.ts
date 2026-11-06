export type PublicBackTarget = {
  /** Shown next to the chevron on phone, and as the control's accessible name. */
  label: string;
  /** Where to land when there is no history to pop (shared link, PWA cold start). */
  href: string;
};

/**
 * Root destinations. These are reachable from the bottom tab bar, so they show
 * the brand and never a back control.
 */
const ROOT_PATHS = new Set([
  '/',
  '/properties',
  '/parkings',
  '/developments',
  '/search',
  '/for-hosts',
  '/explore-preview',
  '/v2',
]);

/** Longest prefix wins, so `/parkings/requests/x` resolves before `/parkings`. */
const SECTION_PARENTS: { prefix: string; label: string; href: string }[] = [
  { prefix: '/properties', label: 'Properties', href: '/properties' },
  { prefix: '/parkings', label: 'Parkings', href: '/parkings' },
  { prefix: '/developments', label: 'Developments', href: '/developments' },
  { prefix: '/for-hosts', label: 'For hosts', href: '/for-hosts' },
  { prefix: '/account', label: 'Account', href: '/account/profile' },
];

function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

/**
 * The back target for a public route, or `null` on a root destination.
 *
 * Detail screens mount a `ContextualActionBar` (Reserve, Request parking), which
 * claims the single bottom slot and hides the tab bar. Without this the screen
 * has no navigation at all: the phone header is brand-only and a standalone PWA
 * has no browser back gesture, so a shared link is a dead end.
 */
export function getPublicBackTarget(pathname: string): PublicBackTarget | null {
  const path = normalize(pathname);
  if (ROOT_PATHS.has(path)) return null;

  for (const parent of SECTION_PARENTS) {
    if (path === parent.prefix) continue;
    if (path.startsWith(`${parent.prefix}/`)) {
      // `/account/profile` is the account root; deeper account pages go back to it.
      if (parent.prefix === '/account' && path === parent.href) return { label: 'Home', href: '/' };
      return { label: parent.label, href: parent.href };
    }
  }

  // Standalone pages (legal, support, host public page) fall back to the landing page.
  return { label: 'Home', href: '/' };
}
