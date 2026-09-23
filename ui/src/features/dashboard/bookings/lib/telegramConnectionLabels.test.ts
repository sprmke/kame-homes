import { describe, expect, it } from 'vitest';

import { telegramBotDisplayLabel, telegramChatDisplayLabel, telegramConnectionLabelsFromVerify } from '@/features/dashboard/bookings/lib/telegramConnectionLabels';

describe('telegramBotDisplayLabel', () => {

  it('telegramBotDisplayLabel is exported', () => {
    expect(typeof telegramBotDisplayLabel).toBe('function');
  });

});

describe('telegramChatDisplayLabel', () => {

  it('telegramChatDisplayLabel is exported', () => {
    expect(typeof telegramChatDisplayLabel).toBe('function');
  });

});

describe('telegramConnectionLabelsFromVerify', () => {

  it('telegramConnectionLabelsFromVerify is exported', () => {
    expect(typeof telegramConnectionLabelsFromVerify).toBe('function');
  });

});
