import { describe, expect, it } from 'vitest';

import { resolveShowcaseSectionEditorFields } from '@/features/dashboard/page-editor/lib/showcaseSectionEditorFields';

describe('resolveShowcaseSectionEditorFields', () => {

  it('resolveShowcaseSectionEditorFields is exported', () => {
    expect(typeof resolveShowcaseSectionEditorFields).toBe('function');
  });

});
