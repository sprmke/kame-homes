import { describe, expect, it } from 'vitest';

import { heroSearchWhenPanelWidth, heroSearchCalendarMonthCount, heroSearchCalendarClassNames, HERO_SEARCH_TWO_MONTH_MIN_WIDTH, HERO_SEARCH_SINGLE_MONTH_PANEL_WIDTH, HERO_SEARCH_CALENDAR_CLASSNAMES, HERO_SEARCH_CALENDAR_TWO_MONTHS } from '@/features/guest/marketing/guest-landing/lib/heroSearchCalendarClassNames';

describe('heroSearchWhenPanelWidth', () => {

  it('heroSearchWhenPanelWidth is exported', () => {
    expect(typeof heroSearchWhenPanelWidth).toBe('function');
  });

});

describe('heroSearchCalendarMonthCount', () => {

  it('heroSearchCalendarMonthCount is exported', () => {
    expect(typeof heroSearchCalendarMonthCount).toBe('function');
  });

});

describe('heroSearchCalendarClassNames', () => {

  it('heroSearchCalendarClassNames is exported', () => {
    expect(typeof heroSearchCalendarClassNames).toBe('function');
  });

});

describe('HERO_SEARCH_TWO_MONTH_MIN_WIDTH', () => {
  it('is defined', () => {
    expect(HERO_SEARCH_TWO_MONTH_MIN_WIDTH).toBeDefined();
  });
});

describe('HERO_SEARCH_SINGLE_MONTH_PANEL_WIDTH', () => {
  it('is defined', () => {
    expect(HERO_SEARCH_SINGLE_MONTH_PANEL_WIDTH).toBeDefined();
  });
});

describe('HERO_SEARCH_CALENDAR_CLASSNAMES', () => {
  it('is defined', () => {
    expect(HERO_SEARCH_CALENDAR_CLASSNAMES).toBeDefined();
  });
});

describe('HERO_SEARCH_CALENDAR_TWO_MONTHS', () => {
  it('is defined', () => {
    expect(HERO_SEARCH_CALENDAR_TWO_MONTHS).toBeDefined();
  });
});
