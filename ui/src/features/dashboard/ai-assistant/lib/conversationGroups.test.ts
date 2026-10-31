import { describe, expect, it } from 'vitest';

import { groupConversations } from '@/features/dashboard/ai-assistant/lib/conversationGroups';

const row = (id: string, lastMessageAt: string, pinned = false) => ({
  id,
  title: id,
  property_id: null,
  created_at: lastMessageAt,
  last_message_at: lastMessageAt,
  pinned_at: pinned ? lastMessageAt : null,
  archived_at: null,
});

describe('groupConversations', () => {
  const now = new Date(2026, 8, 28, 10, 0, 0);

  it('puts pinned first, then day buckets, and drops empty groups', () => {
    const groups = groupConversations(
      [
        row('a', new Date(2026, 8, 28, 9).toISOString()),
        row('b', new Date(2026, 8, 27, 22).toISOString()),
        row('c', new Date(2026, 8, 20).toISOString()),
        row('d', new Date(2026, 8, 1).toISOString(), true),
      ],
      now
    );
    expect(groups.map((group) => [group.key, group.rows.map((r) => r.id)])).toEqual([
      ['pinned', ['d']],
      ['today', ['a']],
      ['yesterday', ['b']],
      ['earlier', ['c']],
    ]);
  });

  it('returns nothing for an empty list', () => {
    expect(groupConversations([], now)).toEqual([]);
  });
});
