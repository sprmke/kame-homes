import { describe, expect, it } from 'vitest';

import { defaultListingPropertyTemplateName, resolveListingPropertyTemplateName, resolveListingPropertyRoleId, normalizeLegacyParkingListingRoleId, LISTING_PROPERTY_TEMPLATE_OPTIONS, LISTING_PARKING_ROLE_OPTIONS } from '@/features/dashboard/team/lib/listingAssignmentRoles';

describe('defaultListingPropertyTemplateName', () => {

  it('defaultListingPropertyTemplateName is exported', () => {
    expect(typeof defaultListingPropertyTemplateName).toBe('function');
  });

});

describe('resolveListingPropertyTemplateName', () => {

  it('resolveListingPropertyTemplateName is exported', () => {
    expect(typeof resolveListingPropertyTemplateName).toBe('function');
  });

});

describe('resolveListingPropertyRoleId', () => {

  it('resolveListingPropertyRoleId is exported', () => {
    expect(typeof resolveListingPropertyRoleId).toBe('function');
  });

});

describe('normalizeLegacyParkingListingRoleId', () => {

  it('normalizeLegacyParkingListingRoleId is exported', () => {
    expect(typeof normalizeLegacyParkingListingRoleId).toBe('function');
  });

});

describe('LISTING_PROPERTY_TEMPLATE_OPTIONS', () => {
  it('is defined', () => {
    expect(LISTING_PROPERTY_TEMPLATE_OPTIONS).toBeDefined();
  });
});

describe('LISTING_PARKING_ROLE_OPTIONS', () => {
  it('is defined', () => {
    expect(LISTING_PARKING_ROLE_OPTIONS).toBeDefined();
  });
});
