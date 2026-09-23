import { describe, expect, it } from 'vitest';

import { deriveSetupGuideProgress, setupGuideRequiredComplete } from '@/features/dashboard/setup-guide/lib/setupGuideProgress';

describe('deriveSetupGuideProgress', () => {

  it('deriveSetupGuideProgress is exported', () => {
    expect(typeof deriveSetupGuideProgress).toBe('function');
  });

});

describe('setupGuideRequiredComplete', () => {

  it('setupGuideRequiredComplete is exported', () => {
    expect(typeof setupGuideRequiredComplete).toBe('function');
  });

});
