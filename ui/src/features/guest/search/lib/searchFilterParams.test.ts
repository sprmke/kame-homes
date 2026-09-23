import { describe, expect, it } from 'vitest';

import { propertiesQueryFromSearch, shouldUsePublicListForSearchCategory, developmentsQueryFromSearch, parkingsQueryFromSearch, writePropertiesFiltersToSearch, writeDevelopmentsFiltersToSearch, writeParkingsFiltersToSearch } from '@/features/guest/search/lib/searchFilterParams';

describe('propertiesQueryFromSearch', () => {

  it('propertiesQueryFromSearch is exported', () => {
    expect(typeof propertiesQueryFromSearch).toBe('function');
  });

});

describe('shouldUsePublicListForSearchCategory', () => {

  it('shouldUsePublicListForSearchCategory is exported', () => {
    expect(typeof shouldUsePublicListForSearchCategory).toBe('function');
  });

});

describe('developmentsQueryFromSearch', () => {

  it('developmentsQueryFromSearch is exported', () => {
    expect(typeof developmentsQueryFromSearch).toBe('function');
  });

});

describe('parkingsQueryFromSearch', () => {

  it('parkingsQueryFromSearch is exported', () => {
    expect(typeof parkingsQueryFromSearch).toBe('function');
  });

});

describe('writePropertiesFiltersToSearch', () => {

  it('writePropertiesFiltersToSearch is exported', () => {
    expect(typeof writePropertiesFiltersToSearch).toBe('function');
  });

});

describe('writeDevelopmentsFiltersToSearch', () => {

  it('writeDevelopmentsFiltersToSearch is exported', () => {
    expect(typeof writeDevelopmentsFiltersToSearch).toBe('function');
  });

});

describe('writeParkingsFiltersToSearch', () => {

  it('writeParkingsFiltersToSearch is exported', () => {
    expect(typeof writeParkingsFiltersToSearch).toBe('function');
  });

});
