import type { AuthAudience } from '@/features/guest/auth/config/auth-page-config';
import { GUEST_LOGIN_PATH } from '@/features/guest/auth/lib/guestAuthPaths';
import { HOST_LOGIN_PATH } from '@/features/guest/auth/lib/hostAuthPaths';

/** Derive host vs guest (Explore) mode from the current pathname. */
export function getAuthAudienceFromPath(pathname: string): AuthAudience {
  return pathname.startsWith('/for-hosts') ? 'host' : 'guest';
}

/** Host dashboard href when signed in; Sign In when signed out. */
export function getHostMarketingNavCta(isSignedIn: boolean): { label: string; href: string } {
  if (isSignedIn) {
    return {
      label: 'Dashboard',
      href: '/org',
    };
  }

  return {
    label: 'Sign In',
    href: HOST_LOGIN_PATH,
  };
}

/** Guest sign-in CTA for the marketing nav (signed-in state is handled by `GuestAccountMenu`). */
export function getGuestLoginCta(): { label: string; href: string } {
  return {
    label: 'Sign In',
    href: GUEST_LOGIN_PATH,
  };
}
