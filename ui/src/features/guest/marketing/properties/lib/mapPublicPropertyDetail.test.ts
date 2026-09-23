import { describe, expect, it } from 'vitest';

import { mapApiPropertyToResolved, mapMockPropertyToResolved, mapBasicMockToResolved, DEFAULT_ORG_LOGO_URL } from '@/features/guest/marketing/properties/lib/mapPublicPropertyDetail';

describe('mapApiPropertyToResolved', () => {

  it('mapApiPropertyToResolved is exported', () => {
    expect(typeof mapApiPropertyToResolved).toBe('function');
  });

});

describe('mapMockPropertyToResolved', () => {

  it('mapMockPropertyToResolved is exported', () => {
    expect(typeof mapMockPropertyToResolved).toBe('function');
  });

});

describe('mapBasicMockToResolved', () => {

  it('mapBasicMockToResolved is exported', () => {
    expect(typeof mapBasicMockToResolved).toBe('function');
  });

});

describe('DEFAULT_ORG_LOGO_URL', () => {
  it('is defined', () => {
    expect(DEFAULT_ORG_LOGO_URL).toBeDefined();
  });
});
