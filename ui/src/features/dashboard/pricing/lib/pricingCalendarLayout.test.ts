import { describe, expect, it } from 'vitest';

import { pricingCalendarFormGridClassName } from './pricingCalendarLayout';

describe('pricingCalendarFormGridClassName', () => {
  it('uses a narrower rates column when compact chrome is on', () => {
    expect(pricingCalendarFormGridClassName(true)).toContain('minmax(12.5rem,16rem)');
    expect(pricingCalendarFormGridClassName(true)).not.toContain('340px');
  });

  it('uses the default rates column width when compact chrome is off', () => {
    expect(pricingCalendarFormGridClassName(false)).toContain('340px');
  });
});
