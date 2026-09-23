import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/ai-assistant/lib/contextPickerIcons';

describe('contextPickerIcons', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
