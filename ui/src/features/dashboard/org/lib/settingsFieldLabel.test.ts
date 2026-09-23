import { describe, expect, it } from 'vitest';

import { SETTINGS_FIELD_LABEL, SETTINGS_FIELD_LABEL_COMPACT } from '@/features/dashboard/org/lib/settingsFieldLabel';

describe('SETTINGS_FIELD_LABEL', () => {
  it('is defined', () => {
    expect(SETTINGS_FIELD_LABEL).toBeDefined();
  });
});

describe('SETTINGS_FIELD_LABEL_COMPACT', () => {
  it('is defined', () => {
    expect(SETTINGS_FIELD_LABEL_COMPACT).toBeDefined();
  });
});
