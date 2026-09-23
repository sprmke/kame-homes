import { describe, expect, it } from 'vitest';

import { getEmailAutomationDefaults, AZURE_PMO_EMAIL } from '@/features/dashboard/org/lib/propertyEmailAutomationDefaults';

describe('getEmailAutomationDefaults', () => {

  it('getEmailAutomationDefaults is exported', () => {
    expect(typeof getEmailAutomationDefaults).toBe('function');
  });

});

describe('AZURE_PMO_EMAIL', () => {
  it('is defined', () => {
    expect(AZURE_PMO_EMAIL).toBeDefined();
  });
});
