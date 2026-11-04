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

describe('posthog is analytics-only', () => {
  afterEach(() => {
    mockInit.mockClear();
    vi.unstubAllEnvs();
  });

  it('disables exception capture and performance capture', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');

    await loadClient();

    const options = mockInit.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    // Sentry owns faults. PostHog capturing them too is what produced two histories that
    // disagreed about the same incident, which is what plan phase P1 removed.
    expect(options.capture_exceptions).toBe(false);
    // Web vitals and network timing belong to Sentry tracing: one source of truth.
    expect(options.capture_performance).toBe(false);
    // Replay is off in production builds unless explicitly enabled (plan D9). It is not
    // asserted as `true` here because the test build is not `PROD`; masking is the
    // invariant that holds either way.
    const replay = options.session_recording as { maskAllInputs?: boolean } | undefined;
    expect(replay?.maskAllInputs).toBe(true);
  });

  it('wires before_send so URLs are scrubbed before they leave the browser', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');

    await loadClient();

    const options = mockInit.mock.calls.at(-1)?.[1] as {
      before_send?: (event: unknown) => unknown;
    };
    expect(typeof options.before_send).toBe('function');

    // Guest links carry ?access= capability tokens; an unscrubbed $current_url would hand
    // PostHog a working link to somebody's booking.
    const scrubbed = options.before_send!({
      event: '$pageview',
      properties: { $current_url: 'https://x.test/form?access=secret&tab=dates' },
    }) as { properties: Record<string, string> };
    expect(scrubbed.properties.$current_url).toBe('https://x.test/form?tab=dates');
  });
});
