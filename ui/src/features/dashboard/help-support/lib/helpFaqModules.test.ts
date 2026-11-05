import { describe, expect, it } from 'vitest';

import {
  availableFaqCategories,
  browseFaqs,
  COMMON_FAQ_LIMIT,
  faqAdminScopeForFaq,
  faqMatchesAdminScope,
  faqModuleForCategory,
  faqVisibleInGuestHelp,
  faqVisibleInHostHelp,
  FAQ_MODULE_IDS,
  pickCommonFaqs,
} from '@/features/dashboard/help-support/lib/helpFaqModules';

type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  source_route_guide_path?: string | null;
  audience?: 'host' | 'guest' | 'public' | null;
};

const faqs: Faq[] = [
  {
    id: '1',
    category: 'Getting Started',
    question: 'Can I own two organizations?',
    answer: 'No.',
    sort_order: 10,
    audience: 'host',
  },
  {
    id: '2',
    category: 'Bookings',
    question: 'How do I import bookings?',
    answer: 'Use Import.',
    sort_order: 10,
    source_route_guide_path: 'docs/guides/routes/org/property/bookings.md',
    audience: 'host',
  },
  {
    id: '3',
    category: 'Parking',
    question: 'How do weekend rates work?',
    answer: 'Friday to Sunday.',
    sort_order: 10,
    source_route_guide_path: 'docs/guides/routes/org/parking/pricing.md',
    audience: 'host',
  },
  {
    id: '4',
    category: 'Guest Portal',
    question: 'Where are my trips?',
    answer: 'In Trips.',
    sort_order: 10,
    audience: 'guest',
  },
  {
    id: '5',
    category: 'Account & Security',
    question: 'Is there a password?',
    answer: 'No password.',
    sort_order: 10,
    audience: 'public',
  },
];

describe('faqModuleForCategory', () => {
  it('maps known categories and falls back to property', () => {
    expect(faqModuleForCategory('Bookings')).toBe('bookings');
    expect(faqModuleForCategory('Plans & Billing')).toBe('plans');
    expect(faqModuleForCategory('Unknown')).toBe('property');
  });
});

describe('faqAdminScopeForFaq', () => {
  it('uses fixed categories and path-scoped categories', () => {
    expect(faqAdminScopeForFaq({ category: 'Getting Started' })).toBe('org');
    expect(faqAdminScopeForFaq({ category: 'Bookings' })).toBe('property');
    expect(
      faqAdminScopeForFaq({
        category: 'Parking',
        source_route_guide_path: 'docs/guides/routes/org/parking/pricing.md',
      })
    ).toBe('parking');
    expect(
      faqAdminScopeForFaq({
        category: 'Team & Permissions',
        source_route_guide_path: 'docs/guides/routes/org/property/team.md',
      })
    ).toBe('property');
  });

  it('never mounts a guest-only category in host Help', () => {
    expect(faqMatchesAdminScope({ category: 'Guest Portal' }, 'org')).toBe(false);
    expect(faqMatchesAdminScope({ category: 'Vouchers & Rewards' }, 'property')).toBe(false);
  });
});

describe('audience filters', () => {
  it('keeps guest-only rows out of host Help and host-only rows out of guest Help', () => {
    expect(faqVisibleInHostHelp({ audience: 'guest' })).toBe(false);
    expect(faqVisibleInHostHelp({ audience: 'host' })).toBe(true);
    expect(faqVisibleInHostHelp({ audience: 'public' })).toBe(true);
    expect(faqVisibleInGuestHelp({ audience: 'host' })).toBe(false);
    expect(faqVisibleInGuestHelp({ audience: 'public' })).toBe(true);
  });
});

describe('pickCommonFaqs', () => {
  it('returns scoped, non-guest FAQs and respects the limit', () => {
    expect(pickCommonFaqs(faqs, 'org').map((faq) => faq.id)).toEqual(['1', '5']);
    expect(pickCommonFaqs(faqs, 'property').map((faq) => faq.id)).toEqual(['2']);
    expect(pickCommonFaqs(faqs, 'parking').map((faq) => faq.id)).toEqual(['3']);
    expect(pickCommonFaqs(faqs, 'property', 1)).toHaveLength(1);
    expect(COMMON_FAQ_LIMIT).toBeGreaterThan(8);
  });
});

describe('browseFaqs', () => {
  it('searches question and answer inside the current mount', () => {
    expect(browseFaqs(faqs, 'property', { term: 'import' }).map((faq) => faq.id)).toEqual(['2']);
    expect(browseFaqs(faqs, 'property', { term: 'No.' }).map((faq) => faq.id)).toEqual([]);
    expect(browseFaqs(faqs, 'org', { term: 'password' }).map((faq) => faq.id)).toEqual(['5']);
  });

  it('filters by category', () => {
    expect(browseFaqs(faqs, 'property', { category: 'Bookings' })).toHaveLength(1);
    expect(browseFaqs(faqs, 'org', { category: 'Guest Portal' })).toHaveLength(0);
  });
});

describe('availableFaqCategories', () => {
  it('returns only categories present on this mount', () => {
    expect(availableFaqCategories(faqs, 'property')).toEqual(['Bookings']);
    expect(availableFaqCategories(faqs, 'org')).toEqual(['Getting Started', 'Account & Security']);
    expect(availableFaqCategories(faqs, 'parking')).toEqual(['Parking']);
  });
});

describe('FAQ_MODULE_IDS', () => {
  it('includes every module added for the expanded catalog', () => {
    expect(FAQ_MODULE_IDS).toContain('plans');
    expect(FAQ_MODULE_IDS).toContain('marketing');
    expect(FAQ_MODULE_IDS).toContain('analytics');
    expect(FAQ_MODULE_IDS).toContain('pricing');
    expect(FAQ_MODULE_IDS).toContain('activity');
    expect(FAQ_MODULE_IDS).toContain('guest');
  });
});
