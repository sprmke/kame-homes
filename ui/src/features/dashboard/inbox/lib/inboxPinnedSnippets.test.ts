import { describe, expect, it } from 'vitest';

import { readInboxPinnedSnippets, newInboxPinnedSnippetId, INBOX_PINNED_SNIPPETS_MAX } from '@/features/dashboard/inbox/lib/inboxPinnedSnippets';

describe('readInboxPinnedSnippets', () => {

  it('readInboxPinnedSnippets is exported', () => {
    expect(typeof readInboxPinnedSnippets).toBe('function');
  });

});

describe('newInboxPinnedSnippetId', () => {

  it('newInboxPinnedSnippetId is exported', () => {
    expect(typeof newInboxPinnedSnippetId).toBe('function');
  });

});

describe('INBOX_PINNED_SNIPPETS_MAX', () => {
  it('is defined', () => {
    expect(INBOX_PINNED_SNIPPETS_MAX).toBeDefined();
  });
});
