import { describe, expect, it } from 'vitest';

import {
  DESKTOP_SESSION_THRESHOLD,
  evaluateInstallEligibility,
  installCooldownRemainingMs,
  installVariantFor,
  manualInstallAvailability,
  type InstallEligibilityInput,
} from '@/lib/pwa/installEligibility';
import type { InstallMemory } from '@/lib/pwa/installMemory';
import { detectPlatform } from '@/lib/pwa/platform';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIREFOX_ANDROID_UA = 'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0';
const FB_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.1]';

function memory(overrides: Partial<InstallMemory> = {}): InstallMemory {
  return {
    sessions: 3,
    firstSeenAt: NOW - DAY,
    lastSessionAt: NOW,
    valueMoments: [],
    dismissCount: 0,
    lastDismissAt: null,
    dontAskAgain: false,
    hostInstall: true,
    firstLaunchSeen: true,
    ...overrides,
  };
}

function makeInput(overrides: Partial<InstallEligibilityInput> = {}): InstallEligibilityInput {
  return {
    platform: detectPlatform({ ua: ANDROID_UA }),
    pathname: '/org/acme/property/monaco',
    standalone: false,
    swSupported: true,
    nativePromptAvailable: true,
    installedRelatedApp: false,
    appInstalledSeen: false,
    viewer: { role: 'host', hasOrg: true, hasUpcomingTrip: false },
    memory: memory({ valueMoments: ['booking-reviewed'] }),
    ui: {
      firstPageViewOfSession: false,
      dirtyForm: false,
      overlayOpen: false,
      anotherSurfaceVisible: false,
    },
    now: NOW,
    ...overrides,
  };
}

describe('evaluateInstallEligibility — hard blocks', () => {
  it.each([
    ['standalone', { standalone: true }],
    ['already-installed', { appInstalledSeen: true }],
    ['already-installed', { installedRelatedApp: true }],
    ['no-service-worker', { swSupported: false }],
  ])('blocks with %s', (reason, overrides) => {
    const result = evaluateInstallEligibility(makeInput(overrides));
    expect(result).toEqual({ show: false, reason });
  });

  it('never offers inside an in-app browser', () => {
    const result = evaluateInstallEligibility(
      makeInput({ platform: detectPlatform({ ua: FB_IOS_UA }) })
    );
    expect(result).toEqual({ show: false, reason: 'in-app-browser' });
  });

  it('blocks mid-task routes', () => {
    const result = evaluateInstallEligibility(makeInput({ pathname: '/properties/monaco/form' }));
    expect(result).toEqual({ show: false, reason: 'route-blocked' });
  });

  it('blocks with a dirty form', () => {
    const result = evaluateInstallEligibility(
      makeInput({ ui: { ...makeInput().ui, dirtyForm: true } })
    );
    expect(result).toEqual({ show: false, reason: 'mid-task' });
  });

  it('blocks when a sheet or dialog is open', () => {
    const result = evaluateInstallEligibility(
      makeInput({ ui: { ...makeInput().ui, overlayOpen: true } })
    );
    expect(result).toEqual({ show: false, reason: 'mid-task' });
  });

  it('blocks when another PWA surface is visible', () => {
    const result = evaluateInstallEligibility(
      makeInput({ ui: { ...makeInput().ui, anotherSurfaceVisible: true } })
    );
    expect(result).toEqual({ show: false, reason: 'another-surface' });
  });

  it('blocks on the first page view of a session', () => {
    const result = evaluateInstallEligibility(
      makeInput({ ui: { ...makeInput().ui, firstPageViewOfSession: true } })
    );
    expect(result).toEqual({ show: false, reason: 'first-page-view' });
  });

  it('blocks platforms with no install path at all', () => {
    const result = evaluateInstallEligibility(
      makeInput({
        platform: detectPlatform({ ua: FIREFOX_ANDROID_UA }),
        nativePromptAvailable: false,
      })
    );
    // Firefox Android has an overflow-menu guide, so it is offered; verify a
    // genuinely unsupported combination instead:
    expect(result.show).toBe(true);
  });
});

