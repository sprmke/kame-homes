import { describe, expect, it } from 'vitest';

import { propertyMatchesTowerUnit, findPropertyTowerUnitConflict, duplicateTowerUnitMessage } from '@/features/dashboard/org/lib/propertyTowerUnitConflict';

describe('propertyMatchesTowerUnit', () => {

  it('propertyMatchesTowerUnit is exported', () => {
    expect(typeof propertyMatchesTowerUnit).toBe('function');
  });

});

describe('findPropertyTowerUnitConflict', () => {

  it('findPropertyTowerUnitConflict is exported', () => {
    expect(typeof findPropertyTowerUnitConflict).toBe('function');
  });

});

describe('duplicateTowerUnitMessage', () => {

  it('duplicateTowerUnitMessage is exported', () => {
    expect(typeof duplicateTowerUnitMessage).toBe('function');
  });

});
