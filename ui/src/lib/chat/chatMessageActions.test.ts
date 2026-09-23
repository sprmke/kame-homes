import { describe, expect, it } from 'vitest';

import { canHostEditMessage, canHostUnsendMessage, canGuestEditMessage, canGuestUnsendMessage, isChatActionEligibilityError } from '@/lib/chat/chatMessageActions';

describe('canHostEditMessage', () => {

  it('canHostEditMessage is exported', () => {
    expect(typeof canHostEditMessage).toBe('function');
  });

});

describe('canHostUnsendMessage', () => {

  it('canHostUnsendMessage is exported', () => {
    expect(typeof canHostUnsendMessage).toBe('function');
  });

});

describe('canGuestEditMessage', () => {

  it('canGuestEditMessage is exported', () => {
    expect(typeof canGuestEditMessage).toBe('function');
  });

});

describe('canGuestUnsendMessage', () => {

  it('canGuestUnsendMessage is exported', () => {
    expect(typeof canGuestUnsendMessage).toBe('function');
  });

});

describe('isChatActionEligibilityError', () => {

  it('isChatActionEligibilityError is exported', () => {
    expect(typeof isChatActionEligibilityError).toBe('function');
  });

});
