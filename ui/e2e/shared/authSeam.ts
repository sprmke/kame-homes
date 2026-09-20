import { E2E_GUEST_USER_ID, E2E_HOST_USER_ID, SUPABASE_AUTH_STORAGE_KEY } from './ids';

import type { Page } from '@playwright/test';


export type E2eAuthRole = 'host' | 'guest';

function buildSession(role: E2eAuthRole) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const isHost = role === 'host';
  return {
    access_token: isHost ? 'playwright-admin-token' : 'playwright-guest-token',
    refresh_token: 'playwright-refresh-token',
    expires_in: 60 * 60,
    expires_at: nowSeconds + 60 * 60,
    token_type: 'bearer',
    user: {
      id: isHost ? E2E_HOST_USER_ID : E2E_GUEST_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: isHost ? 'host@example.com' : 'guest@example.com',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: isHost ? 'E2E Host' : 'E2E Guest' },
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

/** Dev-only Supabase session payload accepted by dashboard/guest shells. */
export async function seedSupabaseAuthSession(page: Page, role: E2eAuthRole) {
  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    { key: SUPABASE_AUTH_STORAGE_KEY, session: buildSession(role) }
  );
}

export async function clearSupabaseAuthSession(page: Page) {
  await page.addInitScript((key: string) => {
    window.localStorage.removeItem(key);
  }, SUPABASE_AUTH_STORAGE_KEY);
}
