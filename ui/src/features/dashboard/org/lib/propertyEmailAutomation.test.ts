import { describe, expect, it } from 'vitest';

import {
  automationTogglesEqual,
  DEFAULT_PROPERTY_AUTOMATION_TOGGLES,
  PLAN_GATED_AUTOMATION_TOGGLE_KEYS,
  PROPERTY_AUTOMATION_TOGGLE_GROUPS,
  PROPERTY_AUTOMATION_TOGGLE_KEYS,
  SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS,
} from '@/features/dashboard/org/lib/propertyEmailAutomation';

describe('PROPERTY_AUTOMATION_TOGGLE_KEYS', () => {
  it('has 8 keys and no retired parking broadcast key', () => {
    expect(PROPERTY_AUTOMATION_TOGGLE_KEYS).toHaveLength(8);
    expect(PROPERTY_AUTOMATION_TOGGLE_KEYS).not.toContain('emailParkingBroadcast' as never);
  });

  it('defaults every key to on', () => {
    expect(Object.keys(DEFAULT_PROPERTY_AUTOMATION_TOGGLES).sort()).toEqual(
      [...PROPERTY_AUTOMATION_TOGGLE_KEYS].sort()
    );
    expect(Object.values(DEFAULT_PROPERTY_AUTOMATION_TOGGLES).every(Boolean)).toBe(true);
  });
});

describe('PLAN_GATED_AUTOMATION_TOGGLE_KEYS', () => {
  it('gates 5 toggles and keeps the new booking alert free', () => {
    expect(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.size).toBe(5);
    expect(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.has('emailNewBookingRequest')).toBe(false);
    expect(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.has('emailReviewRequest')).toBe(false);
    expect(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.has('emailReviewReminder')).toBe(false);
    expect(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.has('emailGafRequest')).toBe(true);
    expect(PLAN_GATED_AUTOMATION_TOGGLE_KEYS.has('emailSdRefundCheckout')).toBe(true);
  });
});

describe('PROPERTY_AUTOMATION_TOGGLE_GROUPS', () => {
  it('covers every toggle exactly once', () => {
    const grouped = PROPERTY_AUTOMATION_TOGGLE_GROUPS.flatMap((group) =>
      group.items.map((item) => item.key)
    );
    expect(grouped.sort()).toEqual([...PROPERTY_AUTOMATION_TOGGLE_KEYS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('gives every row a recipient and a plain-language trigger', () => {
    for (const group of PROPERTY_AUTOMATION_TOGGLE_GROUPS) {
      for (const item of group.items) {
        expect(item.label.trim()).not.toBe('');
        expect(item.recipient.trim()).not.toBe('');
        expect(item.trigger.trim()).not.toBe('');
        expect(item.trigger.endsWith('.')).toBe(true);
        expect(item.trigger.toLowerCase()).not.toContain('status');
      }
    }
  });
});

describe('automationTogglesEqual', () => {
  it('ignores a stray stored parking broadcast key', () => {
    const baseline = { ...DEFAULT_PROPERTY_AUTOMATION_TOGGLES } as Record<string, boolean>;
    const draft = {
      ...DEFAULT_PROPERTY_AUTOMATION_TOGGLES,
      emailParkingBroadcast: false,
    } as Record<string, boolean>;

    expect(
      automationTogglesEqual(
        draft as typeof DEFAULT_PROPERTY_AUTOMATION_TOGGLES,
        baseline as typeof DEFAULT_PROPERTY_AUTOMATION_TOGGLES
      )
    ).toBe(true);
  });

  it('detects a real toggle change', () => {
    const baseline = { ...DEFAULT_PROPERTY_AUTOMATION_TOGGLES };
    const draft = { ...DEFAULT_PROPERTY_AUTOMATION_TOGGLES, emailGafRequest: false };
    expect(automationTogglesEqual(draft, baseline)).toBe(false);
  });
});

describe('SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS', () => {
  it('is a week in hours', () => {
    expect(SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS).toBe(168);
  });
});
