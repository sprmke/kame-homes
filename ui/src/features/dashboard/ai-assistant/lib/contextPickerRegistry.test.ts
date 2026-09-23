import { describe, expect, it } from 'vitest';

import { resolveContextPicker, ASSISTANT_NOTIFICATION_MODULE_IDS } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';

describe('resolveContextPicker', () => {

  it('resolveContextPicker is exported', () => {
    expect(typeof resolveContextPicker).toBe('function');
  });

});

describe('ASSISTANT_NOTIFICATION_MODULE_IDS', () => {
  it('is defined', () => {
    expect(ASSISTANT_NOTIFICATION_MODULE_IDS).toBeDefined();
  });
});
