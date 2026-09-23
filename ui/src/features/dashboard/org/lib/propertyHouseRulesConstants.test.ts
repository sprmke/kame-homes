import { describe, expect, it } from 'vitest';

import { resolveHouseRulesForDisplay, HOUSE_RULE_CUSTOM_MAX_LENGTH, HOUSE_RULE_PRESET_BY_ID, INITIAL_ENABLED_HOUSE_RULES } from '@/features/dashboard/org/lib/propertyHouseRulesConstants';

describe('resolveHouseRulesForDisplay', () => {

  it('resolveHouseRulesForDisplay is exported', () => {
    expect(typeof resolveHouseRulesForDisplay).toBe('function');
  });

});

describe('HOUSE_RULE_CUSTOM_MAX_LENGTH', () => {
  it('is defined', () => {
    expect(HOUSE_RULE_CUSTOM_MAX_LENGTH).toBeDefined();
  });
});

describe('HOUSE_RULE_PRESET_BY_ID', () => {
  it('is defined', () => {
    expect(HOUSE_RULE_PRESET_BY_ID).toBeDefined();
  });
});

describe('INITIAL_ENABLED_HOUSE_RULES', () => {
  it('is defined', () => {
    expect(INITIAL_ENABLED_HOUSE_RULES).toBeDefined();
  });
});
