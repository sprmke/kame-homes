import { describe, expect, it } from 'vitest';

import { expandSettingsPhase5PermissionIds, SETTINGS_SECTION_EDIT_IDS } from '@/features/dashboard/team/lib/settingsPermissionExpansion';

describe('expandSettingsPhase5PermissionIds', () => {

  it('expandSettingsPhase5PermissionIds is exported', () => {
    expect(typeof expandSettingsPhase5PermissionIds).toBe('function');
  });

});

describe('SETTINGS_SECTION_EDIT_IDS', () => {
  it('is defined', () => {
    expect(SETTINGS_SECTION_EDIT_IDS).toBeDefined();
  });
});
