import { describe, expect, it } from 'vitest';

import { contextPickerInitials, marketingTemplateThumbnail } from '@/features/dashboard/ai-assistant/lib/contextPickerCatalogVisual';

describe('contextPickerInitials', () => {

  it('contextPickerInitials is exported', () => {
    expect(typeof contextPickerInitials).toBe('function');
  });

});

describe('marketingTemplateThumbnail', () => {

  it('marketingTemplateThumbnail is exported', () => {
    expect(typeof marketingTemplateThumbnail).toBe('function');
  });

});
