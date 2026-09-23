import { describe, expect, it } from 'vitest';

import { CALENDAR_DESIGNER_PRESET_IDS } from '@/features/dashboard/marketing/lib/calendarPresets';

describe('CALENDAR_DESIGNER_PRESET_IDS', () => {
  it('is defined', () => {
    expect(CALENDAR_DESIGNER_PRESET_IDS).toBeDefined();
  });
});
