import type { AiAssistantConversationSummary } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

export type ConversationGroup = {
  key: 'pinned' | 'today' | 'yesterday' | 'earlier';
  label: string;
  rows: AiAssistantConversationSummary[];
};

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Pinned first, then Today / Yesterday / Earlier by last activity. Empty groups are dropped. */
export function groupConversations(
  rows: AiAssistantConversationSummary[],
  now: Date = new Date()
): ConversationGroup[] {
  const today = startOfDay(now);
  const yesterday = today - 24 * 60 * 60 * 1000;
  const groups: ConversationGroup[] = [
    { key: 'pinned', label: 'Pinned', rows: [] },
    { key: 'today', label: 'Today', rows: [] },
    { key: 'yesterday', label: 'Yesterday', rows: [] },
    { key: 'earlier', label: 'Earlier', rows: [] },
  ];
  for (const row of rows) {
    if (row.pinned_at) {
      groups[0].rows.push(row);
      continue;
    }
    const at = startOfDay(new Date(row.last_message_at));
    if (at >= today) groups[1].rows.push(row);
    else if (at >= yesterday) groups[2].rows.push(row);
    else groups[3].rows.push(row);
  }
  return groups.filter((group) => group.rows.length > 0);
}
