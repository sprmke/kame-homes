import { describe, expect, it } from 'vitest';

import { isStayGuideChapterSectionId, defaultStayGuideConfigV2, upgradeStayGuideConfigV1toV2, normalizeStayGuideConfigV2, stayGuideConfigForSave, STAY_GUIDE_CHAPTER_SECTION_IDS, STAY_GUIDE_SECTION_IDS } from '@/features/guest/stay-guide/lib/stayGuideConfig';

describe('isStayGuideChapterSectionId', () => {

  it('isStayGuideChapterSectionId is exported', () => {
    expect(typeof isStayGuideChapterSectionId).toBe('function');
  });

});

describe('defaultStayGuideConfigV2', () => {

  it('defaultStayGuideConfigV2 is exported', () => {
    expect(typeof defaultStayGuideConfigV2).toBe('function');
  });

});

describe('upgradeStayGuideConfigV1toV2', () => {

  it('upgradeStayGuideConfigV1toV2 is exported', () => {
    expect(typeof upgradeStayGuideConfigV1toV2).toBe('function');
  });

});

describe('normalizeStayGuideConfigV2', () => {

  it('normalizeStayGuideConfigV2 is exported', () => {
    expect(typeof normalizeStayGuideConfigV2).toBe('function');
  });

});

describe('stayGuideConfigForSave', () => {

  it('stayGuideConfigForSave is exported', () => {
    expect(typeof stayGuideConfigForSave).toBe('function');
  });

});

describe('STAY_GUIDE_CHAPTER_SECTION_IDS', () => {
  it('is defined', () => {
    expect(STAY_GUIDE_CHAPTER_SECTION_IDS).toBeDefined();
  });
});

describe('STAY_GUIDE_SECTION_IDS', () => {
  it('is defined', () => {
    expect(STAY_GUIDE_SECTION_IDS).toBeDefined();
  });
});
