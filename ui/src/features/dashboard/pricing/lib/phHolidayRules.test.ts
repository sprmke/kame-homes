import { describe, expect, it } from 'vitest';

import { holidayRulesFromDto, findHolidayRuleDtoForDateKey, findHolidayRuleForDate } from '@/features/dashboard/pricing/lib/phHolidayRules';

describe('holidayRulesFromDto', () => {

  it('holidayRulesFromDto is exported', () => {
    expect(typeof holidayRulesFromDto).toBe('function');
  });

});

describe('findHolidayRuleDtoForDateKey', () => {

  it('findHolidayRuleDtoForDateKey is exported', () => {
    expect(typeof findHolidayRuleDtoForDateKey).toBe('function');
  });

});

describe('findHolidayRuleForDate', () => {

  it('findHolidayRuleForDate is exported', () => {
    expect(typeof findHolidayRuleForDate).toBe('function');
  });

});
