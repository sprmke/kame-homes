import { describe, expect, it } from 'vitest';

import { resolvePropertySettingsFieldError, propertySettingsSectionBanner } from '@/features/dashboard/org/lib/propertySettingsFieldError';

describe('resolvePropertySettingsFieldError', () => {

  it('resolvePropertySettingsFieldError is exported', () => {
    expect(typeof resolvePropertySettingsFieldError).toBe('function');
  });

});

describe('propertySettingsSectionBanner', () => {

  it('propertySettingsSectionBanner is exported', () => {
    expect(typeof propertySettingsSectionBanner).toBe('function');
  });

});
