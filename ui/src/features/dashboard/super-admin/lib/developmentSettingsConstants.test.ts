import { describe, expect, it } from 'vitest';

import { developmentTypeLabel, developmentStatusLabel, DEVELOPMENT_STATUSES, DEVELOPMENT_AMENITY_SUGGESTIONS } from '@/features/dashboard/super-admin/lib/developmentSettingsConstants';

describe('developmentTypeLabel', () => {

  it('developmentTypeLabel is exported', () => {
    expect(typeof developmentTypeLabel).toBe('function');
  });

});

describe('developmentStatusLabel', () => {

  it('developmentStatusLabel is exported', () => {
    expect(typeof developmentStatusLabel).toBe('function');
  });

});

describe('DEVELOPMENT_STATUSES', () => {
  it('is defined', () => {
    expect(DEVELOPMENT_STATUSES).toBeDefined();
  });
});

describe('DEVELOPMENT_AMENITY_SUGGESTIONS', () => {
  it('is defined', () => {
    expect(DEVELOPMENT_AMENITY_SUGGESTIONS).toBeDefined();
  });
});
