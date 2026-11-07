/**
 * Route capability registry — the single contract for three decisions that used to
 * be scattered or missing:
 *
 *   installOffer    may the install offer appear on this route at all?
 *   precacheTier    which precache tier does this route's code belong to?
 *   offline         what does the user see with no connection?
 *
 * The install eligibility engine, the offline UI and the tests all read from
 * here. Ordered: the first matching rule wins, so specific routes must come before
 * their parents.
 *
 * `docs/workflow/in-progress/pwa-v2-native-app-experience.md` §6 is the human-readable
 * version of this table; keep both in sync.
 */

export type RouteAudience = 'public' | 'guest' | 'host' | 'staff';

/**
 * `blocked`   never offered (mid-task, auth, editors, staff console)
 * `passive`   never proactive; only the permanent "Install app" entry point
 * `proactive` eligible for the timed/engaged offer (see installEligibility)
 * `inline`    an in-page card, never a floating surface
 */
export type InstallOffer = 'blocked' | 'passive' | 'proactive' | 'inline';

/** Mirrors the tiers in `scripts/pwa/precache-globs.json`. */
export type PrecacheTier = 'shell' | 'host' | 'on-demand';

/** `full` = read + safe writes queue; `read` = read only; `none` = online only. */
export type OfflineMode = 'full' | 'read' | 'none';

export type RouteCapability = {
  id: string;
  test: RegExp;
  audience: RouteAudience;
  installOffer: InstallOffer;
  precacheTier: PrecacheTier;
  offline: OfflineMode;
};

const PROPERTY = String.raw`\/org\/[^/]+\/property\/[^/]+`;
const PARKING = String.raw`\/org\/[^/]+\/parking\/[^/]+`;

export const ROUTE_CAPABILITIES: readonly RouteCapability[] = [
  // ── launch resolver ────────────────────────────────────────────────────────
  {
    id: 'launch',
    test: /^\/app\/?$/,
    audience: 'public',
    installOffer: 'blocked',
    precacheTier: 'shell',
    offline: 'none',
  },

  // ── staff console ──────────────────────────────────────────────────────────
  {
    id: 'super-admin',
    test: /^\/admin(?:\/|$)/,
    audience: 'staff',
    installOffer: 'passive',
    precacheTier: 'on-demand',
    offline: 'none',
  },

  // ── host: editors and studio (never precached, never offered) ──────────────
  {
    id: 'property-editors',
    test: new RegExp(`^${PROPERTY}/(?:marketing|public-pages|templates)(?:/|$)`),
    audience: 'host',
    installOffer: 'blocked',
    precacheTier: 'on-demand',
    offline: 'none',
  },
  {
    id: 'parking-editors',
    test: new RegExp(`^${PARKING}/(?:marketing|public-pages|templates)(?:/|$)`),
    audience: 'host',
    installOffer: 'blocked',
    precacheTier: 'on-demand',
    offline: 'none',
  },

  // ── host: property sections ───────────────────────────────────────────────
  {
    id: 'property-bookings',
    test: new RegExp(`^${PROPERTY}/bookings(?:/|$)`),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'full',
  },
  {
    id: 'property-inbox',
    test: new RegExp(`^${PROPERTY}/inbox(?:/|$)`),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'full',
  },
  {
    id: 'property-calendar',
    test: new RegExp(`^${PROPERTY}/calendar(?:/|$)`),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'full',
  },
  {
    id: 'property-operations',
    test: new RegExp(
      `^${PROPERTY}/(?:finance|pricing|maintenance|reviews|analytics|activity|announcements)(?:/|$)`
    ),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'read',
  },
  {
    id: 'property-settings',
    test: new RegExp(
      `^${PROPERTY}/(?:settings|team|plans|notifications|help-support|setup-guide)(?:/|$)`
    ),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'read',
  },
  {
    id: 'property-dashboard',
    test: new RegExp(`^${PROPERTY}(?:/|$)`),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'read',
  },

  // ── host: parking sections ────────────────────────────────────────────────
  {
    id: 'parking-bookings',
    test: new RegExp(`^${PARKING}/bookings(?:/|$)`),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'full',
  },
  {
    id: 'parking-inbox',
    test: new RegExp(`^${PARKING}/inbox(?:/|$)`),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'full',
  },
  {
    id: 'parking-sections',
    test: new RegExp(`^${PARKING}(?:/|$)`),
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'read',
  },

  // ── host: org shell ───────────────────────────────────────────────────────
  {
    id: 'org-admin',
    test: /^\/org(?:\/|$)/,
    audience: 'host',
    installOffer: 'proactive',
    precacheTier: 'host',
    offline: 'read',
  },

  // ── host: auth / onboarding (mid-task, never offered) ─────────────────────
  {
    id: 'host-auth',
    test: /^\/(?:for-hosts\/(?:login|register)|onboarding|accept-invite|verification-rejected|sign-in)(?:\/|$)/,
    audience: 'host',
    installOffer: 'blocked',
    precacheTier: 'shell',
    offline: 'none',
  },

  // ── guest: auth ───────────────────────────────────────────────────────────
  {
    id: 'guest-auth',
    test: /^\/for-guests(?:\/|$)/,
    audience: 'guest',
    installOffer: 'blocked',
    precacheTier: 'shell',
    offline: 'none',
  },

  // ── guest: signed-in account ──────────────────────────────────────────────
  {
    id: 'guest-trips',
    test: /^\/account\/(?:trips|stays)(?:\/|$)/,
    audience: 'guest',
    installOffer: 'inline',
    precacheTier: 'shell',
    offline: 'read',
  },
  {
    id: 'guest-account',
    test: /^\/account(?:\/|$)/,
    audience: 'guest',
    installOffer: 'passive',
    precacheTier: 'shell',
    offline: 'read',
  },

  // ── guest: mid-task forms and post-booking flows ──────────────────────────
  {
    id: 'guest-form',
    test: /^\/(?:properties\/[^/]+\/(?:form|calendar|success|sd-form|document)|parkings\/[^/]+\/form|parkings\/requests\/[^/]+|pay-parking|guest-review)(?:\/|$)/,
    audience: 'guest',
    installOffer: 'blocked',
    precacheTier: 'shell',
    offline: 'none',
  },
  {
    // Standalone phone handoff. Never offered an install card, never precached: it is a
    // one-shot capture session with a 10-minute token.
    id: 'identity-handoff',
    test: /^\/verify(?:\/|$)/,
    audience: 'guest',
    installOffer: 'blocked',
    precacheTier: 'on-demand',
    offline: 'none',
  },
  {
    id: 'guest-stay-guide',
    test: /^\/(?:properties\/[^/]+\/stay-guide|showcase)(?:\/|$)/,
    audience: 'guest',
    installOffer: 'passive',
    precacheTier: 'shell',
    offline: 'read',
  },
  {
    id: 'guest-listing',
    test: /^\/(?:properties|parkings|developments|hosts)(?:\/|$)/,
    audience: 'public',
    installOffer: 'passive',
    precacheTier: 'shell',
    offline: 'read',
  },

  // ── public marketing ──────────────────────────────────────────────────────
  {
    id: 'public-browse',
    test: /^\/(?:search|stays|favorites)(?:\/|$)/,
    audience: 'public',
    installOffer: 'passive',
    precacheTier: 'shell',
    offline: 'read',
  },
  {
    id: 'public-marketing',
    test: /^\/(?:for-hosts|about|contact|support|services|terms|privacy|cookies|docs|v2|explore-preview)(?:\/|$)/,
    audience: 'public',
    installOffer: 'passive',
    precacheTier: 'on-demand',
    offline: 'none',
  },
  {
    id: 'public-landing',
    test: /^\/$/,
    audience: 'public',
    installOffer: 'passive',
    precacheTier: 'shell',
    offline: 'read',
  },

  // ── legacy flat admin redirects ───────────────────────────────────────────
  {
    id: 'legacy-admin-redirect',
    test: /^\/(?:dashboard|bookings|finance|maintenance|notifications|templates|team|settings|marketing|operations|staff|calendar|success|form|sd-form)(?:\/|$)/,
    audience: 'host',
    installOffer: 'passive',
    precacheTier: 'shell',
    offline: 'none',
  },
];

