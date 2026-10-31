import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/page-editor/lib/showcaseTemplatePresentation';

describe('showcaseTemplatePresentation', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
