import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PARKING_AUTOMATION_TOGGLES,
  PARKING_AUTOMATION_TOGGLE_KEYS,
  PARKING_AUTOMATION_TOGGLE_LABELS,
  PARKING_EMAIL_AUTOMATION_COPY,
  PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS,
  mergeParkingAutomationToggles,
} from '@/features/dashboard/parking/lib/parkingEmailAutomation';

describe('parking automation toggles', () => {
  it('has 4 keys with auto-accept off by default', () => {
    expect(PARKING_AUTOMATION_TOGGLE_KEYS).toHaveLength(4);
    expect(DEFAULT_PARKING_AUTOMATION_TOGGLES.autoAcceptTopMatch).toBe(false);
    expect(PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS).toHaveLength(3);
  });

  it('labels every key', () => {
    for (const key of PARKING_AUTOMATION_TOGGLE_KEYS) {
      expect(PARKING_AUTOMATION_TOGGLE_LABELS[key].trim()).not.toBe('');
    }
  });

  it('gives every email toggle a recipient and trigger', () => {
    for (const key of PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS) {
      const copy = PARKING_EMAIL_AUTOMATION_COPY[key];
      expect(copy.recipient.trim()).not.toBe('');
      expect(copy.trigger.trim()).not.toBe('');
      expect(copy.trigger.endsWith('.')).toBe(true);
    }
  });

  it('mergeParkingAutomationToggles ignores unknown keys', () => {
    const merged = mergeParkingAutomationToggles({
      emailParkingNoHostAvailable: false,
      retiredKey: true,
    });
    expect('retiredKey' in merged).toBe(false);
    expect(merged.emailParkingNoHostAvailable).toBe(false);
    expect(merged.emailParkingReservationRequest).toBe(true);
  });
});
