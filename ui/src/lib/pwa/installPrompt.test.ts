import { describe, expect, it } from 'vitest';

import { canPromptInstall, subscribeInstallPrompt } from '@/lib/pwa/installPrompt';

describe('canPromptInstall', () => {

  it('canPromptInstall is exported', () => {
    expect(typeof canPromptInstall).toBe('function');
  });

});

describe('subscribeInstallPrompt', () => {

  it('subscribeInstallPrompt is exported', () => {
    expect(typeof subscribeInstallPrompt).toBe('function');
  });

});
