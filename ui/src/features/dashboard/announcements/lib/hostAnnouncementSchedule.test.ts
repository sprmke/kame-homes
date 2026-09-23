import { describe, expect, it } from 'vitest';

import { announcementScheduleToDate, announcementScheduleStartFromDate, announcementScheduleEndFromDate, announcementScheduleSummary } from '@/features/dashboard/announcements/lib/hostAnnouncementSchedule';

describe('announcementScheduleToDate', () => {

  it('announcementScheduleToDate is exported', () => {
    expect(typeof announcementScheduleToDate).toBe('function');
  });

});

describe('announcementScheduleStartFromDate', () => {

  it('announcementScheduleStartFromDate is exported', () => {
    expect(typeof announcementScheduleStartFromDate).toBe('function');
  });

});

describe('announcementScheduleEndFromDate', () => {

  it('announcementScheduleEndFromDate is exported', () => {
    expect(typeof announcementScheduleEndFromDate).toBe('function');
  });

});

describe('announcementScheduleSummary', () => {

  it('announcementScheduleSummary is exported', () => {
    expect(typeof announcementScheduleSummary).toBe('function');
  });

});
