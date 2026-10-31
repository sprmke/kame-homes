import { describe, expect, it } from 'vitest';

import { STAY_GUIDE_STANDARD_TEMPLATE_KEYS } from '@/features/dashboard/page-editor/lib/stayGuideChapterSections';

describe('STAY_GUIDE_STANDARD_TEMPLATE_KEYS', () => {
  it('is defined', () => {
    expect(STAY_GUIDE_STANDARD_TEMPLATE_KEYS).toBeDefined();
  });
});
