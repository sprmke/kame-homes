import { describe, expect, it } from 'vitest';

import { resolveShowcaseTemplatePickerPalette } from '@/features/dashboard/page-editor/lib/resolveShowcaseTemplatePickerPalette';

describe('resolveShowcaseTemplatePickerPalette', () => {

  it('resolveShowcaseTemplatePickerPalette is exported', () => {
    expect(typeof resolveShowcaseTemplatePickerPalette).toBe('function');
  });

});