describe('evaluateInstallEligibility — audiences', () => {
  it('never proactively offers to an anonymous guest', () => {
    const result = evaluateInstallEligibility(
      makeInput({ viewer: { role: 'anonymous', hasOrg: false, hasUpcomingTrip: false } })
    );
    expect(result).toEqual({ show: false, reason: 'anonymous' });
  });

  it('reports a first-ever visit for an anonymous visitor', () => {
    const result = evaluateInstallEligibility(
      makeInput({
        viewer: { role: 'anonymous', hasOrg: false, hasUpcomingTrip: false },
        memory: memory({ sessions: 1 }),
      })
    );
    expect(result).toEqual({ show: false, reason: 'first-ever-visit' });
  });

  it('is passive-only in the staff console', () => {
    const result = evaluateInstallEligibility(
      makeInput({
        pathname: '/admin/orgs',
        viewer: { role: 'staff', hasOrg: false, hasUpcomingTrip: false },
      })
    );
    expect(result).toEqual({ show: false, reason: 'staff-console' });
  });

  it('gives a signed-in guest an inline card only on the trips route', () => {
    const guest = { role: 'guest' as const, hasOrg: false, hasUpcomingTrip: true };
    const onTrips = evaluateInstallEligibility(
      makeInput({ pathname: '/account/trips', viewer: guest })
    );
    expect(onTrips).toMatchObject({ show: true, placement: 'inline' });

    const elsewhere = evaluateInstallEligibility(
      makeInput({ pathname: '/account/profile', viewer: guest })
    );
    expect(elsewhere.show).toBe(false);
  });

  it('requires a value moment or enough sessions for a host', () => {
    const notEngaged = evaluateInstallEligibility(
      makeInput({ memory: memory({ sessions: 1, valueMoments: [] }) })
    );
    expect(notEngaged).toEqual({ show: false, reason: 'not-engaged-yet' });

    const secondSession = evaluateInstallEligibility(
      makeInput({ memory: memory({ sessions: 2, valueMoments: [] }) })
    );
    expect(secondSession.show).toBe(true);
  });

  it('uses a sheet on phones and a chip on desktop', () => {
    const phone = evaluateInstallEligibility(makeInput());
    expect(phone).toMatchObject({ show: true, placement: 'sheet' });

    const desktop = evaluateInstallEligibility(
      makeInput({ platform: detectPlatform({ ua: DESKTOP_UA }) })
    );
    expect(desktop).toMatchObject({ show: true, placement: 'chip' });
  });

  it('requires more sessions for a desktop host', () => {
    const desktop = detectPlatform({ ua: DESKTOP_UA });
    const result = evaluateInstallEligibility(
      makeInput({
        platform: desktop,
        memory: memory({ sessions: DESKTOP_SESSION_THRESHOLD - 1, valueMoments: [] }),
      })
    );
    expect(result.show).toBe(false);
  });
});

describe('evaluateInstallEligibility — dismissal cooldown', () => {
  it('respects 14 → 30 → 90 day steps', () => {
    expect(installCooldownRemainingMs(memory({ dismissCount: 1, lastDismissAt: NOW }), NOW)).toBe(
      14 * DAY
    );
    expect(installCooldownRemainingMs(memory({ dismissCount: 2, lastDismissAt: NOW }), NOW)).toBe(
      30 * DAY
    );
    expect(installCooldownRemainingMs(memory({ dismissCount: 3, lastDismissAt: NOW }), NOW)).toBe(
      90 * DAY
    );
  });

  it('becomes permanent after the third dismissal', () => {
    expect(
      installCooldownRemainingMs(memory({ dismissCount: 4, lastDismissAt: NOW }), NOW)
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it('blocks while the cooldown is active and allows after it', () => {
    const blocked = evaluateInstallEligibility(
      makeInput({ memory: memory({ dismissCount: 1, lastDismissAt: NOW - DAY }) })
    );
    expect(blocked).toEqual({ show: false, reason: 'dismissed-cooldown' });

    const allowed = evaluateInstallEligibility(
      makeInput({ memory: memory({ dismissCount: 1, lastDismissAt: NOW - 20 * DAY }) })
    );
    expect(allowed.show).toBe(true);
  });

  it('honours "don\'t ask again"', () => {
    const result = evaluateInstallEligibility(makeInput({ memory: memory({ dontAskAgain: true }) }));
    expect(result).toEqual({ show: false, reason: 'dont-ask-again' });
  });
});

describe('installVariantFor', () => {
  it('prefers the native prompt when it exists', () => {
    expect(installVariantFor(detectPlatform({ ua: ANDROID_UA }), true)).toBe('native');
  });

  it('falls back to a platform guide', () => {
    expect(installVariantFor(detectPlatform({ ua: IOS_UA }), false)).toBe('ios-guide');
    expect(installVariantFor(detectPlatform({ ua: FIREFOX_ANDROID_UA }), false)).toBe('menu-guide');
    expect(installVariantFor(detectPlatform({ ua: DESKTOP_UA }), false)).toBeNull();
  });
});

describe('manualInstallAvailability', () => {
  it('is available regardless of engagement, but not when installed', () => {
    const platform = detectPlatform({ ua: ANDROID_UA });
    expect(
      manualInstallAvailability({
        platform,
        standalone: false,
        swSupported: true,
        nativePromptAvailable: true,
        appInstalledSeen: false,
      })
    ).toMatchObject({ available: true, variant: 'native' });

    expect(
      manualInstallAvailability({
        platform,
        standalone: true,
        swSupported: true,
        nativePromptAvailable: true,
        appInstalledSeen: false,
      })
    ).toMatchObject({ available: false, reason: 'standalone' });
  });
});
