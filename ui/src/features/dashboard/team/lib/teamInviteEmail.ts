export const TEAM_INVITE_GMAIL_ONLY_MESSAGE =
  'For now, only Gmail addresses are supported. The invitee must sign in with Google.';

const ALLOWED_GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function isAllowedTeamInviteEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1);
  return ALLOWED_GMAIL_DOMAINS.has(domain);
}

export function teamInviteEmailLooksInvalid(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed.includes('@')) return false;
  return !isAllowedTeamInviteEmail(trimmed);
}
