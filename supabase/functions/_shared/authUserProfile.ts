import type { SupabaseClient } from './supabaseJs.ts';

export type AuthUserProfile = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export async function loadAuthUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<AuthUserProfile> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return { name: 'Host', email: '', avatarUrl: null };
  }

  const email = data.user.email ?? '';
  const meta = data.user.user_metadata ?? {};
  const name =
    typeof meta.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta.name === 'string' && meta.name.trim()
        ? meta.name.trim()
        : email.split('@')[0] || 'Host';
  const avatarUrl =
    typeof meta.avatar_url === 'string'
      ? meta.avatar_url
      : typeof meta.picture === 'string'
        ? meta.picture
        : null;

  return { name, email, avatarUrl };
}
