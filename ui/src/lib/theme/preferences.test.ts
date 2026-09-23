import { describe, expect, it } from 'vitest';

import { resolveTheme, readStoredTheme, applyThemeClass, persistTheme } from '@/lib/theme/preferences';

describe('resolveTheme', () => {

  it('resolveTheme is exported', () => {
    expect(typeof resolveTheme).toBe('function');
  });

});

describe('readStoredTheme', () => {

  it('readStoredTheme is exported', () => {
    expect(typeof readStoredTheme).toBe('function');
  });

});

describe('applyThemeClass', () => {

  it('applyThemeClass is exported', () => {
    expect(typeof applyThemeClass).toBe('function');
  });

});

describe('persistTheme', () => {

  it('persistTheme is exported', () => {
    expect(typeof persistTheme).toBe('function');
  });

});
