import { describe, expect, it } from 'vitest';

import { resolveVideoTemplateLayout, textLayoutForTemplate } from '@/features/dashboard/marketing/lib/video/videoTemplateLayouts';

describe('resolveVideoTemplateLayout', () => {

  it('resolveVideoTemplateLayout is exported', () => {
    expect(typeof resolveVideoTemplateLayout).toBe('function');
  });

});

describe('textLayoutForTemplate', () => {

  it('textLayoutForTemplate is exported', () => {
    expect(typeof textLayoutForTemplate).toBe('function');
  });

});
