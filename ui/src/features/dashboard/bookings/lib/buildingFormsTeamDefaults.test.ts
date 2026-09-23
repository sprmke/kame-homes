import { describe, expect, it } from 'vitest';

import { pickBuildingFormsTeamContact, applyBuildingFormsTeamDefaults } from '@/features/dashboard/bookings/lib/buildingFormsTeamDefaults';

describe('pickBuildingFormsTeamContact', () => {

  it('pickBuildingFormsTeamContact is exported', () => {
    expect(typeof pickBuildingFormsTeamContact).toBe('function');
  });

});

describe('applyBuildingFormsTeamDefaults', () => {

  it('applyBuildingFormsTeamDefaults is exported', () => {
    expect(typeof applyBuildingFormsTeamDefaults).toBe('function');
  });

});
