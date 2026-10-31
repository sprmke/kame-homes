import type { Session } from '@supabase/supabase-js';

export const E2E_ADMIN_SESSION_STORAGE_KEY = 'kame:e2e-admin-session';

type E2EAdminSessionPayload = {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email: string;
  name?: string;
};

function canUseE2EAdminSession(): boolean {
  return typeof window !== 'undefined' && import.meta.env.DEV;
}

export function readE2EAdminSessionPayload(): E2EAdminSessionPayload | null {
  if (!canUseE2EAdminSession()) return null;

  const raw = window.localStorage.getItem(E2E_ADMIN_SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<E2EAdminSessionPayload>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.email !== 'string'
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken:
        typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim()
          ? parsed.refreshToken
          : undefined,
      userId: parsed.userId,
      email: parsed.email,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
    };
  } catch {
    return null;
  }
}

export function readE2EAdminSession(): Session | null {
  const payload = readE2EAdminSessionPayload();
  if (!payload) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken ?? 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60,
    expires_at: nowSeconds + 60 * 60,
    user: {
      id: payload.userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: payload.email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: payload.name ?? payload.email },
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

export function readE2EAdminAccessToken(): string | null {
  return readE2EAdminSessionPayload()?.accessToken ?? null;
}

export function clearE2EAdminSession(): void {
  if (!canUseE2EAdminSession()) return;
  window.localStorage.removeItem(E2E_ADMIN_SESSION_STORAGE_KEY);
}
