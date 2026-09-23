import { describe, expect, it } from 'vitest';

import { orgPropertyTypeLabel, orgPropertyTypeIcon, formatOrgPropertyCurrency, orgPropertyStatsOrEmpty, orgPropertyLocationLine, orgPropertySearchHaystack, orgPropertyGuestCapacity } from '@/features/dashboard/org/lib/orgPropertyDisplay';

describe('orgPropertyTypeLabel', () => {

  it('orgPropertyTypeLabel is exported', () => {
    expect(typeof orgPropertyTypeLabel).toBe('function');
  });

});

describe('orgPropertyTypeIcon', () => {

  it('orgPropertyTypeIcon is exported', () => {
    expect(typeof orgPropertyTypeIcon).toBe('function');
  });

});

describe('formatOrgPropertyCurrency', () => {

  it('formatOrgPropertyCurrency is exported', () => {
    expect(typeof formatOrgPropertyCurrency).toBe('function');
  });

});

describe('orgPropertyStatsOrEmpty', () => {

  it('orgPropertyStatsOrEmpty is exported', () => {
    expect(typeof orgPropertyStatsOrEmpty).toBe('function');
  });

});

describe('orgPropertyLocationLine', () => {

  it('orgPropertyLocationLine is exported', () => {
    expect(typeof orgPropertyLocationLine).toBe('function');
  });

});

describe('orgPropertySearchHaystack', () => {

  it('orgPropertySearchHaystack is exported', () => {
    expect(typeof orgPropertySearchHaystack).toBe('function');
  });

});

describe('orgPropertyGuestCapacity', () => {

  it('orgPropertyGuestCapacity is exported', () => {
    expect(typeof orgPropertyGuestCapacity).toBe('function');
  });

});
