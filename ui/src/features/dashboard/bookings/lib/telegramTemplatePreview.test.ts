import { describe, expect, it } from 'vitest';

import { normalizeTelegramTemplateText, renderTelegramPlaceholderHighlights, applyTelegramPlaceholders } from '@/features/dashboard/bookings/lib/telegramTemplatePreview';

describe('normalizeTelegramTemplateText', () => {

  it('normalizeTelegramTemplateText is exported', () => {
    expect(typeof normalizeTelegramTemplateText).toBe('function');
  });

});

describe('renderTelegramPlaceholderHighlights', () => {

  it('renderTelegramPlaceholderHighlights is exported', () => {
    expect(typeof renderTelegramPlaceholderHighlights).toBe('function');
  });

});

describe('applyTelegramPlaceholders', () => {

  it('applyTelegramPlaceholders is exported', () => {
    expect(typeof applyTelegramPlaceholders).toBe('function');
  });

});
