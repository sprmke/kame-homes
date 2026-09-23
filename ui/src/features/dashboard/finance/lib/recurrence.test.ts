import { describe, expect, it } from 'vitest';

import { normalizeFinanceReminderInterval, recurrenceIntervalLabel, isRecurrenceScheduleDirty, recurrenceScheduleUpdateFields, suggestExtendBefore, suggestExtendAfter, buildTelegramReminderSchedule, reminderIntervalLabel, defaultRecurrenceUntil } from '@/features/dashboard/finance/lib/recurrence';

describe('normalizeFinanceReminderInterval', () => {

  it('normalizeFinanceReminderInterval is exported', () => {
    expect(typeof normalizeFinanceReminderInterval).toBe('function');
  });

});

describe('recurrenceIntervalLabel', () => {

  it('recurrenceIntervalLabel is exported', () => {
    expect(typeof recurrenceIntervalLabel).toBe('function');
  });

});

describe('isRecurrenceScheduleDirty', () => {

  it('isRecurrenceScheduleDirty is exported', () => {
    expect(typeof isRecurrenceScheduleDirty).toBe('function');
  });

});

describe('recurrenceScheduleUpdateFields', () => {

  it('recurrenceScheduleUpdateFields is exported', () => {
    expect(typeof recurrenceScheduleUpdateFields).toBe('function');
  });

});

describe('suggestExtendBefore', () => {

  it('suggestExtendBefore is exported', () => {
    expect(typeof suggestExtendBefore).toBe('function');
  });

});

describe('suggestExtendAfter', () => {

  it('suggestExtendAfter is exported', () => {
    expect(typeof suggestExtendAfter).toBe('function');
  });

});

describe('buildTelegramReminderSchedule', () => {

  it('buildTelegramReminderSchedule is exported', () => {
    expect(typeof buildTelegramReminderSchedule).toBe('function');
  });

});

describe('reminderIntervalLabel', () => {

  it('reminderIntervalLabel is exported', () => {
    expect(typeof reminderIntervalLabel).toBe('function');
  });

});

describe('defaultRecurrenceUntil', () => {

  it('defaultRecurrenceUntil is exported', () => {
    expect(typeof defaultRecurrenceUntil).toBe('function');
  });

});
