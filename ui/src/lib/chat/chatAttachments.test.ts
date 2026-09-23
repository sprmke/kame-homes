import { describe, expect, it } from 'vitest';

import { CHAT_ATTACHMENT_ACCEPT, CHAT_MAX_ATTACHMENTS } from '@/lib/chat/chatAttachments';

describe('CHAT_ATTACHMENT_ACCEPT', () => {
  it('is defined', () => {
    expect(CHAT_ATTACHMENT_ACCEPT).toBeDefined();
  });
});

describe('CHAT_MAX_ATTACHMENTS', () => {
  it('is defined', () => {
    expect(CHAT_MAX_ATTACHMENTS).toBeDefined();
  });
});
