import { describe, expect, it } from 'vitest';

import { buildSampleQuickReplyMergeContext, applyInboxQuickReplyMerge, INBOX_QUICK_REPLY_MERGE_FIELDS } from '@/features/dashboard/inbox/lib/inboxQuickReplyMerge';

describe('buildSampleQuickReplyMergeContext', () => {

  it('buildSampleQuickReplyMergeContext is exported', () => {
    expect(typeof buildSampleQuickReplyMergeContext).toBe('function');
  });

});

describe('applyInboxQuickReplyMerge', () => {

  it('applyInboxQuickReplyMerge is exported', () => {
    expect(typeof applyInboxQuickReplyMerge).toBe('function');
  });

});

describe('INBOX_QUICK_REPLY_MERGE_FIELDS', () => {
  it('is defined', () => {
    expect(INBOX_QUICK_REPLY_MERGE_FIELDS).toBeDefined();
  });
});
