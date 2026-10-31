import type { HelpSupportAdminScope } from '@/features/dashboard/help-support/lib/helpSupportPaths';

export const FAQ_MODULE_IDS = ['getting-started', 'bookings', 'property', 'parking'] as const;

export const COMMON_FAQ_LIMIT = 8;

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
    description: 'Accounts and team',
    categories: ['Getting Started', 'Team & Permissions'],
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
];

/**
 * Fixed category → mount. Used first so guide paths like `org/settings.md` for
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
};

/**
 * Categories whose scope depends on `source_route_guide_path`
 * (property vs parking team/finance, org parkings list vs slot pages).
 */
const PATH_SCOPED_CATEGORIES = new Set(['Parking', 'Team & Permissions', 'Billing & Finance']);

/**
 * Preferred category order (and optional per-category cap) when building the
 * common FAQ list for each Help & Support mount.
 */
const SCOPE_PICK: Record<
  HelpSupportAdminScope,
  { categories: readonly string[]; maxPerCategory?: number }
> = {
  org: {
    // Org account/team first; then portfolio parkings (Add parking, standalone vs stay).
    categories: ['Getting Started', 'Parking'],
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
    ],
    maxPerCategory: 1,
  },
  parking: {
    categories: ['Parking', 'Team & Permissions', 'Billing & Finance'],
    maxPerCategory: 3,
  },
};

const CATEGORY_TO_MODULE = new Map<string, FaqModuleId>();
for (const module of FAQ_MODULES) {
  for (const category of module.categories) {
    CATEGORY_TO_MODULE.set(category, module.id);
  }
}

export function faqModuleForCategory(category: string): FaqModuleId {
  return CATEGORY_TO_MODULE.get(category) ?? 'property';
}

export function faqModuleById(id: FaqModuleId): FaqModule {
  const fallback = FAQ_MODULES[0];
  if (!fallback) throw new Error('FAQ_MODULES is empty');
  return FAQ_MODULES.find((module) => module.id === id) ?? fallback;
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
    // No path (super-admin editor): Parking → parking; team/finance → property.
    if (faq.category === 'Parking') return 'parking';
    return 'property';
  }

  return 'property';
}

export function faqMatchesAdminScope(
  faq: { category: string; source_route_guide_path?: string | null },
  scope: HelpSupportAdminScope
): boolean {
  return faqAdminScopeForFaq(faq) === scope;
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
  },
>(faqs: T[], scope: HelpSupportAdminScope, limit = COMMON_FAQ_LIMIT): T[] {
  const pick = SCOPE_PICK[scope];
  const matching = faqs.filter((faq) => faqMatchesAdminScope(faq, scope));
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
