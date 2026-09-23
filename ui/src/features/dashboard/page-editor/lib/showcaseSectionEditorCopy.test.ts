import { describe, expect, it } from 'vitest';

import { resolveShowcaseSectionEditorBaselines, resolveShowcaseSectionEditorDisplayCopy, buildShowcaseSectionCopyOverride, resolveShowcaseSectionEditorDisplayCta, buildShowcaseSectionCtaOverride, showcaseEditorBaselineConfigKey, SHOWCASE_SECTION_CTA_BASELINE } from '@/features/dashboard/page-editor/lib/showcaseSectionEditorCopy';

describe('resolveShowcaseSectionEditorBaselines', () => {

  it('resolveShowcaseSectionEditorBaselines is exported', () => {
    expect(typeof resolveShowcaseSectionEditorBaselines).toBe('function');
  });

});

describe('resolveShowcaseSectionEditorDisplayCopy', () => {

  it('resolveShowcaseSectionEditorDisplayCopy is exported', () => {
    expect(typeof resolveShowcaseSectionEditorDisplayCopy).toBe('function');
  });

});

describe('buildShowcaseSectionCopyOverride', () => {

  it('buildShowcaseSectionCopyOverride is exported', () => {
    expect(typeof buildShowcaseSectionCopyOverride).toBe('function');
  });

});

describe('resolveShowcaseSectionEditorDisplayCta', () => {

  it('resolveShowcaseSectionEditorDisplayCta is exported', () => {
    expect(typeof resolveShowcaseSectionEditorDisplayCta).toBe('function');
  });

});

describe('buildShowcaseSectionCtaOverride', () => {

  it('buildShowcaseSectionCtaOverride is exported', () => {
    expect(typeof buildShowcaseSectionCtaOverride).toBe('function');
  });

});

describe('showcaseEditorBaselineConfigKey', () => {

  it('showcaseEditorBaselineConfigKey is exported', () => {
    expect(typeof showcaseEditorBaselineConfigKey).toBe('function');
  });

});

describe('SHOWCASE_SECTION_CTA_BASELINE', () => {
  it('is defined', () => {
    expect(SHOWCASE_SECTION_CTA_BASELINE).toBeDefined();
  });
});
