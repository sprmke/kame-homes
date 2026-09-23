import { describe, expect, it } from 'vitest';

import { isAwaitingHostReply, normalizeChatReplyStatus } from '@/lib/chat/chatReplyStatus';

describe('isAwaitingHostReply', () => {

  it('isAwaitingHostReply is exported', () => {
    expect(typeof isAwaitingHostReply).toBe('function');
  });

});

describe('normalizeChatReplyStatus', () => {

  it('normalizeChatReplyStatus is exported', () => {
    expect(typeof normalizeChatReplyStatus).toBe('function');
  });

});
