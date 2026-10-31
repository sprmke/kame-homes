import { describe, expect, it } from 'vitest';

import {
  COPY_PROPERTY_SETTINGS_GROUP_IDS,
  COPY_PROPERTY_SETTINGS_GROUPS,
  copyPropertySettingsGroupIds,
  copyPropertySettingsGroupsByCategory,
  copyPropertySettingsGroupsForPhase,
} from '@/features/dashboard/org/lib/copyPropertySettingsGroups';

/** Frozen mirror of edge `CLONE_GROUP_IDS` — update both when adding a group. */
const EDGE_CLONE_GROUP_IDS = [
  'propertyDetails',
  'listingContent',
  'amenities',
  'houseRules',
  'cancellationPolicy',
  'guestForm',
  'branding',
  'contact',
  'emailAutomations',
  'pricingRates',
  'smartPricing',
  'voucherConfig',
  'publicPages',
  'templates',
  'telegramNotifications',
  'inboxSnippets',
  'teamRoles',
  'media',
  'buildingForms',
  'marketingTemplates',
  'financeRecurring',
  'maintenanceRecurring',
] as const;

describe('copyPropertySettingsGroups', () => {
  it('matches edge CLONE_GROUP_IDS order and membership', () => {
    expect([...COPY_PROPERTY_SETTINGS_GROUP_IDS]).toEqual([...EDGE_CLONE_GROUP_IDS]);
    expect(copyPropertySettingsGroupIds()).toEqual([...EDGE_CLONE_GROUP_IDS]);
  });

  it('catalog covers every id exactly once', () => {
    const ids = COPY_PROPERTY_SETTINGS_GROUPS.map((g) => g.id);
    expect(ids).toHaveLength(COPY_PROPERTY_SETTINGS_GROUP_IDS.length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of COPY_PROPERTY_SETTINGS_GROUP_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('phase filter returns only groups up to maxPhase', () => {
    const phase1 = copyPropertySettingsGroupsForPhase(1);
    expect(phase1.every((g) => g.phase <= 1)).toBe(true);
    expect(phase1.some((g) => g.id === 'media')).toBe(false);
    expect(phase1.some((g) => g.id === 'propertyDetails')).toBe(true);

    const phase2 = copyPropertySettingsGroupsForPhase(2);
    expect(phase2.some((g) => g.id === 'media')).toBe(true);
    expect(phase2.some((g) => g.id === 'financeRecurring')).toBe(false);
  });

  it('contact defaults off as opt-in', () => {
    const contact = COPY_PROPERTY_SETTINGS_GROUPS.find((g) => g.id === 'contact');
    expect(contact?.defaultOn).toBe(false);
    expect(contact?.optIn).toBe(true);
  });

  it('groups by sidebar category labels', () => {
    const sections = copyPropertySettingsGroupsByCategory(COPY_PROPERTY_SETTINGS_GROUPS);
    expect(sections.map((s) => s.label)).toEqual([
      'Settings',
      'Pricing',
      'Team',
      'Marketing',
      'Inbox',
      'Notifications',
      'Templates',
      'Public Pages',
      'Finance',
      'Maintenance',
    ]);
    const settings = sections.find((s) => s.category === 'settings');
    expect(settings?.groups.some((g) => g.id === 'emailAutomations')).toBe(true);
    expect(settings?.groups.some((g) => g.id === 'telegramNotifications')).toBe(false);
    const notifications = sections.find((s) => s.category === 'notifications');
    expect(notifications?.groups.map((g) => g.id)).toEqual(['telegramNotifications']);
  });
});
