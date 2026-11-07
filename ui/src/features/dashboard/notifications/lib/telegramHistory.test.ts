import { describe, expect, it } from 'vitest';

import {
  TELEGRAM_HISTORY_PREVIEW_CHARS,
  telegramHistoryPreview,
  telegramModuleMeta,
} from '@/features/dashboard/notifications/lib/telegramHistory';

describe('telegramModuleMeta', () => {
  it('names the delivery modules the product uses', () => {
    expect(telegramModuleMeta('chat').label).toBe('Chat');
    expect(telegramModuleMeta('operations').label).toBe('Operations');
    expect(telegramModuleMeta('parking').label).toBe('Parking');
    expect(telegramModuleMeta('broadcast').label).toBe('Parking request');
  });

  it('falls back for an unknown module instead of dropping the row', () => {
    expect(telegramModuleMeta('legacy-channel').label).toBe('Telegram');
  });
});

describe('telegramHistoryPreview', () => {
  it('keeps short messages intact and collapses whitespace', () => {
    expect(telegramHistoryPreview('Hello\n\n  there ')).toEqual({
      preview: 'Hello there',
      truncated: false,
    });
  });

  it('truncates long messages with an ellipsis', () => {
    const long = 'a'.repeat(TELEGRAM_HISTORY_PREVIEW_CHARS + 40);
    const result = telegramHistoryPreview(long);
    expect(result.truncated).toBe(true);
    expect(result.preview.endsWith('…')).toBe(true);
    expect(result.preview.length).toBeLessThanOrEqual(TELEGRAM_HISTORY_PREVIEW_CHARS + 1);
  });
});
