import { describe, expect, it } from 'vitest';

import { parseDevelopmentsQuery, writeDevelopmentsQuery, countActiveDevelopmentFilters, clearDevelopmentFilters, toDevelopmentCard, DEVELOPMENTS_SORTS } from '@/features/guest/marketing/developments/lib/developmentsQuery';

describe('parseDevelopmentsQuery', () => {

  it('parseDevelopmentsQuery is exported', () => {
    expect(typeof parseDevelopmentsQuery).toBe('function');
  });

});

describe('writeDevelopmentsQuery', () => {

  it('writeDevelopmentsQuery is exported', () => {
    expect(typeof writeDevelopmentsQuery).toBe('function');
  });

});

describe('countActiveDevelopmentFilters', () => {

  it('countActiveDevelopmentFilters is exported', () => {
    expect(typeof countActiveDevelopmentFilters).toBe('function');
  });

});

describe('clearDevelopmentFilters', () => {

  it('clearDevelopmentFilters is exported', () => {
    expect(typeof clearDevelopmentFilters).toBe('function');
  });

});

describe('toDevelopmentCard', () => {

  it('toDevelopmentCard is exported', () => {
    expect(typeof toDevelopmentCard).toBe('function');
  });

});

describe('DEVELOPMENTS_SORTS', () => {
  it('is defined', () => {
    expect(DEVELOPMENTS_SORTS).toBeDefined();
  });
});
