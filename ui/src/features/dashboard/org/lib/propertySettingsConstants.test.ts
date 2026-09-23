import { describe, expect, it } from 'vitest';

import { resolveAmenityLabels, PROPERTY_TYPES, PROPERTY_STATUS_OPTIONS, PROPERTY_CONTACT_ROLES, PROPERTY_CONTACT_ROLE_VALUES, CUSTOM_AMENITY_MAX_LENGTH, INITIAL_ENABLED_AMENITIES } from '@/features/dashboard/org/lib/propertySettingsConstants';

describe('resolveAmenityLabels', () => {

  it('resolveAmenityLabels is exported', () => {
    expect(typeof resolveAmenityLabels).toBe('function');
  });

});

describe('PROPERTY_TYPES', () => {
  it('is defined', () => {
    expect(PROPERTY_TYPES).toBeDefined();
  });
});

describe('PROPERTY_STATUS_OPTIONS', () => {
  it('is defined', () => {
    expect(PROPERTY_STATUS_OPTIONS).toBeDefined();
  });
});

describe('PROPERTY_CONTACT_ROLES', () => {
  it('is defined', () => {
    expect(PROPERTY_CONTACT_ROLES).toBeDefined();
  });
});

describe('PROPERTY_CONTACT_ROLE_VALUES', () => {
  it('is defined', () => {
    expect(PROPERTY_CONTACT_ROLE_VALUES).toBeDefined();
  });
});

describe('CUSTOM_AMENITY_MAX_LENGTH', () => {
  it('is defined', () => {
    expect(CUSTOM_AMENITY_MAX_LENGTH).toBeDefined();
  });
});

describe('INITIAL_ENABLED_AMENITIES', () => {
  it('is defined', () => {
    expect(INITIAL_ENABLED_AMENITIES).toBeDefined();
  });
});
