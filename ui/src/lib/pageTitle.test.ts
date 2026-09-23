import { describe, expect, it } from 'vitest';

import { usePageTitle, orgPageTitle, propertyPublicPageTitle, propertyDashboardPageTitle, parkingDashboardPageTitle } from '@/lib/pageTitle';

describe('usePageTitle', () => {

  it('usePageTitle is exported', () => {
    expect(typeof usePageTitle).toBe('function');
  });

});

describe('orgPageTitle', () => {

  it('orgPageTitle is exported', () => {
    expect(typeof orgPageTitle).toBe('function');
  });

});

describe('propertyPublicPageTitle', () => {

  it('propertyPublicPageTitle is exported', () => {
    expect(typeof propertyPublicPageTitle).toBe('function');
  });

});

describe('propertyDashboardPageTitle', () => {

  it('propertyDashboardPageTitle is exported', () => {
    expect(typeof propertyDashboardPageTitle).toBe('function');
  });

});

describe('parkingDashboardPageTitle', () => {

  it('parkingDashboardPageTitle is exported', () => {
    expect(typeof parkingDashboardPageTitle).toBe('function');
  });

});
