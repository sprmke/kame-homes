import { describe, expect, it } from 'vitest';

import { quickReplyGroupLabel, platformFromQuickReplyGroup, quickReplyGroupFromPlatform, defaultQuickReplyGroupForTab, templateMatchesQuickReplyTab, templatesForConversationPlatform, INBOX_CHANNEL_ORDER } from '@/features/dashboard/inbox/lib/quickReplyGroups';

describe('quickReplyGroupLabel', () => {

  it('quickReplyGroupLabel is exported', () => {
    expect(typeof quickReplyGroupLabel).toBe('function');
  });

});

describe('platformFromQuickReplyGroup', () => {

  it('platformFromQuickReplyGroup is exported', () => {
    expect(typeof platformFromQuickReplyGroup).toBe('function');
  });

});

describe('quickReplyGroupFromPlatform', () => {

  it('quickReplyGroupFromPlatform is exported', () => {
    expect(typeof quickReplyGroupFromPlatform).toBe('function');
  });

});

describe('defaultQuickReplyGroupForTab', () => {

  it('defaultQuickReplyGroupForTab is exported', () => {
    expect(typeof defaultQuickReplyGroupForTab).toBe('function');
  });

});

describe('templateMatchesQuickReplyTab', () => {

  it('templateMatchesQuickReplyTab is exported', () => {
    expect(typeof templateMatchesQuickReplyTab).toBe('function');
  });

});

describe('templatesForConversationPlatform', () => {

  it('templatesForConversationPlatform is exported', () => {
    expect(typeof templatesForConversationPlatform).toBe('function');
  });

});

describe('INBOX_CHANNEL_ORDER', () => {
  it('is defined', () => {
    expect(INBOX_CHANNEL_ORDER).toBeDefined();
  });
});
