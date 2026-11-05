import type { HelpSupportAdminScope } from '@/features/dashboard/help-support/lib/helpSupportPaths';

export type HelpFaqAudience = 'host' | 'guest' | 'public';

export const FAQ_MODULE_IDS = [
  'getting-started',
  'bookings',
  'property',
  'parking',
  'plans',
  'marketing',
  'analytics',
  'pricing',
  'activity',
  'guest',
] as const;

/** Common FAQs shown before a host searches or browses a category. */
export const COMMON_FAQ_LIMIT = 10;

export type FaqModuleId = (typeof FAQ_MODULE_IDS)[number];

export type FaqModule = {
  id: FaqModuleId;
  label: string;
  description: string;
  categories: readonly string[];
};

export const FAQ_MODULES: readonly FaqModule[] = [
  {
    id: 'getting-started',
    label: 'Getting started',
    description: 'Accounts and access',
    categories: ['Getting Started', 'Team & Permissions', 'Account & Security'],
  },
  {
    id: 'bookings',
    label: 'Bookings',
    description: 'Stays and calendar',
    categories: ['Bookings'],
  },
  {
    id: 'property',
    label: 'Property',
    description: 'Settings and guests',
    categories: [
      'Property Settings',
      'Notifications',
      'Guest Communication',
      'Billing & Finance',
      'Maintenance & Operations',
      'AI Assistant',
    ],
  },
  {
    id: 'parking',
    label: 'Parking',
    description: 'Slots and rates',
    categories: ['Parking'],
  },
  {
    id: 'plans',
    label: 'Plans & billing',
    description: 'Tiers and payments',
    categories: ['Plans & Billing'],
  },
  {
    id: 'marketing',
    label: 'Marketing & pages',
    description: 'Studio and public links',
    categories: ['Marketing Studio', 'Public Pages'],
  },
  {
    id: 'analytics',
    label: 'Analytics & reviews',
    description: 'Performance and reputation',
    categories: ['Analytics & Reports', 'Reviews & Reputation'],
  },
  {
    id: 'pricing',
    label: 'Pricing & availability',
    description: 'Rates and blocked dates',
    categories: ['Pricing & Availability'],
  },
  {
    id: 'activity',
    label: 'Activity & notices',
    description: 'Audit history and announcements',
    categories: ['Activity & Audit', 'Announcements'],
  },
  {
    id: 'guest',
    label: 'Guest help',
    description: 'Trips, messages, and vouchers',
    categories: ['Guest Portal', 'Vouchers & Rewards'],
  },
];

/**
 * Fixed category to mount. Used first so guide paths like `org/settings.md` for
 * AI Assistant do not leak AI FAQs onto the org Help page.
 */
const CATEGORY_SCOPE: Record<string, HelpSupportAdminScope> = {
  'Getting Started': 'org',
  Bookings: 'property',
  'Property Settings': 'property',
  Notifications: 'property',
  'Guest Communication': 'property',
  'Maintenance & Operations': 'property',
  'AI Assistant': 'property',
  'Plans & Billing': 'org',
  'Marketing Studio': 'property',
  'Analytics & Reports': 'property',
  'Reviews & Reputation': 'property',
  'Public Pages': 'property',
  'Pricing & Availability': 'property',
  Announcements: 'org',
  'Account & Security': 'org',
  // Guest-only categories never render in a host Help mount; the audience filter
  // in pickCommonFaqs and browseFaqs excludes them. They still need a scope entry
  // so every category is explicitly classified.
  'Guest Portal': 'org',
  'Vouchers & Rewards': 'org',
};

/** Categories with no host Help surface at all. */
const GUEST_ONLY_CATEGORIES = new Set(['Guest Portal', 'Vouchers & Rewards']);

/**
 * Categories whose scope depends on `source_route_guide_path`
 * (property vs parking team/finance/activity, org parkings list vs slot pages).
 */
const PATH_SCOPED_CATEGORIES = new Set([
  'Parking',
  'Team & Permissions',
  'Billing & Finance',
  'Activity & Audit',
]);

/**
 * Preferred category order (and optional per-category cap) when building the
 * common FAQ list for each Help & Support mount.
 */
const SCOPE_PICK: Record<
  HelpSupportAdminScope,
  { categories: readonly string[]; maxPerCategory?: number }
> = {
  org: {
    categories: ['Getting Started', 'Plans & Billing', 'Parking', 'Account & Security'],
  },
  property: {
    categories: [
      'Bookings',
      'Property Settings',
      'Team & Permissions',
      'Notifications',
      'Guest Communication',
      'Billing & Finance',
      'Maintenance & Operations',
      'AI Assistant',
      'Marketing Studio',
      'Analytics & Reports',
      'Reviews & Reputation',
      'Public Pages',
      'Pricing & Availability',
    ],
    maxPerCategory: 2,
  },
  parking: {
    categories: [
      'Parking',
      'Team & Permissions',
      'Billing & Finance',
      'Activity & Audit',
      'Announcements',
    ],
    maxPerCategory: 3,
  },
};

const CATEGORY_TO_MODULE = new Map<string, FaqModuleId>();
for (const module of FAQ_MODULES) {
  for (const category of module.categories) {
    CATEGORY_TO_MODULE.set(category, module.id);
  }
}

/** Category labels in the order the FAQ browse list should show them. */
export const FAQ_CATEGORIES: readonly string[] = Array.from(
  new Set(FAQ_MODULES.flatMap((module) => module.categories))
).filter((category) => !GUEST_ONLY_CATEGORIES.has(category));

