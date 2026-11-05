import { describe, expect, it } from 'vitest';

import {
  evaluateUiEnv,
  evaluateUiServerParity,
  supabaseRefFromUrl,
  UI_ENV_REGISTRY,
} from '@/features/dashboard/super-admin/lib/systemHealth/uiEnvRegistry';

const find = (checks: ReturnType<typeof evaluateUiEnv>, key: string) =>
  checks.find((check) => check.id === `env.ui.${key}`)!;

describe('evaluateUiEnv', () => {
  it('flags missing required keys as errors everywhere', () => {
    expect(find(evaluateUiEnv({}, false), 'VITE_SUPABASE_URL').status).toBe('error');
    expect(find(evaluateUiEnv({}, true), 'VITE_SUPABASE_ANON_KEY').status).toBe('error');
  });

  it('treats prodRecommended keys as off outside production', () => {
    expect(find(evaluateUiEnv({}, false), 'VITE_TURNSTILE_SITE_KEY').status).toBe('off');
    expect(find(evaluateUiEnv({}, true), 'VITE_TURNSTILE_SITE_KEY').status).toBe('warn');
  });

  it('validates URLs and warns on localhost in production', () => {
    expect(
      find(evaluateUiEnv({ VITE_SUPABASE_URL: 'nope' }, false), 'VITE_SUPABASE_URL').status
    ).toBe('error');
    expect(
      find(
        evaluateUiEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }, true),
        'VITE_SUPABASE_URL'
      ).status
    ).toBe('warn');
  });

  it('never displays key values', () => {
    const env = Object.fromEntries(UI_ENV_REGISTRY.map((def) => [def.key, 'value-xyz-123']));
    const checks = evaluateUiEnv(env, false);
    for (const def of UI_ENV_REGISTRY.filter((d) => !d.showValue)) {
      expect(find(checks, def.key).detail).toBe('Set');
    }
  });
});

const posture = (env: Record<string, string>, isProd: boolean, id: string) =>
  evaluateUiEnv(env, isProd).find((check) => check.id === `posture.ui.${id}`)!.status;

describe('UI production posture', () => {
  it('flags a non-production build mode and mock inbox data', () => {
    expect(posture({}, true, 'VITE_NODE_ENV')).toBe('error');
    expect(posture({ VITE_NODE_ENV: 'production' }, true, 'VITE_NODE_ENV')).toBe('ok');
    expect(posture({ VITE_INBOX_MOCK_DATA: 'true' }, true, 'VITE_INBOX_MOCK_DATA')).toBe('error');
    expect(
      posture({ VITE_DISABLE_IMAGE_OPTIMIZATION: '1' }, true, 'VITE_DISABLE_IMAGE_OPTIMIZATION')
    ).toBe('warn');
  });

  it('only runs in production', () => {
    expect(posture({}, false, 'VITE_NODE_ENV')).toBe('off');
  });
});

describe('supabaseRefFromUrl', () => {
  it('parses hosted refs only', () => {
    expect(supabaseRefFromUrl('https://abcdefghijklmnopqrst.supabase.co')).toBe(
      'abcdefghijklmnopqrst'
    );
    expect(supabaseRefFromUrl('http://127.0.0.1:54321')).toBeNull();
    expect(supabaseRefFromUrl(undefined)).toBeNull();
  });
});

describe('evaluateUiServerParity', () => {
  const url = 'https://abcdefghijklmnopqrst.supabase.co';

  it('errors when the UI build points at another project', () => {
    const [check] = evaluateUiServerParity(
      { VITE_SUPABASE_URL: url },
      { projectRef: 'zzzzzzzzzzzzzzzzzzzz', vapidPublicKey: null }
    );
    expect(check.id).toBe('parity.supabase_project');
    expect(check.status).toBe('error');
  });

  it('compares VAPID public keys', () => {
    const checks = evaluateUiServerParity(
      { VITE_SUPABASE_URL: url, VITE_VAPID_PUBLIC_KEY: 'a' },
      { projectRef: 'abcdefghijklmnopqrst', vapidPublicKey: 'b' }
    );
    expect(checks.map((c) => c.status)).toEqual(['ok', 'error']);
  });

  it('skips checks it cannot compare', () => {
    expect(
      evaluateUiServerParity(
        { VITE_SUPABASE_URL: 'http://127.0.0.1:54321' },
        { projectRef: null, vapidPublicKey: null }
      )
    ).toEqual([]);
  });
});
