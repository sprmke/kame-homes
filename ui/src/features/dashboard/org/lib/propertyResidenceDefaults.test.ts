import { describe, expect, it } from 'vitest';

import { getResidencePropertyDefaults, clampToRange, applyResidenceDefaultsToDraft, validateNumericField, validatePropertyDetailsForResidence } from '@/features/dashboard/org/lib/propertyResidenceDefaults';

describe('getResidencePropertyDefaults', () => {

  it('getResidencePropertyDefaults is exported', () => {
    expect(typeof getResidencePropertyDefaults).toBe('function');
  });

});

describe('clampToRange', () => {

  it('clampToRange is exported', () => {
    expect(typeof clampToRange).toBe('function');
  });

});

describe('applyResidenceDefaultsToDraft', () => {

  it('applyResidenceDefaultsToDraft is exported', () => {
    expect(typeof applyResidenceDefaultsToDraft).toBe('function');
  });

});

describe('validateNumericField', () => {

  it('validateNumericField is exported', () => {
    expect(typeof validateNumericField).toBe('function');
  });

});

describe('validatePropertyDetailsForResidence', () => {

  it('validatePropertyDetailsForResidence is exported', () => {
    expect(typeof validatePropertyDetailsForResidence).toBe('function');
  });

});
