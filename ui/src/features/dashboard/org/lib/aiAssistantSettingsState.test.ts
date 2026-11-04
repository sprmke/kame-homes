import { describe, expect, it } from 'vitest';

import { resolveAssistantSettingsState } from '@/features/dashboard/org/lib/aiAssistantSettingsState';

const base = {
  active: true,
  platformEnabled: true,
  aiBlocker: null,
  planAllowed: true,
  planReady: true,
  readOnly: false,
};

describe('resolveAssistantSettingsState', () => {
  it('leaves the switch editable when platform, plan and permission all allow it', () => {
    expect(resolveAssistantSettingsState(base)).toEqual({
      lock: null,
      toggleDisabled: false,
      showBody: true,
    });
  });

  it('locks and disables the switch when the super admin turned the assistant off', () => {
    expect(resolveAssistantSettingsState({ ...base, platformEnabled: false })).toEqual({
      lock: 'platform',
      toggleDisabled: true,
      showBody: false,
    });
  });

  it('treats the AI platform feature list the same as the super admin kill switch', () => {
    expect(resolveAssistantSettingsState({ ...base, aiBlocker: 'platform' })).toEqual({
      lock: 'platform',
      toggleDisabled: true,
      showBody: false,
    });
  });

  it('locks an org above its plan but still lets it switch the assistant off', () => {
    expect(resolveAssistantSettingsState({ ...base, planAllowed: false })).toEqual({
      lock: 'plan',
      toggleDisabled: false,
      showBody: false,
    });
    expect(
      resolveAssistantSettingsState({ ...base, planAllowed: false, active: false }).toggleDisabled
    ).toBe(true);
  });

  it('does not lock while the plan is still loading or failed open', () => {
    expect(
      resolveAssistantSettingsState({ ...base, planAllowed: false, planReady: false }).lock
    ).toBeNull();
  });

  it('honours the team permission for hosts who cannot edit AI settings', () => {
    expect(resolveAssistantSettingsState({ ...base, readOnly: true }).toggleDisabled).toBe(true);
    expect(resolveAssistantSettingsState({ ...base, readOnly: true }).lock).toBeNull();
  });
});
