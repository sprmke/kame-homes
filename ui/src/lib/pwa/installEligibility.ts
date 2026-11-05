/**
 * Install eligibility engine — one pure decision, no timers, no globals.
 *
 * v1 showed a floating card to everyone on every page after 8 seconds, including
 * guests mid-booking inside the Facebook in-app browser (P0-5). The offer is a
 * product decision: this module decides, components only render.
 *
 * Precedence is deliberate: capability/context blocks first (they can never be
 * overridden), then audience, then platform variant, then cooldown.
 */

import type { InstallMemory } from '@/lib/pwa/installMemory';
import { installGuideFor, type PlatformInfo } from '@/lib/pwa/platform';
import { capabilityForPath } from '@/lib/pwa/routeCapabilities';

export type InstallVariant = 'native' | 'ios-guide' | 'macos-safari-guide' | 'menu-guide';
export type InstallPlacement = 'sheet' | 'chip' | 'inline';

export type InstallBlockReason =
  | 'standalone'
  | 'already-installed'
  | 'no-service-worker'
  | 'in-app-browser'
  | 'platform-cannot-install'
  | 'route-blocked'
  | 'mid-task'
  | 'overlay-open'
  | 'another-surface'
  | 'first-page-view'
  | 'first-ever-visit'
  | 'dismissed-cooldown'
  | 'dont-ask-again'
  | 'anonymous'
  | 'guest-without-trip'
  | 'not-engaged-yet'
  | 'staff-console';

/** Dismiss 1 → 14 days, 2 → 30, 3 → 90, 4+ → passive entry only. */
export const INSTALL_COOLDOWN_DAYS = [14, 30, 90] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
/** "2nd session within 7 days" for the proactive host offer. */
export const HOST_ENGAGEMENT_WINDOW_DAYS = 7;
/** Desktop hosts get the quieter chip on the 3rd session. */
export const DESKTOP_SESSION_THRESHOLD = 3;
export const MOBILE_SESSION_THRESHOLD = 2;

export type InstallViewer = {
  role: 'anonymous' | 'guest' | 'host' | 'staff';
  /** Signed in with at least one organization (host / operator). */
  hasOrg: boolean;
  /** Signed-in guest with an upcoming trip — the only inline install audience. */
  hasUpcomingTrip: boolean;
};

export type InstallEligibilityInput = {
  platform: PlatformInfo;
  pathname: string;
  standalone: boolean;
  swSupported: boolean;
  /** `beforeinstallprompt` was captured and is still promptable. */
  nativePromptAvailable: boolean;
  /** `getInstalledRelatedApps()` reported the app (where supported). */
  installedRelatedApp: boolean;
  /** `appinstalled` fired on this browser (session scoped). */
  appInstalledSeen: boolean;
  viewer: InstallViewer;
  memory: InstallMemory;
  ui: {
    /** The first page view after a session starts — never offer here. */
    firstPageViewOfSession: boolean;
    /** Any unsaved-changes guard reports dirty. */
    dirtyForm: boolean;
    /** A Sheet / Dialog / lightbox is open. */
    overlayOpen: boolean;
    /** Update prompt, offline banner with pending items, or a push ask is visible. */
    anotherSurfaceVisible: boolean;
  };
  now: number;
};

export type InstallEligibility =
  | { show: false; reason: InstallBlockReason }
  | { show: true; variant: InstallVariant; placement: InstallPlacement };

function block(reason: InstallBlockReason): InstallEligibility {
  return { show: false, reason };
}

/**
 * Remaining cooldown in ms. `Infinity` means "passive entry only from now on".
 * Exported so the permanent "Install app" entry can explain why nothing popped up.
 */
export function installCooldownRemainingMs(memory: InstallMemory, now: number): number {
  if (memory.dismissCount <= 0 || memory.lastDismissAt === null) return 0;
  const step = INSTALL_COOLDOWN_DAYS[memory.dismissCount - 1];
  if (step === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, memory.lastDismissAt + step * DAY_MS - now);
}

function daysSince(from: number | null, now: number): number {
  if (from === null) return 0;
  return (now - from) / DAY_MS;
}

