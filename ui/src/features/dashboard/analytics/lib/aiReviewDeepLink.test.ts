import { describe, expect, it } from 'vitest';

import { analyticsDeepLinkPageLabel } from '@/features/dashboard/analytics/lib/aiReviewDeepLink';

const BASE = '/org/acme/property/monaco-2612';

describe('analyticsDeepLinkPageLabel', () => {
  it('labels every route the server allow-list can emit', () => {
    expect(analyticsDeepLinkPageLabel(`${BASE}/pricing`)).toBe('Pricing');
    expect(analyticsDeepLinkPageLabel(`${BASE}/analytics`)).toBe('Analytics');
    expect(analyticsDeepLinkPageLabel(`${BASE}/marketing`)).toBe('Marketing');
    expect(analyticsDeepLinkPageLabel(`${BASE}/public-pages`)).toBe('Public Pages');
    expect(analyticsDeepLinkPageLabel(`${BASE}/settings`)).toBe('Settings');
    expect(analyticsDeepLinkPageLabel(`${BASE}/inbox`)).toBe('Inbox');
  });

  it('ignores query, hash, and trailing slashes', () => {
    expect(analyticsDeepLinkPageLabel(`${BASE}/pricing/`)).toBe('Pricing');
    expect(analyticsDeepLinkPageLabel(`${BASE}/pricing?from=2026-09-01`)).toBe('Pricing');
    expect(analyticsDeepLinkPageLabel(`${BASE}/inbox#thread-1`)).toBe('Inbox');
  });

  it('returns null when there is no usable slug segment', () => {
    expect(analyticsDeepLinkPageLabel(null)).toBeNull();
    expect(analyticsDeepLinkPageLabel(undefined)).toBeNull();
    expect(analyticsDeepLinkPageLabel('')).toBeNull();
    expect(analyticsDeepLinkPageLabel('/')).toBeNull();
    expect(analyticsDeepLinkPageLabel(`${BASE}/Pricing`)).toBeNull();
    expect(analyticsDeepLinkPageLabel(`${BASE}/2612`)).toBeNull();
  });
});
