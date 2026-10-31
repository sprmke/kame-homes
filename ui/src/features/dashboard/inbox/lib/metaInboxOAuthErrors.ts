const META_INBOX_OAUTH_ERRORS: Record<string, string> = {
  access_denied: 'Meta authorization was cancelled.',
  no_pages: 'No Facebook Pages found for this account.',
  invalid_state: 'Connection session expired. Try again.',
  token_exchange_failed: 'Could not complete Meta sign-in.',
};

export function metaInboxOAuthErrorMessage(code: string): string {
  return META_INBOX_OAUTH_ERRORS[code] ?? `Connection failed: ${code}`;
}
