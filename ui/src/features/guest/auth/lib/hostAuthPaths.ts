import { safeRedirect } from '@/features/guest/auth/lib/authRedirect';

export const HOST_LOGIN_PATH = '/for-hosts/login';
export const HOST_REGISTER_PATH = '/for-hosts/register';

export { safeRedirect };

/** Host login URL with optional post-auth redirect. */
export function hostLoginPath(redirectPath?: string): string {
  if (!redirectPath || redirectPath === '/dashboard') {
    return HOST_LOGIN_PATH;
  }
  return `${HOST_LOGIN_PATH}?redirect=${encodeURIComponent(redirectPath)}`;
}

/** OAuth return URL for the current host auth page. */
export function hostGoogleOAuthRedirectTo(pathname: string, redirectPath: string): string {
  return `${window.location.origin}${pathname}?redirect=${encodeURIComponent(redirectPath)}`;
}