const FALLBACK: RouteCapability = {
  id: 'fallback',
  test: /^/,
  audience: 'public',
  installOffer: 'passive',
  precacheTier: 'on-demand',
  offline: 'none',
};

/** Capability for a pathname (`search` is ignored). Unknown paths get `fallback`. */
export function capabilityForPath(pathname: string): RouteCapability {
  const path = pathname.split('?')[0] ?? pathname;
  return ROUTE_CAPABILITIES.find((rule) => rule.test.test(path)) ?? FALLBACK;
}

/** `true` when the route is mid-task and must never receive an install offer. */
export function isMidTaskRoute(pathname: string): boolean {
  return capabilityForPath(pathname).installOffer === 'blocked';
}

/**
 * Top-level path segments the registry claims to cover. The drift test fails when a
 * router file declares an absolute route whose first segment is not listed here,
 * so a brand-new section cannot ship unclassified (the P1-10 failure mode).
 */
export const KNOWN_ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
  'about',
  'accept-invite',
  'account',
  'admin',
  'app',
  'bookings',
  'calendar',
  'contact',
  'cookies',
  'dashboard',
  'developments',
  'docs',
  'explore-preview',
  'favorites',
  'finance',
  'for-guests',
  'for-hosts',
  'form',
  'guest-review',
  'hosts',
  'maintenance',
  'marketing',
  'notifications',
  'onboarding',
  'operations',
  'org',
  'parkings',
  'pay-parking',
  'privacy',
  'properties',
  'sd-form',
  'search',
  'services',
  'settings',
  'showcase',
  'sign-in',
  'staff',
  'stays',
  'success',
  'support',
  'team',
  'templates',
  'terms',
  'v2',
  'verification-rejected',
  'verify',
]);
