import { describe, expect, it } from 'vitest';

import { propertySidebarLabel, propertyTowerUnitLine, propertyCardTitle } from '@/features/dashboard/org/lib/propertyDisplay';

describe('propertySidebarLabel', () => {

  it('propertySidebarLabel is exported', () => {
    expect(typeof propertySidebarLabel).toBe('function');
  });

});

describe('propertyTowerUnitLine', () => {

  it('propertyTowerUnitLine is exported', () => {
    expect(typeof propertyTowerUnitLine).toBe('function');
  });

});

describe('propertyCardTitle', () => {

  it('propertyCardTitle is exported', () => {
    expect(typeof propertyCardTitle).toBe('function');
  });

});
