import { describe, expect, it } from 'vitest';

import { applyBrandAccentToCalendarStyles } from '@/features/dashboard/marketing/lib/calendarBrandColors';

describe('applyBrandAccentToCalendarStyles', () => {

  it('applyBrandAccentToCalendarStyles is exported', () => {
    expect(typeof applyBrandAccentToCalendarStyles).toBe('function');
  });

});
