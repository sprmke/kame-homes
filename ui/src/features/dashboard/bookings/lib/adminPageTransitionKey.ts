/**
 * Page-enter animation key for the admin main column.
 * Nested Help & Support URLs share one key so FAQs / Guides / Tickets swap
 * content without remounting the Help & Support shell.
 */
export function adminPageTransitionKey(pathname: string): string {
  const match = pathname.match(/^(.*?\/help-support)(?:\/|$)/);
  return match ? match[1] : pathname;
}
