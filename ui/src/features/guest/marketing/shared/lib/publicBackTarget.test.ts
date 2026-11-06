import { describe, expect, it } from 'vitest';

import { getPublicBackTarget } from './publicBackTarget';

describe('getPublicBackTarget', () => {
  it('returns null on root destinations reachable from the tab bar', () => {
    for (const path of [
      '/',
      '/properties',
      '/parkings',
      '/developments',
      '/search',
      '/for-hosts',
    ]) {
      expect(getPublicBackTarget(path), path).toBeNull();
    }
  });

  it('ignores a trailing slash', () => {
    expect(getPublicBackTarget('/properties/')).toBeNull();
  });

  it('sends property and parking detail back to their list', () => {
    expect(getPublicBackTarget('/properties/solea-mactan')).toEqual({
      label: 'Properties',
      href: '/properties',
    });
    expect(getPublicBackTarget('/parkings/some-parking')).toEqual({
      label: 'Parkings',
      href: '/parkings',
    });
  });

  it('covers the nested flows that mount a contextual action bar', () => {
    expect(getPublicBackTarget('/parkings/some-parking/form')?.href).toBe('/parkings');
    expect(getPublicBackTarget('/parkings/requests/booking-1')?.href).toBe('/parkings');
    expect(getPublicBackTarget('/properties/in/cebu')?.href).toBe('/properties');
  });

  it('keeps development sub-pages inside their section', () => {
    expect(getPublicBackTarget('/developments/one-tower/parking')?.href).toBe('/developments');
  });

  it('sends for-hosts sub-pages back to the for-hosts landing', () => {
    expect(getPublicBackTarget('/for-hosts/pricing')).toEqual({
      label: 'For hosts',
      href: '/for-hosts',
    });
  });

  it('falls back to home for standalone pages', () => {
    for (const path of ['/privacy', '/terms', '/support', '/contact', '/hosts/sample-stays']) {
      expect(getPublicBackTarget(path), path).toEqual({ label: 'Home', href: '/' });
    }
  });

  it('never returns a target that points at the current page', () => {
    for (const path of [
      '/properties/solea-mactan',
      '/parkings/x/form',
      '/for-hosts/pricing',
      '/privacy',
    ]) {
      expect(getPublicBackTarget(path)?.href, path).not.toBe(path);
    }
  });
});