/** Which offer this platform can render, or `null` when none exists. */
export function installVariantFor(
  platform: PlatformInfo,
  nativePromptAvailable: boolean
): InstallVariant | null {
  if (nativePromptAvailable) return 'native';
  const guide = installGuideFor(platform);
  if (guide === 'ios-safari' || guide === 'ios-other') return 'ios-guide';
  if (guide === 'macos-safari') return 'macos-safari-guide';
  if (guide === 'android-menu') return 'menu-guide';
  return null;
}

/**
 * The decision. Every `false` carries a reason so telemetry can show *why* the
 * offer was withheld (sampled, no PII).
 */
export function evaluateInstallEligibility(input: InstallEligibilityInput): InstallEligibility {
  const { platform, viewer, memory, ui, now } = input;

  // ── capability / context blocks ───────────────────────────────────────────
  if (input.standalone) return block('standalone');
  if (input.appInstalledSeen || input.installedRelatedApp) return block('already-installed');
  if (!input.swSupported) return block('no-service-worker');
  if (platform.isInAppBrowser) return block('in-app-browser');

  const route = capabilityForPath(input.pathname);
  if (route.installOffer === 'blocked') return block('route-blocked');
  if (ui.dirtyForm) return block('mid-task');
  if (ui.overlayOpen) return block('mid-task');
  if (ui.anotherSurfaceVisible) return block('another-surface');
  if (ui.firstPageViewOfSession) return block('first-page-view');

  const variant = installVariantFor(platform, input.nativePromptAvailable);
  if (!variant) return block('platform-cannot-install');

  // ── audience ──────────────────────────────────────────────────────────────
  if (viewer.role === 'staff') return block('staff-console');

  const isHost = viewer.role === 'host' && viewer.hasOrg;
  const isGuest = viewer.role === 'guest';

  if (viewer.role === 'anonymous') {
    // Anonymous visitors never get a proactive offer — a passive footer/menu
    // entry only. A first-ever visit never sees anything at all.
    return block(memory.sessions <= 1 ? 'first-ever-visit' : 'anonymous');
  }

  if (isGuest) {
    if (!viewer.hasUpcomingTrip) return block('guest-without-trip');
    if (route.installOffer !== 'inline') return block('guest-without-trip');
  }

  if (!isHost && !isGuest) return block('anonymous');

  // Dismissal history applies to every proactive audience.
  if (memory.dontAskAgain) return block('dont-ask-again');
  const cooldown = installCooldownRemainingMs(memory, now);
  if (cooldown === Number.POSITIVE_INFINITY) return block('dont-ask-again');
  if (cooldown > 0) return block('dismissed-cooldown');

  // ── engagement ────────────────────────────────────────────────────────────
  const withinWindow = daysSince(memory.firstSeenAt, now) <= HOST_ENGAGEMENT_WINDOW_DAYS;
  const hadValueMoment = memory.valueMoments.length > 0;

  if (isGuest) {
    // Signed-in guest with a trip: inline card, first eligible visit is fine.
    return { show: true, variant, placement: 'inline' };
  }

  const mobileLike = platform.isMobile;
  const eligibleByEngagement = mobileLike
    ? hadValueMoment || (memory.sessions >= MOBILE_SESSION_THRESHOLD && withinWindow)
    : hadValueMoment || memory.sessions >= DESKTOP_SESSION_THRESHOLD;

  if (!eligibleByEngagement) return block('not-engaged-yet');

  return { show: true, variant, placement: mobileLike ? 'sheet' : 'chip' };
}

/**
 * Variant used by the permanent entry point ("Install app" in a menu / footer):
 * it ignores engagement and dismissal history, but still respects "cannot install"
 * and "already installed".
 */
export function manualInstallAvailability(input: {
  platform: PlatformInfo;
  standalone: boolean;
  swSupported: boolean;
  nativePromptAvailable: boolean;
  appInstalledSeen: boolean;
}): { available: boolean; variant: InstallVariant | null; reason?: InstallBlockReason } {
  if (input.standalone) return { available: false, variant: null, reason: 'standalone' };
  if (input.appInstalledSeen) return { available: false, variant: null, reason: 'already-installed' };
  const variant = installVariantFor(input.platform, input.nativePromptAvailable);
  if (!variant) return { available: false, variant: null, reason: 'platform-cannot-install' };
  return { available: true, variant };
}
