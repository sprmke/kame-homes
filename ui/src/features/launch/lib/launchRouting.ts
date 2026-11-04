/**
 * Launch resolver — where the installed app (and every `/app` entry point) lands.
 *
 * Before this existed, the manifest `start_url` was `/?source=pwa`, so every
 * installed app opened the public marketplace, and the Bookings / Inbox /
 * Check-ins shortcuts did nothing outside the dashboard (P0-1).
 *
 * Everything here is pure so the resolution table can be unit-tested; the page
 * (`AppLaunchPage`) supplies session / org / tenant state.
 */

export type LaunchShortcut = 'bookings' | 'inbox' | 'checkins';

export const LAUNCH_PATH = '/app';

const SHORTCUTS: readonly LaunchShortcut[] = ['bookings', 'inbox', 'checkins'];

export function parseLaunchShortcut(raw: string | null | undefined): LaunchShortcut | null {
  if (!raw) return null;
  return (SHORTCUTS as readonly string[]).includes(raw) ? (raw as LaunchShortcut) : null;
}

export type DashboardBase = {
  kind: 'property' | 'parking';
  orgSlug: string;
  listingSlug: string;
};

const PROPERTY_BASE_RE = /^\/org\/([^/]+)\/property\/([^/]+)\/?$/;
const PARKING_BASE_RE = /^\/org\/([^/]+)\/parking\/([^/]+)\/?$/;

/** Recognises a tenant dashboard root (`/org/:org/property/:slug`). */
export function parseDashboardBase(path: string): DashboardBase | null {
  const property = PROPERTY_BASE_RE.exec(path);
  if (property) {
    return { kind: 'property', orgSlug: property[1]!, listingSlug: property[2]! };
  }
  const parking = PARKING_BASE_RE.exec(path);
  if (parking) {
    return { kind: 'parking', orgSlug: parking[1]!, listingSlug: parking[2]! };
  }
  return null;
}

/** Today's check-ins = the bookings list filtered to today's arrival date. */
export function checkinsQuery(todayIso: string): string {
  const params = new URLSearchParams({ from: todayIso, to: todayIso, sort: 'check_in_date:asc' });
  return params.toString();
}

/**
 * Applies a shortcut to a resolved dashboard root. A base that is not a tenant
 * dashboard (onboarding, verification rejected, org hub) is returned unchanged —
 * a shortcut must never skip a required setup step.
 */
export function applyLaunchShortcut(
  basePath: string,
  shortcut: LaunchShortcut | null,
  todayIso: string
): string {
  if (!shortcut) return basePath;
  const base = parseDashboardBase(basePath);
  if (!base) return basePath;
  const root = `/org/${base.orgSlug}/${base.kind === 'property' ? 'property' : 'parking'}/${base.listingSlug}`;
  if (shortcut === 'bookings') return `${root}/bookings`;
  if (shortcut === 'inbox') return `${root}/inbox`;
  return `${root}/bookings?${checkinsQuery(todayIso)}`;
}

/** Host login URL that returns to the launch resolver with the shortcut intact. */
export function launchLoginRedirect(shortcut: LaunchShortcut | null, source: string | null): string {
  const params = new URLSearchParams();
  if (shortcut) params.set('shortcut', shortcut);
  if (source) params.set('source', source);
  const query = params.toString();
  return `/for-hosts/login?redirect=${encodeURIComponent(query ? `${LAUNCH_PATH}?${query}` : LAUNCH_PATH)}`;
}

/** What the resolver can see about the current viewer. */
export type LaunchViewer = {
  signedIn: boolean;
  /** `list-organizations` returned at least one organization. */
  hasOrganization: boolean;
  /** `list-organizations` says this account is a super admin. */
  isSuperAdmin: boolean;
  /** This device has completed a host sign-in before. */
  hostDevice: boolean;
};

export type LaunchDecision =
  | { kind: 'navigate'; path: string }
  | { kind: 'host-login'; path: string };

/**
 * Signed-out routing: a device that has hosted before goes straight to host
 * login (with a return path), everyone else to the public landing page.
 */
export function decideSignedOutLaunch(
  shortcut: LaunchShortcut | null,
  source: string | null,
  hostDevice: boolean
): LaunchDecision {
  if (hostDevice) {
    return { kind: 'host-login', path: launchLoginRedirect(shortcut, source) };
  }
  return { kind: 'navigate', path: '/' };
}

/**
 * Signed-in routing, in the order the plan specifies: host → guest → super admin.
 * `resolvedHostPath` is whatever `resolvePostSignInPath('/org')` produced
 * (tenant dashboard, `/onboarding`, `/verification-rejected`, or the org hub).
 */
export function decideSignedInLaunch(input: {
  viewer: Pick<LaunchViewer, 'hasOrganization' | 'isSuperAdmin'>;
  resolvedHostPath: string | null;
  shortcut: LaunchShortcut | null;
  todayIso: string;
}): LaunchDecision {
  const { viewer, resolvedHostPath, shortcut, todayIso } = input;

  if (viewer.hasOrganization && resolvedHostPath) {
    return { kind: 'navigate', path: applyLaunchShortcut(resolvedHostPath, shortcut, todayIso) };
  }
  if (viewer.isSuperAdmin) {
    return { kind: 'navigate', path: '/admin' };
  }
  // Signed-in guest: their account shell is the only place every trip /
  // conversation is reachable, so it beats the public marketplace.
  return { kind: 'navigate', path: '/account' };
}
