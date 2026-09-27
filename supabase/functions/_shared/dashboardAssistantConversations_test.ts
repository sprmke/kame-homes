import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  CONVERSATION_PAGE_MAX,
  escapeIlike,
  pageResult,
  parseConversationListQuery,
  parseConversationPatch,
} from './dashboardAssistantConversations.ts';

Deno.test('parseConversationListQuery clamps paging and escapes search', () => {
  const query = parseConversationListQuery(
    new URLSearchParams({ offset: '-4', limit: '999', q: ' 50%_off ' })
  );
  assertEquals(query.offset, 0);
  assertEquals(query.limit, CONVERSATION_PAGE_MAX);
  assertEquals(query.titlePattern, '%50\\%\\_off%');
  assertEquals(query.archived, false);
  assertEquals(parseConversationListQuery(new URLSearchParams()).titlePattern, null);
  assertEquals(escapeIlike('a\\b'), 'a\\\\b');
});

Deno.test('pageResult trims the probe row and reports the next offset', () => {
  assertEquals(pageResult([1, 2, 3], { offset: 0, limit: 2 }), {
    conversations: [1, 2],
    nextOffset: 2,
  });
  assertEquals(pageResult([1, 2], { offset: 4, limit: 2 }), {
    conversations: [1, 2],
    nextOffset: null,
  });
});

Deno.test('parseConversationPatch handles title, pin and archive', () => {
  const now = new Date('2026-09-28T00:00:00Z');
  assertEquals(parseConversationPatch({ title: '  Weekly   report ' }, now), {
    ok: true,
    patch: { title: 'Weekly report' },
  });
  assertEquals(parseConversationPatch({ pinned: true }, now), {
    ok: true,
    patch: { pinned_at: now.toISOString() },
  });
  assertEquals(parseConversationPatch({ archived: true }, now), {
    ok: true,
    patch: { archived_at: now.toISOString(), pinned_at: null },
  });
  assertEquals(parseConversationPatch({ archived: false }, now), {
    ok: true,
    patch: { archived_at: null },
  });
});

Deno.test('parseConversationPatch rejects bad input', () => {
  assertEquals(parseConversationPatch({}).ok, false);
  assertEquals(parseConversationPatch({ title: '   ' }).ok, false);
  assertEquals(parseConversationPatch({ pinned: 'yes' }).ok, false);
  assertEquals(parseConversationPatch({ owner: 'x' }).ok, false);
});
