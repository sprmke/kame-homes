export type ChatSearchMatch = {
  messageId: string;
  start: number;
  end: number;
};

export type ChatSearchMessage = {
  id: string;
  body_text?: string | null;
};

/** All case-insensitive substring matches in thread order (oldest → newest). */
export function findThreadSearchMatches(
  messages: ChatSearchMessage[],
  query: string
): ChatSearchMatch[] {
  const q = query.trim();
  if (!q) return [];

  const lowerQ = q.toLowerCase();
  const matches: ChatSearchMatch[] = [];

  for (const message of messages) {
    const text = message.body_text ?? '';
    if (!text) continue;

    const lower = text.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(lowerQ, from);
      if (index === -1) break;
      matches.push({
        messageId: message.id,
        start: index,
        end: index + q.length,
      });
      from = index + Math.max(lowerQ.length, 1);
    }
  }

  return matches;
}

/** @deprecated Use findThreadSearchMatches — search no longer filters the thread list. */
export function filterThreadMessages<T extends ChatSearchMessage>(
  messages: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return messages;
  return messages.filter((message) => message.body_text?.toLowerCase().includes(q));
}
