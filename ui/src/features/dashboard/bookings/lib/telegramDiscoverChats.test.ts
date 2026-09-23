import { describe, expect, it } from 'vitest';

import { formatTelegramChatTypeLabel } from '@/features/dashboard/bookings/lib/telegramDiscoverChats';

describe('formatTelegramChatTypeLabel', () => {

  it('formatTelegramChatTypeLabel is exported', () => {
    expect(typeof formatTelegramChatTypeLabel).toBe('function');
  });

});
