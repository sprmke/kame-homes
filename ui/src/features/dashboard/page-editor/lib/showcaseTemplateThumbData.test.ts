import { describe, expect, it } from 'vitest';

import { buildShowcaseTemplateThumbData, SHOWCASE_TEMPLATE_THUMB_FRAME_WIDTH, SHOWCASE_TEMPLATE_THUMB_CLIP_HEIGHT } from '@/features/dashboard/page-editor/lib/showcaseTemplateThumbData';

describe('buildShowcaseTemplateThumbData', () => {

  it('buildShowcaseTemplateThumbData is exported', () => {
    expect(typeof buildShowcaseTemplateThumbData).toBe('function');
  });

});

describe('SHOWCASE_TEMPLATE_THUMB_FRAME_WIDTH', () => {
  it('is defined', () => {
    expect(SHOWCASE_TEMPLATE_THUMB_FRAME_WIDTH).toBeDefined();
  });
});

describe('SHOWCASE_TEMPLATE_THUMB_CLIP_HEIGHT', () => {
  it('is defined', () => {
    expect(SHOWCASE_TEMPLATE_THUMB_CLIP_HEIGHT).toBeDefined();
  });
});
