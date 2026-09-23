import { describe, expect, it } from 'vitest';

import { parseCsvParam, parsePositiveInt, parseNonNegInt, parseOptionalNumber, parseOptionalYmd, setOrDelete, setCsvOrDelete, setIfNotDefault } from '@/features/guest/marketing/shared/lib/listingQueryParams';

describe('parseCsvParam', () => {

  it('parseCsvParam is exported', () => {
    expect(typeof parseCsvParam).toBe('function');
  });

});

describe('parsePositiveInt', () => {

  it('parsePositiveInt is exported', () => {
    expect(typeof parsePositiveInt).toBe('function');
  });

});

describe('parseNonNegInt', () => {

  it('parseNonNegInt is exported', () => {
    expect(typeof parseNonNegInt).toBe('function');
  });

});

describe('parseOptionalNumber', () => {

  it('parseOptionalNumber is exported', () => {
    expect(typeof parseOptionalNumber).toBe('function');
  });

});

describe('parseOptionalYmd', () => {

  it('parseOptionalYmd is exported', () => {
    expect(typeof parseOptionalYmd).toBe('function');
  });

});

describe('setOrDelete', () => {

  it('setOrDelete is exported', () => {
    expect(typeof setOrDelete).toBe('function');
  });

});

describe('setCsvOrDelete', () => {

  it('setCsvOrDelete is exported', () => {
    expect(typeof setCsvOrDelete).toBe('function');
  });

});

describe('setIfNotDefault', () => {

  it('setIfNotDefault is exported', () => {
    expect(typeof setIfNotDefault).toBe('function');
  });

});
