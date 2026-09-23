import { describe, expect, it } from 'vitest';

import { resolveParkingSettingsFieldError, parkingSettingsSectionBanner } from '@/features/dashboard/parking/lib/parkingSettingsFieldError';

describe('resolveParkingSettingsFieldError', () => {

  it('resolveParkingSettingsFieldError is exported', () => {
    expect(typeof resolveParkingSettingsFieldError).toBe('function');
  });

});

describe('parkingSettingsSectionBanner', () => {

  it('parkingSettingsSectionBanner is exported', () => {
    expect(typeof parkingSettingsSectionBanner).toBe('function');
  });

});
