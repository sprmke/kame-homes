import { describe, expect, it } from 'vitest';

import { platformLabel, formatInboxTime, messagingWindowExpiresAt, messagingWindowLabel, isMessagingWindowOpen } from '@/features/dashboard/inbox/lib/inboxFormat';

describe('platformLabel', () => {

  it('platformLabel is exported', () => {
    expect(typeof platformLabel).toBe('function');
  });

});

describe('formatInboxTime', () => {

  it('formatInboxTime is exported', () => {
    expect(typeof formatInboxTime).toBe('function');
  });

});

describe('messagingWindowExpiresAt', () => {

  it('messagingWindowExpiresAt is exported', () => {
    expect(typeof messagingWindowExpiresAt).toBe('function');
  });

});

describe('messagingWindowLabel', () => {

  it('messagingWindowLabel is exported', () => {
    expect(typeof messagingWindowLabel).toBe('function');
  });

});

describe('isMessagingWindowOpen', () => {

  it('isMessagingWindowOpen is exported', () => {
    expect(typeof isMessagingWindowOpen).toBe('function');
  });

});

