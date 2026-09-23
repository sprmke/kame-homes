import { describe, expect, it } from 'vitest';

import { getTelegramPreviewSamples } from '@/features/dashboard/bookings/lib/telegramPreviewSamples';

describe('getTelegramPreviewSamples', () => {

  it('getTelegramPreviewSamples is exported', () => {
    expect(typeof getTelegramPreviewSamples).toBe('function');
  });

});
