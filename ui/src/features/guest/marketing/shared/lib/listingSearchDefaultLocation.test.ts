import { describe, expect, it } from 'vitest';

import {
  developmentSlugFromPath,
  getListingSearchDefaultLocation,
} from '@/features/guest/marketing/shared/lib/listingSearchDefaultLocation';

describe('getListingSearchDefaultLocation', () => {
  it('stays empty on category indexes', () => {
    for (const path of ['/developments', '/properties', '/parkings', '/search', '/']) {
      expect(getListingSearchDefaultLocation(path)).toBe('');
    }
  });

  it('humanizes location browse slugs', () => {
    expect(getListingSearchDefaultLocation('/properties/in/sta-rosa')).toBe('Sta Rosa');
    expect(getListingSearchDefaultLocation('/developments/in/tagaytay')).toBe('Tagaytay');
    expect(getListingSearchDefaultLocation('/parkings/in/san-fernando')).toBe('San Fernando');
  });

  it('uses the live development name on development routes', () => {
    expect(getListingSearchDefaultLocation('/developments/azure-north', 'Azure North')).toBe(
      'Azure North'
    );
    expect(getListingSearchDefaultLocation('/developments/azure-north/parking', 'Azure')).toBe(
      'Azure'
    );
    expect(getListingSearchDefaultLocation('/developments/azure-north')).toBe('');
  });
});

describe('developmentSlugFromPath', () => {
  it('extracts the slug from development routes only', () => {
    expect(developmentSlugFromPath('/developments/azure-north')).toBe('azure-north');
    expect(developmentSlugFromPath('/developments/azure-north/properties')).toBe('azure-north');
    expect(developmentSlugFromPath('/developments/azure-north/parking/list')).toBe('azure-north');
    expect(developmentSlugFromPath('/developments/in/tagaytay')).toBe('');
    expect(developmentSlugFromPath('/properties/azure')).toBe('');
  });
});
