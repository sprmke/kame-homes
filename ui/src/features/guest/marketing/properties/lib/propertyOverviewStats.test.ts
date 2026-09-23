import { describe, expect, it } from 'vitest';

import { isBuildingPropertyType, shouldShowPropertyFloors } from '@/features/guest/marketing/properties/lib/propertyOverviewStats';

describe('isBuildingPropertyType', () => {

  it('isBuildingPropertyType is exported', () => {
    expect(typeof isBuildingPropertyType).toBe('function');
  });

});

describe('shouldShowPropertyFloors', () => {

  it('shouldShowPropertyFloors is exported', () => {
    expect(typeof shouldShowPropertyFloors).toBe('function');
  });

});
