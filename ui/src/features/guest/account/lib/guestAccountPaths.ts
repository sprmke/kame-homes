/** Guest account shell root — use as help-support `basePathOverride` (tickets live under `/tickets`). */
export const GUEST_ACCOUNT_PATH = '/account';

export const GUEST_ACCOUNT_PROFILE_PATH = '/account/profile';
/** Cross-property stay messaging hub (formerly `/account/messages`). */
export const GUEST_ACCOUNT_STAYS_PATH = '/account/stays';
/** Booking list; each row opens the per-booking trip page. */
export const GUEST_ACCOUNT_TRIPS_PATH = '/account/trips';
/** Legacy path — redirects to {@link GUEST_ACCOUNT_STAYS_PATH}. */
export const GUEST_ACCOUNT_MESSAGES_PATH = '/account/messages';
export const GUEST_ACCOUNT_FAVORITES_PATH = '/account/favorites';
/** Legacy path — redirects to {@link GUEST_ACCOUNT_FAVORITES_PATH}. */
export const GUEST_ACCOUNT_WISHLIST_PATH = '/account/wishlist';
export const GUEST_ACCOUNT_TICKETS_PATH = '/account/tickets';
export const GUEST_ACCOUNT_VOUCHERS_PATH = '/account/vouchers';
export const GUEST_ACCOUNT_SETTINGS_PATH = '/account/settings';
/** Hidden from nav for now — route redirects to profile. */

export function isGuestAccountPath(pathname: string): boolean {
  return pathname === '/account' || pathname.startsWith('/account/');
}
