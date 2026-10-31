import { safeRedirect } from '@/features/guest/auth/lib/authRedirect';

export { safeRedirect };

export const GUEST_LOGIN_PATH = '/for-guests/login';
export const GUEST_REGISTER_PATH = '/for-guests/register';

/** Guest login URL with optional post-auth redirect. */
export function guestLoginPath(redirectPath?: string): string {
  if (!redirectPath || redirectPath === '/') {
    return GUEST_LOGIN_PATH;
  }
  return `${GUEST_LOGIN_PATH}?redirect=${encodeURIComponent(redirectPath)}`;
}

/** OAuth return URL — lands guest back on the page they started from. */
export function guestOAuthRedirectTo(returnPath: string): string {
  const safe = returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/';
  return `${window.location.origin}${safe}`;
}
