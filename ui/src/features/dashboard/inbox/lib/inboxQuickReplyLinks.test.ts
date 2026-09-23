import { describe, expect, it } from 'vitest';

import { buildInboxQuickReplyLinkVars, INBOX_QUICK_REPLY_LINK_FIELDS } from '@/features/dashboard/inbox/lib/inboxQuickReplyLinks';

describe('buildInboxQuickReplyLinkVars', () => {

  it('buildInboxQuickReplyLinkVars is exported', () => {
    expect(typeof buildInboxQuickReplyLinkVars).toBe('function');
  });

});

describe('INBOX_QUICK_REPLY_LINK_FIELDS', () => {
  it('is defined', () => {
    expect(INBOX_QUICK_REPLY_LINK_FIELDS).toBeDefined();
  });
});
