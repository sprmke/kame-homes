import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The rest of the UI calls Edge Functions via VITE_SUPABASE_URL (which already
// contains the `/functions/v1` suffix). The Supabase JS client needs the bare
// project URL. Prefer an explicit VITE_SUPABASE_PROJECT_URL when set, otherwise
// derive it by stripping the functions suffix. This way admins don't have to
// duplicate a value that's already in the env.
function resolveProjectUrl(): string {
  const explicit = import.meta.env.VITE_SUPABASE_PROJECT_URL as string | undefined;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, '');

  const functionsUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  return functionsUrl.replace(/\/functions\/v1\/?$/, '').replace(/\/+$/, '');
}

const projectUrl = resolveProjectUrl();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

if (!projectUrl || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Admin features (/for-hosts/login, /bookings) will not work until these are set.'
  );
}

// Singleton. Do not create additional clients elsewhere.
export const supabase: SupabaseClient = createClient(projectUrl, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE — Supabase 2.x default for browser OAuth; returns ?code= on redirect.
    flowType: 'pkce',
  },
});
