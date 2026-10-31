export type ChatReplyStatus = 'pending' | 'replied' | 'none';

export function isAwaitingHostReply(replyStatus: string | null | undefined): boolean {
  return replyStatus === 'pending';
}

export function normalizeChatReplyStatus(value: string | null | undefined): ChatReplyStatus {
  if (value === 'pending' || value === 'replied' || value === 'none') return value;
  return 'none';
}
