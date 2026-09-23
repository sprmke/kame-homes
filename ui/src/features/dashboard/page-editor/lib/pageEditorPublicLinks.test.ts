import { describe, expect, it } from 'vitest';

import { resolvePageEditorPublicLinks } from '@/features/dashboard/page-editor/lib/pageEditorPublicLinks';

describe('resolvePageEditorPublicLinks', () => {

  it('resolvePageEditorPublicLinks is exported', () => {
    expect(typeof resolvePageEditorPublicLinks).toBe('function');
  });

});
