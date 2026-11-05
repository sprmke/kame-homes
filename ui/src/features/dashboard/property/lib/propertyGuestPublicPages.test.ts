import { describe, expect, it } from 'vitest';

import { buildPropertyGuestPublicPages } from '@/features/dashboard/property/lib/propertyGuestPublicPages';

const pages = buildPropertyGuestPublicPages('sample-org', 'property-1');

describe('buildPropertyGuestPublicPages', () => {
  it('groups pages into design, share, and booking links', () => {
    expect(pages.filter((page) => page.group === 'design').map((page) => page.id)).toEqual([
      'showcase',
      'stay-guide',
      'listing',
    ]);
    expect(pages.filter((page) => page.group === 'share').map((page) => page.id)).toEqual([
      'calendar',
      'form',
      'pay-parking',
    ]);
    expect(pages.filter((page) => page.group === 'booking').map((page) => page.id)).toEqual([
      'messages',
      'sd-form',
      'guest-review',
    ]);
  });

  it('only marks booking or date-dependent pages with a copy picker', () => {
    const pickers = Object.fromEntries(
      pages.filter((page) => page.copyPicker).map((page) => [page.id, page.copyPicker])
    );

    expect(pickers).toEqual({
      calendar: 'stay-dates',
      messages: 'stay-dates',
      'sd-form': 'sd-refund',
      'guest-review': 'guest-review',
    });
  });

  it('copies a plain marketplace link for find parking', () => {
    const parking = pages.find((page) => page.id === 'pay-parking');

    expect(parking?.path).toBe('/parkings');
    expect(parking?.copyPath).toBeUndefined();
  });
});
