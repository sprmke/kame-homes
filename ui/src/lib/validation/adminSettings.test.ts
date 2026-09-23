import { describe, expect, it } from 'vitest';

import { validateOptionalAdminEmail, validateAdminEmailList, validateOptionalAdminUrl, validateRequiredAdminUrl } from '@/lib/validation/adminSettings';

describe('validateOptionalAdminEmail', () => {

  it('validateOptionalAdminEmail is exported', () => {
    expect(typeof validateOptionalAdminEmail).toBe('function');
  });

});

describe('validateAdminEmailList', () => {

  it('validateAdminEmailList is exported', () => {
    expect(typeof validateAdminEmailList).toBe('function');
  });

});

describe('validateOptionalAdminUrl', () => {

  it('validateOptionalAdminUrl is exported', () => {
    expect(typeof validateOptionalAdminUrl).toBe('function');
  });

});

describe('validateRequiredAdminUrl', () => {

  it('validateRequiredAdminUrl is exported', () => {
    expect(typeof validateRequiredAdminUrl).toBe('function');
  });

});
