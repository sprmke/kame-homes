import { describe, expect, it } from 'vitest';

import { maintenanceMessageTemplateForForm, maintenanceMessageTemplateForApi, MAINTENANCE_DEFAULT_REMINDER_TEMPLATE } from '@/features/dashboard/maintenance/lib/maintenanceReminderTemplate';

describe('maintenanceMessageTemplateForForm', () => {

  it('maintenanceMessageTemplateForForm is exported', () => {
    expect(typeof maintenanceMessageTemplateForForm).toBe('function');
  });

});

describe('maintenanceMessageTemplateForApi', () => {

  it('maintenanceMessageTemplateForApi is exported', () => {
    expect(typeof maintenanceMessageTemplateForApi).toBe('function');
  });

});

describe('MAINTENANCE_DEFAULT_REMINDER_TEMPLATE', () => {
  it('is defined', () => {
    expect(MAINTENANCE_DEFAULT_REMINDER_TEMPLATE).toBeDefined();
  });
});
