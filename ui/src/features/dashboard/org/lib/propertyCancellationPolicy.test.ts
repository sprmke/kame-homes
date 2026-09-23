import { describe, expect, it } from 'vitest';

import { normalizeCancellationPolicySettings, readCancellationPolicyFromSettings, cancellationPolicySettingsEqual, resolveCancellationPolicyDisplay, validateCancellationPolicySettings, cancellationPolicyToSettingsPatch, CANCELLATION_POLICY_CUSTOM_TITLE_MAX, CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX, CANCELLATION_GRACE_HOUR_OPTIONS, CANCELLATION_DAYS_BEFORE_OPTIONS, CANCELLATION_PARTIAL_PERCENT_OPTIONS } from '@/features/dashboard/org/lib/propertyCancellationPolicy';

describe('normalizeCancellationPolicySettings', () => {

  it('normalizeCancellationPolicySettings is exported', () => {
    expect(typeof normalizeCancellationPolicySettings).toBe('function');
  });

});

describe('readCancellationPolicyFromSettings', () => {

  it('readCancellationPolicyFromSettings is exported', () => {
    expect(typeof readCancellationPolicyFromSettings).toBe('function');
  });

});

describe('cancellationPolicySettingsEqual', () => {

  it('cancellationPolicySettingsEqual is exported', () => {
    expect(typeof cancellationPolicySettingsEqual).toBe('function');
  });

});

describe('resolveCancellationPolicyDisplay', () => {

  it('resolveCancellationPolicyDisplay is exported', () => {
    expect(typeof resolveCancellationPolicyDisplay).toBe('function');
  });

});

describe('validateCancellationPolicySettings', () => {

  it('validateCancellationPolicySettings is exported', () => {
    expect(typeof validateCancellationPolicySettings).toBe('function');
  });

});

describe('cancellationPolicyToSettingsPatch', () => {

  it('cancellationPolicyToSettingsPatch is exported', () => {
    expect(typeof cancellationPolicyToSettingsPatch).toBe('function');
  });

});

describe('CANCELLATION_POLICY_CUSTOM_TITLE_MAX', () => {
  it('is defined', () => {
    expect(CANCELLATION_POLICY_CUSTOM_TITLE_MAX).toBeDefined();
  });
});

describe('CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX', () => {
  it('is defined', () => {
    expect(CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX).toBeDefined();
  });
});

describe('CANCELLATION_GRACE_HOUR_OPTIONS', () => {
  it('is defined', () => {
    expect(CANCELLATION_GRACE_HOUR_OPTIONS).toBeDefined();
  });
});

describe('CANCELLATION_DAYS_BEFORE_OPTIONS', () => {
  it('is defined', () => {
    expect(CANCELLATION_DAYS_BEFORE_OPTIONS).toBeDefined();
  });
});

describe('CANCELLATION_PARTIAL_PERCENT_OPTIONS', () => {
  it('is defined', () => {
    expect(CANCELLATION_PARTIAL_PERCENT_OPTIONS).toBeDefined();
  });
});
