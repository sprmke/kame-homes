import { describe, expect, it } from 'vitest';

import {
  cacheableFunctionName,
  isForceUpdateRequired,
  isKillSwitchTripped,
  isTiersManifestForBuild,
  normalizeBadgeCount,
  parsePrecacheTiers,
  retirementTarget,
  safeAppPath,
  shouldWarmHostTier,
  truncatePushBody,
} from '@/pwa/swLogic';

describe('safeAppPath', () => {
  it('accepts app-relative paths', () => {
    expect(safeAppPath('/org/acme/property/monaco/bookings')).toBe(
      '/org/acme/property/monaco/bookings'
    );
  });

  it.each([
    ['absolute URL', 'https://evil.example/x'],
    ['protocol-relative', '//evil.example/x'],
    ['backslash trick', '/\\evil.example'],
    ['control characters', '/x\u0000y'],
    ['non-string', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(safeAppPath(value)).toBe('/');
  });

  it('uses the provided fallback', () => {
    expect(safeAppPath('https://evil.example', '/app')).toBe('/app');
  });
});

describe('cacheableFunctionName', () => {
  const allowlist = new Set(['get-public-property', 'get-booked-dates']);

  it('extracts an allowlisted function name', () => {
    expect(cacheableFunctionName('/functions/v1/get-public-property', allowlist)).toBe(
      'get-public-property'
    );
    expect(cacheableFunctionName('/functions/v1/get-public-property?slug=x', allowlist)).toBe(
      'get-public-property'
    );
  });

  it('refuses anything not explicitly allowlisted', () => {
    expect(cacheableFunctionName('/functions/v1/list-bookings', allowlist)).toBeNull();
    expect(cacheableFunctionName('/functions/v1/', allowlist)).toBeNull();
    expect(cacheableFunctionName('/assets/app.js', allowlist)).toBeNull();
  });
});

describe('kill-switch and force update', () => {
  it('trips on disabled', () => {
    expect(isKillSwitchTripped({ disabled: true }, 100)).toBe(true);
    expect(isKillSwitchTripped({ disabled: false }, 100)).toBe(false);
  });

  it('trips when the build is below minBuild', () => {
    expect(isKillSwitchTripped({ minBuild: 200 }, 100)).toBe(true);
    expect(isKillSwitchTripped({ minBuild: 100 }, 100)).toBe(false);
  });

  it('never trips on a missing or malformed descriptor', () => {
    expect(isKillSwitchTripped(null, 100)).toBe(false);
    expect(isKillSwitchTripped({}, 100)).toBe(false);
  });

  it('requires an update below forceUpdateBelow without killing the app', () => {
    expect(isForceUpdateRequired({ forceUpdateBelow: 200 }, 100)).toBe(true);
    expect(isForceUpdateRequired({ forceUpdateBelow: 100 }, 100)).toBe(false);
    expect(isForceUpdateRequired({}, 100)).toBe(false);
  });
});

describe('parsePrecacheTiers', () => {
  const shell = [
    { url: '/index.html', revision: 'abc' },
    { url: '/assets/index-12345678.js', revision: null },
  ];

  it('accepts a well-formed manifest', () => {
    const tiers = parsePrecacheTiers({ shell, host: [], onDemand: [] });
    expect(tiers?.shell).toHaveLength(2);
  });

  it('rejects an empty shell', () => {
    expect(parsePrecacheTiers({ shell: [] })).toBeNull();
  });

  it('rejects a shell without the navigation fallback', () => {
    expect(parsePrecacheTiers({ shell: [shell[1]] })).toBeNull();
  });

  it('drops malformed entries instead of failing the whole install', () => {
    const tiers = parsePrecacheTiers({
      shell: [...shell, { url: 'relative.js', revision: null }, { nope: true }, 'string-entry'],
      host: [{ url: '/assets/host-12345678.js', revision: null }],
      onDemand: null,
    });
    expect(tiers?.shell).toHaveLength(2);
    expect(tiers?.host).toHaveLength(1);
    expect(tiers?.onDemand).toEqual([]);
  });

  it('rejects non-objects', () => {
    expect(parsePrecacheTiers(null)).toBeNull();
    expect(parsePrecacheTiers('nope')).toBeNull();
  });

  it('keeps the build id so a worker can refuse another build’s manifest', () => {
    const tiers = parsePrecacheTiers({ buildId: 1_793_760_119, shell, host: [], onDemand: [] });
    expect(tiers?.buildId).toBe(1_793_760_119);
    expect(parsePrecacheTiers({ shell, host: [], onDemand: [] })?.buildId).toBe(0);
  });
});

describe('isTiersManifestForBuild', () => {
  const tiers = parsePrecacheTiers({
    buildId: 200,
    shell: [{ url: '/index.html', revision: 'abc' }],
    host: [],
    onDemand: [],
  });

  it('accepts the manifest written by the same build', () => {
    expect(isTiersManifestForBuild(tiers, 200)).toBe(true);
  });

  it('rejects a manifest from a previous build', () => {
    expect(isTiersManifestForBuild(tiers, 100)).toBe(false);
  });

  it('cannot verify dev/legacy manifests, so it accepts them', () => {
    expect(isTiersManifestForBuild({ ...tiers!, buildId: 0 }, 200)).toBe(true);
    expect(isTiersManifestForBuild(tiers, 0)).toBe(true);
    expect(isTiersManifestForBuild(null, 200)).toBe(false);
  });
});

describe('shouldWarmHostTier', () => {
  const base = { online: true, saveData: false, standalone: false, alreadyWarmed: false };

  it('warms on a normal connection', () => {
    expect(shouldWarmHostTier(base)).toEqual({ warm: true });
  });

  it.each([
    [{ online: false }, 'offline'],
    [{ saveData: true }, 'save-data'],
    [{ effectiveType: '2g' }, 'network-2g'],
    [{ effectiveType: 'slow-2g' }, 'network-slow-2g'],
    [{ alreadyWarmed: true }, 'already-warmed'],
  ])('skips when %o', (overrides, reason) => {
    expect(shouldWarmHostTier({ ...base, ...overrides })).toEqual({ warm: false, reason });
  });

  it('warms on 3g and 4g', () => {
    expect(shouldWarmHostTier({ ...base, effectiveType: '3g' }).warm).toBe(true);
    expect(shouldWarmHostTier({ ...base, effectiveType: '4g' }).warm).toBe(true);
  });
});

describe('retirementTarget', () => {
  it('moves a legacy host to the canonical origin, keeping the path', () => {
    expect(
      retirementTarget('https://kamehomes.space/org/acme?tab=1', ['kamehomes.space'], 'https://kamespace.com')
    ).toBe('https://kamespace.com/org/acme?tab=1');
  });

  it('ignores canonical and unrelated hosts', () => {
    expect(
      retirementTarget('https://kamespace.com/x', ['kamehomes.space'], 'https://kamespace.com')
    ).toBeNull();
    expect(retirementTarget('not a url', ['kamehomes.space'], 'https://kamespace.com')).toBeNull();
  });
});

describe('push payload hardening', () => {
  it('coerces the badge to a bounded positive integer', () => {
    expect(normalizeBadgeCount(5)).toBe(5);
    expect(normalizeBadgeCount('7')).toBe(7);
    expect(normalizeBadgeCount(0)).toBeNull();
    expect(normalizeBadgeCount(-3)).toBeNull();
    expect(normalizeBadgeCount(Number.NaN)).toBeNull();
    expect(normalizeBadgeCount('abc')).toBeNull();
    expect(normalizeBadgeCount(1e9)).toBe(9999);
  });

  it('collapses and truncates the body', () => {
    expect(truncatePushBody('  hello \n world  ')).toBe('hello world');
    expect(truncatePushBody(undefined)).toBe('');
    expect(truncatePushBody(12)).toBe('');
    const long = 'a'.repeat(500);
    expect(truncatePushBody(long)).toHaveLength(300);
    expect(truncatePushBody(long).endsWith('\u2026')).toBe(true);
  });
});
