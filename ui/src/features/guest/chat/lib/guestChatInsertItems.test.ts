import { describe, expect, it } from 'vitest';

import { buildGuestChatInsertItems } from '@/features/guest/chat/lib/guestChatInsertItems';

describe('buildGuestChatInsertItems', () => {

  it('buildGuestChatInsertItems is exported', () => {
    expect(typeof buildGuestChatInsertItems).toBe('function');
  });

});
