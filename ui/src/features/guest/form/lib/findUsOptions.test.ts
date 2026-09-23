import { describe, expect, it } from 'vitest';

import { isFindUsOption, findUsRequiresDetails, FIND_US_OPTIONS } from '@/features/guest/form/lib/findUsOptions';

describe('isFindUsOption', () => {

  it('isFindUsOption is exported', () => {
    expect(typeof isFindUsOption).toBe('function');
  });

});

describe('findUsRequiresDetails', () => {

  it('findUsRequiresDetails is exported', () => {
    expect(typeof findUsRequiresDetails).toBe('function');
  });

});

describe('FIND_US_OPTIONS', () => {
  it('is defined', () => {
    expect(FIND_US_OPTIONS).toBeDefined();
  });
});