export function faqModuleForCategory(category: string): FaqModuleId {
  return CATEGORY_TO_MODULE.get(category) ?? 'property';
}

export function faqModuleById(id: FaqModuleId): FaqModule {
  const fallback = FAQ_MODULES[0];
  if (!fallback) throw new Error('FAQ_MODULES is empty');
  return FAQ_MODULES.find((module) => module.id === id) ?? fallback;
}

export function isGuestOnlyCategory(category: string): boolean {
  return GUEST_ONLY_CATEGORIES.has(category);
}

function scopeFromRouteGuidePath(path: string): HelpSupportAdminScope {
  const normalized = path.replace(/^docs\/guides\/routes\//, '');
  if (normalized.startsWith('org/property/')) return 'property';
  if (normalized.startsWith('org/parking/')) return 'parking';
  // org/parkings.md, org/team.md, org/settings.md, …
  return 'org';
}

/**
 * Resolve which Help & Support mount an FAQ belongs to.
 * Fixed categories win over guide path (keeps AI Assistant on property only).
 */
export function faqAdminScopeForFaq(faq: {
  category: string;
  source_route_guide_path?: string | null;
}): HelpSupportAdminScope {
  const fixed = CATEGORY_SCOPE[faq.category];
  if (fixed) return fixed;

  if (PATH_SCOPED_CATEGORIES.has(faq.category)) {
    const path = faq.source_route_guide_path?.trim() ?? '';
    if (path) return scopeFromRouteGuidePath(path);
    // No path (super-admin editor): Parking goes to parking; the rest to property.
    if (faq.category === 'Parking') return 'parking';
    return 'property';
  }

  return 'property';
}

export function faqMatchesAdminScope(
  faq: { category: string; source_route_guide_path?: string | null },
  scope: HelpSupportAdminScope
): boolean {
  if (isGuestOnlyCategory(faq.category)) return false;
  return faqAdminScopeForFaq(faq) === scope;
}

/** Host Help never shows guest-only answers. Public answers are fine for hosts. */
export function faqVisibleInHostHelp(faq: { audience?: HelpFaqAudience | null }): boolean {
  return faq.audience !== 'guest';
}

/** Guest portal shows guest and public answers, never host-only ones. */
export function faqVisibleInGuestHelp(faq: { audience?: HelpFaqAudience | null }): boolean {
  return faq.audience !== 'host';
}

function compareFaqs<T extends { sort_order: number; category: string; question?: string }>(
  a: T,
  b: T
): number {
  return (
    a.sort_order - b.sort_order ||
    a.category.localeCompare(b.category) ||
    (a.question ?? '').localeCompare(b.question ?? '')
  );
}

/** Top common FAQs for the current org / property / parking Help mount. */
export function pickCommonFaqs<
  T extends {
    sort_order: number;
    category: string;
    question?: string;
    source_route_guide_path?: string | null;
    audience?: HelpFaqAudience | null;
  },
>(faqs: T[], scope: HelpSupportAdminScope, limit = COMMON_FAQ_LIMIT): T[] {
  const pick = SCOPE_PICK[scope];
  const matching = faqs.filter(
    (faq) => faqVisibleInHostHelp(faq) && faqMatchesAdminScope(faq, scope)
  );
  const byCategory = new Map<string, T[]>();

  for (const faq of matching) {
    const list = byCategory.get(faq.category);
    if (list) list.push(faq);
    else byCategory.set(faq.category, [faq]);
  }

  for (const list of byCategory.values()) {
    list.sort(compareFaqs);
  }

  const selected: T[] = [];
  for (const category of pick.categories) {
    if (selected.length >= limit) break;
    const list = byCategory.get(category);
    if (!list?.length) continue;
    const take = pick.maxPerCategory
      ? Math.min(pick.maxPerCategory, list.length, limit - selected.length)
      : Math.min(list.length, limit - selected.length);
    selected.push(...list.slice(0, take));
  }

  return selected;
}

/** Categories with at least one FAQ visible on this mount, in preferred order. */
export function availableFaqCategories<
  T extends {
    category: string;
    source_route_guide_path?: string | null;
    audience?: HelpFaqAudience | null;
  },
>(faqs: T[], scope: HelpSupportAdminScope): string[] {
  const present = new Set(
    faqs
      .filter((faq) => faqVisibleInHostHelp(faq) && faqMatchesAdminScope(faq, scope))
      .map((faq) => faq.category)
  );
  const ordered = FAQ_CATEGORIES.filter((category) => present.has(category));
  const extra = [...present].filter((category) => !ordered.includes(category)).sort();
  return [...ordered, ...extra];
}

/** FAQs visible on this mount, optionally filtered by category and search term. */
export function browseFaqs<
  T extends {
    category: string;
    question: string;
    answer: string;
    sort_order: number;
    source_route_guide_path?: string | null;
    audience?: HelpFaqAudience | null;
  },
>(faqs: T[], scope: HelpSupportAdminScope, options?: { category?: string; term?: string }): T[] {
  const term = options?.term?.trim().toLowerCase() ?? '';
  const category = options?.category ?? '';
  return faqs
    .filter((faq) => faqVisibleInHostHelp(faq) && faqMatchesAdminScope(faq, scope))
    .filter((faq) => !category || faq.category === category)
    .filter(
      (faq) =>
        !term ||
        faq.question.toLowerCase().includes(term) ||
        faq.answer.toLowerCase().includes(term)
    )
    .sort(compareFaqs);
}
