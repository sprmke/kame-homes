import { describe, expect, it } from 'vitest';

import { parseMaintenanceQueryFromParams, writeMaintenanceQueryToParams, maintenanceQueryToApiParams, rangeForPreset, detectPreset } from '@/features/dashboard/maintenance/lib/maintenancePeriod';

describe('parseMaintenanceQueryFromParams', () => {

  it('parseMaintenanceQueryFromParams is exported', () => {
    expect(typeof parseMaintenanceQueryFromParams).toBe('function');
  });

});

describe('writeMaintenanceQueryToParams', () => {

  it('writeMaintenanceQueryToParams is exported', () => {
    expect(typeof writeMaintenanceQueryToParams).toBe('function');
  });

});

describe('maintenanceQueryToApiParams', () => {

  it('maintenanceQueryToApiParams is exported', () => {
    expect(typeof maintenanceQueryToApiParams).toBe('function');
  });

});

describe('rangeForPreset', () => {
  it('is defined', () => {
    expect(rangeForPreset).toBeDefined();
  });
});

describe('detectPreset', () => {
  it('is defined', () => {
    expect(detectPreset).toBeDefined();
  });
});
