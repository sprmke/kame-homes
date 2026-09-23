import { describe, expect, it } from 'vitest';

import { mergeParkingAutomationToggles, PARKING_AUTOMATION_TOGGLE_KEYS, PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS } from '@/features/dashboard/parking/lib/parkingEmailAutomation';

describe('mergeParkingAutomationToggles', () => {

  it('mergeParkingAutomationToggles is exported', () => {
    expect(typeof mergeParkingAutomationToggles).toBe('function');
  });

});

describe('PARKING_AUTOMATION_TOGGLE_KEYS', () => {
  it('is defined', () => {
    expect(PARKING_AUTOMATION_TOGGLE_KEYS).toBeDefined();
  });
});

describe('PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS', () => {
  it('is defined', () => {
    expect(PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS).toBeDefined();
  });
});
