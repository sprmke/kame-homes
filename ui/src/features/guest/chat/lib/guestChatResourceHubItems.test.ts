import { describe, expect, it } from 'vitest';

import { buildGuestChatResourceHubItems } from '@/features/guest/chat/lib/guestChatResourceHubItems';

describe('buildGuestChatResourceHubItems', () => {

  it('buildGuestChatResourceHubItems is exported', () => {
    expect(typeof buildGuestChatResourceHubItems).toBe('function');
  });

});
