import { describe, expect, it } from 'vitest';

import { formatChatBubbleTime, formatChatDateSeparator, chatMessageDayKey, isChatMessageUnsent, unsentMessageLabel, resolveOutboundDeliveryStatus } from '@/lib/chat/chatMessageFormat';

describe('formatChatBubbleTime', () => {

  it('formatChatBubbleTime is exported', () => {
    expect(typeof formatChatBubbleTime).toBe('function');
  });

});

describe('formatChatDateSeparator', () => {

  it('formatChatDateSeparator is exported', () => {
    expect(typeof formatChatDateSeparator).toBe('function');
  });

});

describe('chatMessageDayKey', () => {

  it('chatMessageDayKey is exported', () => {
    expect(typeof chatMessageDayKey).toBe('function');
  });

});

describe('isChatMessageUnsent', () => {

  it('isChatMessageUnsent is exported', () => {
    expect(typeof isChatMessageUnsent).toBe('function');
  });

});

describe('unsentMessageLabel', () => {

  it('unsentMessageLabel is exported', () => {
    expect(typeof unsentMessageLabel).toBe('function');
  });

});

describe('resolveOutboundDeliveryStatus', () => {

  it('resolveOutboundDeliveryStatus is exported', () => {
    expect(typeof resolveOutboundDeliveryStatus).toBe('function');
  });

});
