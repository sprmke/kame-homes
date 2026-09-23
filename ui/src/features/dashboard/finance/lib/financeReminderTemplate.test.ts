import { describe, expect, it } from 'vitest';

import { financeMessageTemplateForForm, financeMessageTemplateForApi, FINANCE_DEFAULT_REMINDER_TEMPLATE } from '@/features/dashboard/finance/lib/financeReminderTemplate';

describe('financeMessageTemplateForForm', () => {

  it('financeMessageTemplateForForm is exported', () => {
    expect(typeof financeMessageTemplateForForm).toBe('function');
  });

});

describe('financeMessageTemplateForApi', () => {

  it('financeMessageTemplateForApi is exported', () => {
    expect(typeof financeMessageTemplateForApi).toBe('function');
  });

});

describe('FINANCE_DEFAULT_REMINDER_TEMPLATE', () => {
  it('is defined', () => {
    expect(FINANCE_DEFAULT_REMINDER_TEMPLATE).toBeDefined();
  });
});
