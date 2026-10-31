/**
 * Enable inbox UI preview with mock data.
 * - URL: ?mock=true on /org/:slug/property/:propertySlug/inbox
 * - Env: VITE_INBOX_MOCK_DATA=true
 */
export function isInboxMockMode(): boolean {
  if (import.meta.env.VITE_INBOX_MOCK_DATA === 'true') return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mock') === 'true';
}
