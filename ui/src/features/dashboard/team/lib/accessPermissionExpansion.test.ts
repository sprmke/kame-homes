import { describe, expect, it } from 'vitest';

import { expandAccessPhase6PermissionIds, NOTIFICATION_MODULE_EDIT_IDS, INBOX_PHASE6_MANAGE_LEAF_IDS, TEAM_PHASE6_MANAGE_LEAF_IDS, TEAM_PHASE6_INVITE_LEAF_IDS } from '@/features/dashboard/team/lib/accessPermissionExpansion';

describe('expandAccessPhase6PermissionIds', () => {

  it('expandAccessPhase6PermissionIds is exported', () => {
    expect(typeof expandAccessPhase6PermissionIds).toBe('function');
  });

});

describe('NOTIFICATION_MODULE_EDIT_IDS', () => {
  it('is defined', () => {
    expect(NOTIFICATION_MODULE_EDIT_IDS).toBeDefined();
  });
});

describe('INBOX_PHASE6_MANAGE_LEAF_IDS', () => {
  it('is defined', () => {
    expect(INBOX_PHASE6_MANAGE_LEAF_IDS).toBeDefined();
  });
});

describe('TEAM_PHASE6_MANAGE_LEAF_IDS', () => {
  it('is defined', () => {
    expect(TEAM_PHASE6_MANAGE_LEAF_IDS).toBeDefined();
  });
});

describe('TEAM_PHASE6_INVITE_LEAF_IDS', () => {
  it('is defined', () => {
    expect(TEAM_PHASE6_INVITE_LEAF_IDS).toBeDefined();
  });
});
