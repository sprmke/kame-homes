import { describe, expect, it } from 'vitest';

import { DEFAULT_PLATFORM_APP_NAME, resolvePlatformAppName } from './platformAppName';

describe('resolvePlatformAppName', () => {
  it('defaults to Kame Homes when unset or blank', () => {
    expect(resolvePlatformAppName(undefined)).toBe(DEFAULT_PLATFORM_APP_NAME);
    expect(resolvePlatformAppName(null)).toBe(DEFAULT_PLATFORM_APP_NAME);
    expect(resolvePlatformAppName('')).toBe(DEFAULT_PLATFORM_APP_NAME);
    expect(resolvePlatformAppName('   ')).toBe(DEFAULT_PLATFORM_APP_NAME);
  });

  it('replaces the retired Stays placeholder', () => {
    expect(resolvePlatformAppName('Stays')).toBe(DEFAULT_PLATFORM_APP_NAME);
    expect(resolvePlatformAppName('stays')).toBe(DEFAULT_PLATFORM_APP_NAME);
    expect(resolvePlatformAppName(' STAYS ')).toBe(DEFAULT_PLATFORM_APP_NAME);
  });

  it('keeps a configured operator name', () => {
    expect(resolvePlatformAppName('Acme Hosts')).toBe('Acme Hosts');
  });
});
