import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const recordVideo = process.env.PLAYWRIGHT_RECORD_VIDEO === '1';
const slowMoRaw = process.env.PLAYWRIGHT_SLOW_MO;
const slowMoParsed = slowMoRaw ? Number.parseInt(slowMoRaw, 10) : 0;
const slowMo = Number.isFinite(slowMoParsed) && slowMoParsed > 0 ? slowMoParsed : 0;

export default defineConfig({
  testDir: './ui/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // 99 @smoke tests × 3 projects were serializing to 45+ min on GHA; parallelize files only.
  workers: process.env.CI ? 4 : undefined,
  globalTimeout: process.env.CI ? 45 * 60 * 1000 : undefined,
  reporter: process.env.CI ? [['html'], ['list']] : [['list']],
  outputDir: 'test-results/playwright',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: recordVideo ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 960 },
    ...(slowMo
      ? {
          headless: false,
          launchOptions: { slowMo },
        }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      // Re-apply slowMo after device defaults so launchOptions is not dropped on merge.
      use: {
        ...devices['Desktop Chrome'],
        ...(slowMo
          ? {
              headless: false,
              launchOptions: { slowMo },
            }
          : {}),
      },
    },
    {
      name: 'chromium-ci',
      grep: /@smoke|@ci/,
      grepInvert: /@live|@demo|@flaky/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile-chromium-smoke',
      grep: /@smoke/,
      grepInvert: /@live|@demo|@flaky/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'tablet-chromium-smoke',
      grep: /@smoke/,
      grepInvert: /@live|@demo|@flaky/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'chromium-side-by-side',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        viewport: { width: 900, height: 960 },
      },
    },
  ],
  webServer: {
    command: `bun run dev:ui -- --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
    // PostHog unset in E2E — client no-ops without VITE_POSTHOG_KEY (no network calls).
    env: {
      // Guest form auto-fills random dev data when unset; keep E2E deterministic.
      VITE_NODE_ENV: 'production',
      // ui/src/lib/supabase/client.ts calls createClient() at module load time, which
      // throws synchronously ("supabaseUrl is required") on an empty string — crashing
      // the whole SPA before any test can render a page. CI has no ui/.env (gitignored),
      // so without a placeholder here every @smoke/@ci spec fails identically. Specs that
      // exercise real Supabase calls mock those calls; this only needs to satisfy the
      // client constructor, not point at a reachable project.
      // Host must stay "127.0.0.1" (not e.g. "placeholder.supabase.co") — supabase-js
      // derives the localStorage session key as `sb-${hostname.split('.')[0]}-auth-token`,
      // and ui/e2e/shared/ids.ts#SUPABASE_AUTH_STORAGE_KEY hardcodes `sb-127-auth-token`
      // to match local dev Supabase. A different hostname silently breaks every spec that
      // seeds a session via seedSupabaseAuthSession (admin/dashboard smoke tests).
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321/functions/v1',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key',
      // Guest form (and other features) POST to `VITE_API_URL`, not `VITE_SUPABASE_URL`.
      // CI has no `ui/.env`; without this, `fetch(undefined/submit-form)` never hits Playwright mocks.
      VITE_API_URL:
        process.env.VITE_API_URL ||
        process.env.VITE_SUPABASE_URL ||
        'http://127.0.0.1:54321/functions/v1',
    },
  },
});
