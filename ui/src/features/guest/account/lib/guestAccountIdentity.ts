import type { GuestProfileDto } from '@/features/guest/account/lib/guestAccountApi';

import type { Session } from '@supabase/supabase-js';

export function resolveGuestDisplayName(
  session: Session | null,
  profile?: GuestProfileDto | null
): string {
  const fromProfile = profile?.displayName?.trim();
  if (fromProfile) return fromProfile;

  const meta = session?.user?.user_metadata ?? {};
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (typeof meta.name === 'string' && meta.name.trim()) {
    return meta.name.trim();
  }

  const email = session?.user?.email?.trim();
  if (email) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }

  return 'Guest';
}

export function resolveGuestAvatarUrl(
  session: Session | null,
  profile?: GuestProfileDto | null
): string | null {
  const fromProfile = profile?.avatarUrl?.trim();
  if (fromProfile) return fromProfile;

  const meta = session?.user?.user_metadata ?? {};
  if (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) {
    return meta.avatar_url.trim();
  }
  if (typeof meta.picture === 'string' && meta.picture.trim()) {
    return meta.picture.trim();
  }

  return null;
}

export function guestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'G';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}
