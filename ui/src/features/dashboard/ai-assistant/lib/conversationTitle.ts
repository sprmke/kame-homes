const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** History preview: drop tool-call jargon and UUIDs so long titles stay readable. */
export function displayConversationTitle(title: string | null): string {
  let text = (title ?? '').trim();
  if (!text) return 'New conversation';

  text = text.replace(UUID_RE, ' ');
  text = text.replace(/\b(please\s+)?call\s+[a-z][a-z0-9_]*\b/gi, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^(for|and|to)\s+/i, '');
  text = text.replace(/\s+please\.?$/i, '');
  text = text.replace(/[.,;:]+$/g, '').trim();

  return text || 'Conversation';
}
