import { describe, expect, it } from 'vitest';

import { resolveShowcaseEditorStyleFields } from '@/features/guest/marketing/showcase/lib/showcaseEditorStyleFields';

describe('resolveShowcaseEditorStyleFields', () => {

  it('resolveShowcaseEditorStyleFields is exported', () => {
    expect(typeof resolveShowcaseEditorStyleFields).toBe('function');
  });

});
