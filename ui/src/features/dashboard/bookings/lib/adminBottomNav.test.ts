import { describe, expect, it } from 'vitest';

import { flattenNavigableNavItems, splitAdminBottomNav, resolveBottomTabActiveKey, ASSISTANT_TAB_KEY, NOTIFICATIONS_TAB_KEY } from '@/features/dashboard/bookings/lib/adminBottomNav';

describe('flattenNavigableNavItems', () => {

  it('flattenNavigableNavItems is exported', () => {
    expect(typeof flattenNavigableNavItems).toBe('function');
  });

});

describe('splitAdminBottomNav', () => {

  it('splitAdminBottomNav is exported', () => {
    expect(typeof splitAdminBottomNav).toBe('function');
  });

});

describe('resolveBottomTabActiveKey', () => {

  it('resolveBottomTabActiveKey is exported', () => {
    expect(typeof resolveBottomTabActiveKey).toBe('function');
  });

});

describe('ASSISTANT_TAB_KEY', () => {
  it('is defined', () => {
    expect(ASSISTANT_TAB_KEY).toBeDefined();
  });
});

describe('NOTIFICATIONS_TAB_KEY', () => {
  it('is defined', () => {
    expect(NOTIFICATIONS_TAB_KEY).toBeDefined();
  });
});
