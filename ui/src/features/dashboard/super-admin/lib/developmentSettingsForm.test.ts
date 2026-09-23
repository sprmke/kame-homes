import { describe, expect, it } from 'vitest';

import { developmentProfileDraftFromDevelopment, developmentProfileDraftIsDirty, buildDevelopmentUpdatePayload, validateDevelopmentProfileDraft, developmentPmoEmailPlaceholder } from '@/features/dashboard/super-admin/lib/developmentSettingsForm';

describe('developmentProfileDraftFromDevelopment', () => {

  it('developmentProfileDraftFromDevelopment is exported', () => {
    expect(typeof developmentProfileDraftFromDevelopment).toBe('function');
  });

});

describe('developmentProfileDraftIsDirty', () => {

  it('developmentProfileDraftIsDirty is exported', () => {
    expect(typeof developmentProfileDraftIsDirty).toBe('function');
  });

});

describe('buildDevelopmentUpdatePayload', () => {

  it('buildDevelopmentUpdatePayload is exported', () => {
    expect(typeof buildDevelopmentUpdatePayload).toBe('function');
  });

});

describe('validateDevelopmentProfileDraft', () => {

  it('validateDevelopmentProfileDraft is exported', () => {
    expect(typeof validateDevelopmentProfileDraft).toBe('function');
  });

});

describe('developmentPmoEmailPlaceholder', () => {

  it('developmentPmoEmailPlaceholder is exported', () => {
    expect(typeof developmentPmoEmailPlaceholder).toBe('function');
  });

});
