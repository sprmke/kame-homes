import { describe, expect, it } from 'vitest';

import type { ParkingSettingsSectionId } from '@/features/dashboard/parking/lib/parkingSettingsCompletion';
import {
  planParkingSettingsSave,
  SETUP_GUIDE_PARKING_SAVE_SCOPE,
  type ParkingSettingsDirtyFlags,
} from '@/features/dashboard/parking/lib/parkingSettingsSavePlan';

const CLEAN_COMPLETION = {
  fieldErrors: {},
  sectionMessages: {},
  issueSectionIds: [] as ParkingSettingsSectionId[],
  firstIssueSectionId: null,
  firstErrorMessage: null,
  isComplete: true,
};

function flags(overrides: Partial<ParkingSettingsDirtyFlags> = {}): ParkingSettingsDirtyFlags {
  return {
    profile: false,
    details: false,
    features: false,
    location: false,
    automation: false,
    ...overrides,
  };
}

describe('planParkingSettingsSave', () => {
  it('saves automation-only edits', () => {
    const plan = planParkingSettingsSave({
      dirty: flags({ automation: true }),
      completion: CLEAN_COMPLETION,
    });
    expect(plan.saveAutomation).toBe(true);
    expect(plan.hasSavableWork).toBe(true);
  });

  it('saves a dirty details section', () => {
    const plan = planParkingSettingsSave({
      dirty: flags({ details: true }),
      completion: CLEAN_COMPLETION,
    });
    expect(plan.saveDetails).toBe(true);
    expect(plan.hasSavableWork).toBe(true);
  });

  it('blocks a dirty section that still has issues', () => {
    const plan = planParkingSettingsSave({
      dirty: flags({ details: true }),
      completion: {
        ...CLEAN_COMPLETION,
        issueSectionIds: ['details'],
        sectionMessages: { details: 'Set a check-in time' },
        firstIssueSectionId: 'details',
        firstErrorMessage: 'Set a check-in time',
        isComplete: false,
      },
    });
    expect(plan.saveDetails).toBe(false);
    expect(plan.firstBlockedSectionId).toBe('details');
    expect(plan.hasSavableWork).toBe(false);
  });

  it('scopes automation out of a section-scoped save', () => {
    const plan = planParkingSettingsSave({
      dirty: flags({ automation: true, details: true }),
      completion: CLEAN_COMPLETION,
      scopeSectionIds: ['details'],
    });
    expect(plan.saveDetails).toBe(true);
    expect(plan.saveAutomation).toBe(false);
  });
});

describe('SETUP_GUIDE_PARKING_SAVE_SCOPE', () => {
  it('has no payment step', () => {
    expect(SETUP_GUIDE_PARKING_SAVE_SCOPE).not.toHaveProperty('payments');
    expect(Object.keys(SETUP_GUIDE_PARKING_SAVE_SCOPE).sort()).toEqual([
      'basics',
      'email',
      'location',
      'photo',
      'pricing',
    ]);
  });
});
