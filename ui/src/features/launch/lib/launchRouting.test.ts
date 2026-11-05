import { describe, expect, it } from 'vitest';

import {
  applyLaunchShortcut,
  checkinsQuery,
  decideSignedInLaunch,
  decideSignedOutLaunch,
  launchLoginRedirect,
  parseDashboardBase,
  parseLaunchShortcut,
} from '@/features/launch/lib/launchRouting';

const TODAY = '2026-11-01';

describe('parseLaunchShortcut', () => {
  it('accepts the three manifest shortcuts', () => {
    expect(parseLaunchShortcut('bookings')).toBe('bookings');
    expect(parseLaunchShortcut('inbox')).toBe('inbox');
    expect(parseLaunchShortcut('checkins')).toBe('checkins');
  });

  it('ignores anything else', () => {
    expect(parseLaunchShortcut('settings')).toBeNull();
    expect(parseLaunchShortcut('')).toBeNull();
    expect(parseLaunchShortcut(null)).toBeNull();
  });
});

describe('parseDashboardBase', () => {
  it('recognises property and parking dashboard roots', () => {
    expect(parseDashboardBase('/org/acme/property/monaco')).toEqual({
      kind: 'property',
      orgSlug: 'acme',
      listingSlug: 'monaco',
    });
    expect(parseDashboardBase('/org/acme/parking/spot')).toEqual({
      kind: 'parking',
      orgSlug: 'acme',
      listingSlug: 'spot',
    });
  });

  it('rejects deeper paths and non-tenant routes', () => {
    expect(parseDashboardBase('/org/acme/property/monaco/bookings')).toBeNull();
    expect(parseDashboardBase('/org/acme')).toBeNull();
    expect(parseDashboardBase('/onboarding')).toBeNull();
  });
});

describe('applyLaunchShortcut', () => {
  it('maps bookings and inbox onto the resolved tenant', () => {
    expect(applyLaunchShortcut('/org/acme/property/monaco', 'bookings', TODAY)).toBe(
      '/org/acme/property/monaco/bookings'
    );
    expect(applyLaunchShortcut('/org/acme/parking/spot', 'inbox', TODAY)).toBe(
      '/org/acme/parking/spot/inbox'
    );
  });

  it('filters check-ins to today in Manila', () => {
    const path = applyLaunchShortcut('/org/acme/property/monaco', 'checkins', TODAY);
    expect(path.startsWith('/org/acme/property/monaco/bookings?')).toBe(true);
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('from')).toBe(TODAY);
    expect(params.get('to')).toBe(TODAY);
    expect(params.get('sort')).toBe('check_in_date:asc');
  });

  it('never skips a required setup step', () => {
    expect(applyLaunchShortcut('/onboarding', 'bookings', TODAY)).toBe('/onboarding');
    expect(applyLaunchShortcut('/verification-rejected', 'inbox', TODAY)).toBe(
      '/verification-rejected'
    );
  });

  it('is a no-op without a shortcut', () => {
    expect(applyLaunchShortcut('/org/acme/property/monaco', null, TODAY)).toBe(
      '/org/acme/property/monaco'
    );
  });

  it('encodes the check-in query deterministically', () => {
    expect(checkinsQuery('2026-01-02')).toBe(
      'from=2026-01-02&to=2026-01-02&sort=check_in_date%3Aasc'
    );
  });
});

describe('decideSignedOutLaunch', () => {
  it('sends a known host device to host login with a return path', () => {
    const decision = decideSignedOutLaunch('inbox', 'pwa', true);
    expect(decision.kind).toBe('host-login');
    const url = new URL(decision.path, 'https://app.example');
    expect(url.pathname).toBe('/for-hosts/login');
    expect(url.searchParams.get('redirect')).toBe('/app?shortcut=inbox&source=pwa');
  });

  it('sends everyone else to the public landing page', () => {
    expect(decideSignedOutLaunch(null, null, false)).toEqual({ kind: 'navigate', path: '/' });
  });

  it('cannot be used as an open redirect', () => {
    const decision = decideSignedOutLaunch(null, 'https://evil.example', true);
    expect(decision.path.startsWith('/for-hosts/login?redirect=')).toBe(true);
    const redirect = new URL(decision.path, 'https://app.example').searchParams.get('redirect');
    expect(redirect?.startsWith('/app')).toBe(true);
  });
});

describe('launchLoginRedirect', () => {
  it('always stays same-origin', () => {
    const value = launchLoginRedirect('checkins', 'pwa');
    expect(value.startsWith('/for-hosts/login?redirect=')).toBe(true);
    expect(value).not.toContain('//');
  });
});

describe('decideSignedInLaunch', () => {
  it('lands a host in their last dashboard', () => {
    expect(
      decideSignedInLaunch({
        viewer: { hasOrganization: true, isSuperAdmin: false },
        resolvedHostPath: '/org/acme/property/monaco',
        shortcut: null,
        todayIso: TODAY,
      })
    ).toEqual({ kind: 'navigate', path: '/org/acme/property/monaco' });
  });

  it('applies the shortcut to that dashboard', () => {
    expect(
      decideSignedInLaunch({
        viewer: { hasOrganization: true, isSuperAdmin: false },
        resolvedHostPath: '/org/acme/parking/spot',
        shortcut: 'bookings',
        todayIso: TODAY,
      })
    ).toEqual({ kind: 'navigate', path: '/org/acme/parking/spot/bookings' });
  });

  it('keeps onboarding and rejection screens', () => {
    expect(
      decideSignedInLaunch({
        viewer: { hasOrganization: true, isSuperAdmin: false },
        resolvedHostPath: '/onboarding',
        shortcut: 'inbox',
        todayIso: TODAY,
      })
    ).toEqual({ kind: 'navigate', path: '/onboarding' });
  });

  it('sends a super admin with no org to the admin console', () => {
    expect(
      decideSignedInLaunch({
        viewer: { hasOrganization: false, isSuperAdmin: true },
        resolvedHostPath: null,
        shortcut: null,
        todayIso: TODAY,
      })
    ).toEqual({ kind: 'navigate', path: '/admin' });
  });

  it('sends a signed-in guest to their account', () => {
    expect(
      decideSignedInLaunch({
        viewer: { hasOrganization: false, isSuperAdmin: false },
        resolvedHostPath: null,
        shortcut: 'bookings',
        todayIso: TODAY,
      })
    ).toEqual({ kind: 'navigate', path: '/account' });
  });
});
