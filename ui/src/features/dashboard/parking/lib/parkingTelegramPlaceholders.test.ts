import { describe, expect, it } from 'vitest';

import { PARKING_TELEGRAM_PLACEHOLDER_KEYS } from '@/features/dashboard/parking/lib/parkingTelegramPlaceholders';

describe('PARKING_TELEGRAM_PLACEHOLDER_KEYS', () => {
  it('is defined', () => {
    expect(PARKING_TELEGRAM_PLACEHOLDER_KEYS).toBeDefined();
  });
});
