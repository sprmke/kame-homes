import { describe, expect, it } from 'vitest';

import { DEFAULT_MARKETING_URGENCY_DAYS, DEFAULT_MARKETING_NEW_BOOKING_DATES_LIMIT, STAFF_TEMPLATE_DEFAULTS, MARKETING_TEMPLATE_DEFAULTS, ADMIN_TEMPLATE_DEFAULTS, FINANCE_TEMPLATE_DEFAULTS, MAINTENANCE_TEMPLATE_DEFAULTS, CHAT_TEMPLATE_DEFAULTS } from '@/features/dashboard/bookings/lib/telegramNotificationDefaults';

describe('DEFAULT_MARKETING_URGENCY_DAYS', () => {
  it('is defined', () => {
    expect(DEFAULT_MARKETING_URGENCY_DAYS).toBeDefined();
  });
});

describe('DEFAULT_MARKETING_NEW_BOOKING_DATES_LIMIT', () => {
  it('is defined', () => {
    expect(DEFAULT_MARKETING_NEW_BOOKING_DATES_LIMIT).toBeDefined();
  });
});

describe('STAFF_TEMPLATE_DEFAULTS', () => {
  it('is defined', () => {
    expect(STAFF_TEMPLATE_DEFAULTS).toBeDefined();
  });
});

describe('MARKETING_TEMPLATE_DEFAULTS', () => {
  it('is defined', () => {
    expect(MARKETING_TEMPLATE_DEFAULTS).toBeDefined();
  });
});

describe('ADMIN_TEMPLATE_DEFAULTS', () => {
  it('is defined', () => {
    expect(ADMIN_TEMPLATE_DEFAULTS).toBeDefined();
  });
});

describe('FINANCE_TEMPLATE_DEFAULTS', () => {
  it('is defined', () => {
    expect(FINANCE_TEMPLATE_DEFAULTS).toBeDefined();
  });
});

describe('MAINTENANCE_TEMPLATE_DEFAULTS', () => {
  it('is defined', () => {
    expect(MAINTENANCE_TEMPLATE_DEFAULTS).toBeDefined();
  });
});

describe('CHAT_TEMPLATE_DEFAULTS', () => {
  it('is defined', () => {
    expect(CHAT_TEMPLATE_DEFAULTS).toBeDefined();
  });
});
