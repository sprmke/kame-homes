import { describe, expect, it } from 'vitest';

import {
  filterCategorySuggestions,
  normalizeCategoryValue,
  resolveCategorySuggestion,
  resolveCategoryValue,
  shouldOfferCustomCategory,
} from '@/components/forms/categoryComboboxModel';

const SUGGESTIONS = ['Rent', 'Utilities', 'Cleaning', 'Other'] as const;

describe('filterCategorySuggestions', () => {
  it('returns every suggestion for an empty or whitespace query', () => {
    expect(filterCategorySuggestions(SUGGESTIONS, '')).toEqual([...SUGGESTIONS]);
    expect(filterCategorySuggestions(SUGGESTIONS, '   ')).toEqual([...SUGGESTIONS]);
  });

  it('matches substrings case-insensitively', () => {
    expect(filterCategorySuggestions(SUGGESTIONS, 'uti')).toEqual(['Utilities']);
    expect(filterCategorySuggestions(SUGGESTIONS, 'CLEAN')).toEqual(['Cleaning']);
  });

  it('returns no matches for unknown text', () => {
    expect(filterCategorySuggestions(SUGGESTIONS, 'zzz')).toEqual([]);
  });
});

describe('resolveCategorySuggestion', () => {
  it('returns the preset casing for a case-insensitive match', () => {
    expect(resolveCategorySuggestion(SUGGESTIONS, 'rent')).toBe('Rent');
    expect(resolveCategorySuggestion(SUGGESTIONS, '  UTILITIES ')).toBe('Utilities');
  });

  it('returns null for a new category or empty input', () => {
    expect(resolveCategorySuggestion(SUGGESTIONS, 'Garden')).toBeNull();
    expect(resolveCategorySuggestion(SUGGESTIONS, '')).toBeNull();
  });
});

describe('shouldOfferCustomCategory', () => {
  it('offers a custom row only when text is new', () => {
    expect(shouldOfferCustomCategory(SUGGESTIONS, 'Garden')).toBe(true);
    expect(shouldOfferCustomCategory(SUGGESTIONS, 'garden')).toBe(true);
    expect(shouldOfferCustomCategory(SUGGESTIONS, 'rent')).toBe(false);
    expect(shouldOfferCustomCategory(SUGGESTIONS, '')).toBe(false);
    expect(shouldOfferCustomCategory(SUGGESTIONS, '   ')).toBe(false);
  });
});

describe('resolveCategoryValue', () => {
  it('trims and canonicalizes preset casing', () => {
    expect(resolveCategoryValue(SUGGESTIONS, '  rent  ')).toBe('Rent');
    expect(resolveCategoryValue(SUGGESTIONS, '  Garden care ')).toBe('Garden care');
    expect(resolveCategoryValue(SUGGESTIONS, '   ')).toBe('');
  });
});

describe('normalizeCategoryValue', () => {
  it('trims surrounding whitespace only', () => {
    expect(normalizeCategoryValue('  Pest Control  ')).toBe('Pest Control');
  });
});
