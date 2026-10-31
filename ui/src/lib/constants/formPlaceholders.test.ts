import { describe, expect, it } from 'vitest';

import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';

describe('FORM_PLACEHOLDERS', () => {
  it('is defined', () => {
    expect(FORM_PLACEHOLDERS).toBeDefined();
  });
});
