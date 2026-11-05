import { describe, expect, it } from 'vitest';

import {
  isPropertyTower,
  isPropertyTowerForResidence,
  isValidUnitNumber,
  formatTowerAndUnit,
  parseTowerAndUnitFromLegacy,
  sanitizeUnitNumberInput,
  PROPERTY_TOWERS,
} from '@/features/dashboard/org/lib/propertyTowerUnit';

describe('isPropertyTower', () => {
  it('isPropertyTower is exported', () => {
    expect(typeof isPropertyTower).toBe('function');
  });
});

describe('isPropertyTowerForResidence', () => {
  it('isPropertyTowerForResidence is exported', () => {
    expect(typeof isPropertyTowerForResidence).toBe('function');
  });
});

describe('isValidUnitNumber', () => {
  it('isValidUnitNumber is exported', () => {
    expect(typeof isValidUnitNumber).toBe('function');
  });
});

describe('formatTowerAndUnit', () => {
  it('formatTowerAndUnit is exported', () => {
    expect(typeof formatTowerAndUnit).toBe('function');
  });
});

describe('parseTowerAndUnitFromLegacy', () => {
  it('parses Monaco 2604', () => {
    expect(parseTowerAndUnitFromLegacy('Monaco 2604')).toEqual({
      tower: 'Monaco',
      unitNumber: '2604',
    });
  });

  it('returns null for unknown text', () => {
    expect(parseTowerAndUnitFromLegacy('Tower A 12')).toBeNull();
  });
});

describe('sanitizeUnitNumberInput', () => {
  it('sanitizeUnitNumberInput is exported', () => {
    expect(typeof sanitizeUnitNumberInput).toBe('function');
  });
});

describe('PROPERTY_TOWERS', () => {
  it('is defined', () => {
    expect(PROPERTY_TOWERS).toBeDefined();
  });
});
