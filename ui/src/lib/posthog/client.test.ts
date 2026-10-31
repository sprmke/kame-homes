import { afterEach, describe, expect, it, vi } from 'vitest';

const mockInit = vi.fn();

vi.mock('posthog-js', () => ({
  default: { init: mockInit, register: vi.fn() },
}));

async function loadClient() {
  vi.resetModules();
  return import('./client');
}

describe('posthog client init', () => {
  afterEach(() => {
    mockInit.mockClear();
    vi.unstubAllEnvs();
  });

  it('does not initialize when VITE_POSTHOG_KEY is unset', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');

    const mod = await loadClient();
    expect(mod.isPostHogEnabled).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only key as unconfigured', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '   ');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');

    const mod = await loadClient();
    expect(mod.isPostHogEnabled).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('does not initialize when VITE_POSTHOG_HOST is unset', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    vi.stubEnv('VITE_POSTHOG_HOST', '');

    const mod = await loadClient();
    expect(mod.isPostHogEnabled).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('trims whitespace from the key and forwards a custom host', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '  phc_test_key  ');
    vi.stubEnv('VITE_POSTHOG_HOST', '  https://eu.i.posthog.com  ');

    await loadClient();

    expect(mockInit).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({ api_host: 'https://eu.i.posthog.com' })
    );
  });

  it('never calls init twice for a single module load (singleton guard)', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');

    await loadClient();
    await import('./client');

    expect(mockInit).toHaveBeenCalledTimes(1);
  });
});
