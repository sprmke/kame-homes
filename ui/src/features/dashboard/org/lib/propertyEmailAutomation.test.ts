import { describe, expect, it } from 'vitest';

import { automationTogglesEqual, PROPERTY_AUTOMATION_TOGGLE_KEYS, SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS } from '@/features/dashboard/org/lib/propertyEmailAutomation';

describe('automationTogglesEqual', () => {

  it('automationTogglesEqual is exported', () => {
    expect(typeof automationTogglesEqual).toBe('function');
  });

});

describe('PROPERTY_AUTOMATION_TOGGLE_KEYS', () => {
  it('is defined', () => {
    expect(PROPERTY_AUTOMATION_TOGGLE_KEYS).toBeDefined();
  });
});

describe('SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS', () => {
  it('is defined', () => {
    expect(SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS).toBeDefined();
  });
});
