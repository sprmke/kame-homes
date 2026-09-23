import { describe, expect, it } from 'vitest';

import { buildStayGuideTemplateThumbData, STAY_GUIDE_TEMPLATE_THUMB_FRAME_WIDTH, STAY_GUIDE_TEMPLATE_THUMB_CLIP_HEIGHT } from '@/features/dashboard/page-editor/lib/stayGuideTemplateThumbData';

describe('buildStayGuideTemplateThumbData', () => {

  it('buildStayGuideTemplateThumbData is exported', () => {
    expect(typeof buildStayGuideTemplateThumbData).toBe('function');
  });

});

describe('STAY_GUIDE_TEMPLATE_THUMB_FRAME_WIDTH', () => {
  it('is defined', () => {
    expect(STAY_GUIDE_TEMPLATE_THUMB_FRAME_WIDTH).toBeDefined();
  });
});

describe('STAY_GUIDE_TEMPLATE_THUMB_CLIP_HEIGHT', () => {
  it('is defined', () => {
    expect(STAY_GUIDE_TEMPLATE_THUMB_CLIP_HEIGHT).toBeDefined();
  });
});
