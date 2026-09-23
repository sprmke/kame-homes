import { describe, expect, it } from 'vitest';

import { propertiesForDevelopment, groupPropertiesByDevelopment } from '@/features/guest/marketing/properties/lib/groupPropertiesByDevelopment';

describe('propertiesForDevelopment', () => {

  it('propertiesForDevelopment is exported', () => {
    expect(typeof propertiesForDevelopment).toBe('function');
  });

});

describe('groupPropertiesByDevelopment', () => {

  it('groupPropertiesByDevelopment is exported', () => {
    expect(typeof groupPropertiesByDevelopment).toBe('function');
  });

});
