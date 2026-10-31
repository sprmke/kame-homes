import { useGuestProfile } from '@/features/guest/account/hooks/useGuestProfile';
import {
  guestInitials,
  resolveGuestAvatarUrl,
  resolveGuestDisplayName,
} from '@/features/guest/account/lib/guestAccountIdentity';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

/** Shared display name + avatar for explore and host dashboard (same Supabase session + guest_profiles). */
export function useAccountIdentity(options?: { profileEnabled?: boolean }) {
  const { status, session, email, name } = useAdminSession();
  const profileEnabled = (options?.profileEnabled ?? true) && status === 'admin';
  const { data: profile } = useGuestProfile({ enabled: profileEnabled });

  const displayName = session
    ? resolveGuestDisplayName(session, profile)
    : (name ?? email?.split('@')[0] ?? 'Account');
  const avatarUrl = session ? resolveGuestAvatarUrl(session, profile) : null;
  const initials = guestInitials(displayName);

  return {
    status,
    session,
    email,
    displayName,
    avatarUrl,
    initials,
    profile,
  };
}
