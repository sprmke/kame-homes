/** Client-side edit/unsend eligibility — mirrors `chatMessageLifecycle.ts` on the edge. */

export type ChatActionMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  sent_at: string;
  read_at?: string | null;
  deleted_at?: string | null;
};

function hasLaterMessage(
  messages: ChatActionMessage[],
  afterSentAt: string,
  direction: 'inbound' | 'outbound'
): boolean {
  return messages.some(
    (m) => !m.deleted_at && m.direction === direction && m.sent_at > afterSentAt
  );
}

/** Host may edit/unsend own outbound until the guest reads or sends a newer inbound. */
export function canHostEditMessage(
  message: ChatActionMessage,
  messages: ChatActionMessage[]
): boolean {
  if (message.direction !== 'outbound') return false;
  if (message.id.startsWith('optimistic-')) return false;
  if (message.deleted_at) return false;
  if (message.read_at) return false;
  if (hasLaterMessage(messages, message.sent_at, 'inbound')) return false;
  return true;
}

export function canHostUnsendMessage(
  message: ChatActionMessage,
  messages: ChatActionMessage[]
): boolean {
  return canHostEditMessage(message, messages);
}

/** Guest may edit/unsend own inbound until the host reads or sends a newer outbound. */
export function canGuestEditMessage(
  message: ChatActionMessage,
  messages: ChatActionMessage[]
): boolean {
  if (message.direction !== 'inbound') return false;
  if (message.id.startsWith('optimistic-')) return false;
  if (message.deleted_at) return false;
  if (message.read_at) return false;
  if (hasLaterMessage(messages, message.sent_at, 'outbound')) return false;
  return true;
}

export function canGuestUnsendMessage(
  message: ChatActionMessage,
  messages: ChatActionMessage[]
): boolean {
  return canGuestEditMessage(message, messages);
}

const ELIGIBILITY_ERRORS = new Set([
  'Guest already replied',
  'Host already replied',
  'Message already read',
  'Cannot edit this message',
]);

export function isChatActionEligibilityError(message: string): boolean {
  return ELIGIBILITY_ERRORS.has(message);
}
