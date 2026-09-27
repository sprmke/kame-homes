/**
 * UI catalog for Copy property settings — mirrors edge CLONE_GROUP_IDS.
 * Keep ids in sync with supabase/functions/_shared/propertySettingsCloneTypes.ts
 * (Vitest + Deno parity tests).
 *
 * Category labels follow property sidebar / Settings section names.
 */

import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

/** Same order as edge `CLONE_GROUP_IDS`. */
export const COPY_PROPERTY_SETTINGS_GROUP_IDS = [
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
  'voiceReceptionist',
  'aiOverrides',
  'teamRoles',
  'media',
  'buildingForms',
  'marketingTemplates',
  'financeRecurring',
  'maintenanceRecurring',
] as const;

export type CopyPropertySettingsGroupId = (typeof COPY_PROPERTY_SETTINGS_GROUP_IDS)[number];

/** Matches property sidebar modules / Settings as the host sees them. */
export type CopyPropertySettingsCategory =
  | 'settings'
  | 'pricing'
  | 'templates'
  | 'publicPages'
  | 'marketing'
  | 'inbox'
  | 'notifications'
  | 'team'
  | 'finance'
  | 'maintenance';

export type CopyPropertySettingsGroupMeta = {
  id: CopyPropertySettingsGroupId;
  label: string;
  category: CopyPropertySettingsCategory;
  /** Initial checkbox state in the wizard. */
  defaultOn: boolean;
  /** Plan feature badge when the target plan may gate this group. */
  planFeature?: PlanFeatureKey;
  /** Delivery phase — UI may hide later phases until shipped. */
  phase: 1 | 2 | 3;
  /** Opt-in content group (off by default). */
  optIn?: boolean;
};

/**
 * Settings first (most copy groups), then remaining modules in sidebar order.
 * Labels match `buildPropertyNavSections` / Settings section titles.
 */
export const COPY_PROPERTY_SETTINGS_CATEGORY_ORDER: CopyPropertySettingsCategory[] = [
  'settings',
  'pricing',
  'team',
  'marketing',
  'inbox',
  'notifications',
  'templates',
  'publicPages',
  'finance',
  'maintenance',
];

export const COPY_PROPERTY_SETTINGS_CATEGORY_LABELS: Record<CopyPropertySettingsCategory, string> =
  {
    settings: 'Settings',
    pricing: 'Pricing',
    templates: 'Templates',
    publicPages: 'Public Pages',
    marketing: 'Marketing',
    inbox: 'Inbox',
    notifications: 'Notifications',
    team: 'Team',
    finance: 'Finance',
    maintenance: 'Maintenance',
  };

export const COPY_PROPERTY_SETTINGS_GROUPS: CopyPropertySettingsGroupMeta[] = [
  // Settings (section names from PropertySettingsCard SETTINGS_SECTIONS)
  {
    id: 'propertyDetails',
    label: 'Property Details',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'listingContent',
    label: 'Description',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'contact',
    label: 'Contact details',
    category: 'settings',
    defaultOn: false,
    phase: 1,
    optIn: true,
  },
  {
    id: 'media',
    label: 'Photos & Videos',
    category: 'settings',
    defaultOn: true,
    phase: 2,
  },
  {
    id: 'amenities',
    label: 'Amenities',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'houseRules',
    label: 'House Rules',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'guestForm',
    label: 'Guest Form',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'cancellationPolicy',
    label: 'Cancellation',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'branding',
    label: 'Socials',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'voucherConfig',
    label: 'Reviews & vouchers',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'buildingForms',
    label: 'Building Forms',
    category: 'settings',
    defaultOn: true,
    phase: 2,
  },
  {
    id: 'emailAutomations',
    label: 'Email Automations',
    category: 'settings',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'voiceReceptionist',
    label: 'Voice Receptionist',
    category: 'settings',
    defaultOn: true,
    planFeature: 'aiReceptionist',
    phase: 1,
  },
  {
    id: 'aiOverrides',
    label: 'AI features',
    category: 'settings',
    defaultOn: true,
    planFeature: 'aiMonthlyCreditAllowance',
    phase: 1,
  },
  // Pricing
  {
    id: 'pricingRates',
    label: 'Rates & fees',
    category: 'pricing',
    defaultOn: true,
    phase: 1,
  },
  {
    id: 'smartPricing',
    label: 'Smart Pricing',
    category: 'pricing',
    defaultOn: true,
    planFeature: 'smartPricing',
    phase: 1,
  },
  // Team
  {
    id: 'teamRoles',
    label: 'Custom roles',
    category: 'team',
    defaultOn: true,
    planFeature: 'customRoles',
    phase: 1,
  },
  // Marketing
  {
    id: 'marketingTemplates',
    label: 'Designs',
    category: 'marketing',
    defaultOn: true,
    planFeature: 'marketingStudio',
    phase: 2,
  },
  // Inbox
  {
    id: 'inboxSnippets',
    label: 'Pinned snippets',
    category: 'inbox',
    defaultOn: true,
    phase: 1,
  },
  // Notifications (page heading: Telegram notifications)
  {
    id: 'telegramNotifications',
    label: 'Telegram notifications',
    category: 'notifications',
    defaultOn: true,
    planFeature: 'telegramNotifications',
    phase: 1,
  },
  // Templates
  {
    id: 'templates',
    label: 'Standard templates',
    category: 'templates',
    defaultOn: true,
    planFeature: 'customTemplates',
    phase: 1,
  },
  // Public Pages
  {
    id: 'publicPages',
    label: 'Editable pages',
    category: 'publicPages',
    defaultOn: true,
    phase: 1,
  },
  // Finance / Maintenance (definitions only; history never copied)
  {
    id: 'financeRecurring',
    label: 'Recurring items',
    category: 'finance',
    defaultOn: false,
    phase: 3,
  },
  {
    id: 'maintenanceRecurring',
    label: 'Recurring reminders',
    category: 'maintenance',
    defaultOn: false,
    phase: 3,
  },
];

export function copyPropertySettingsGroupsForPhase(
  maxPhase: 1 | 2 | 3 = 1
): CopyPropertySettingsGroupMeta[] {
  return COPY_PROPERTY_SETTINGS_GROUPS.filter((g) => g.phase <= maxPhase);
}

export function copyPropertySettingsGroupIds(): CopyPropertySettingsGroupId[] {
  return [...COPY_PROPERTY_SETTINGS_GROUP_IDS];
}

/** Groups ordered by sidebar category, then catalog order within each category. */
export function copyPropertySettingsGroupsByCategory(
  groups: CopyPropertySettingsGroupMeta[]
): Array<{
  category: CopyPropertySettingsCategory;
  label: string;
  groups: CopyPropertySettingsGroupMeta[];
}> {
  const map = new Map<CopyPropertySettingsCategory, CopyPropertySettingsGroupMeta[]>();
  for (const group of groups) {
    const list = map.get(group.category) ?? [];
    list.push(group);
    map.set(group.category, list);
  }
  return COPY_PROPERTY_SETTINGS_CATEGORY_ORDER.filter((category) => map.has(category)).map(
    (category) => ({
      category,
      label: COPY_PROPERTY_SETTINGS_CATEGORY_LABELS[category],
      groups: map.get(category) ?? [],
    })
  );
}
