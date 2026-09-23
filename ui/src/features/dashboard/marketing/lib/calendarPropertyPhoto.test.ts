import { describe, expect, it } from 'vitest';

import { applyPropertyPhotoToCalendarStyles } from '@/features/dashboard/marketing/lib/calendarPropertyPhoto';

describe('applyPropertyPhotoToCalendarStyles', () => {

  it('applyPropertyPhotoToCalendarStyles is exported', () => {
    expect(typeof applyPropertyPhotoToCalendarStyles).toBe('function');
  });

});
