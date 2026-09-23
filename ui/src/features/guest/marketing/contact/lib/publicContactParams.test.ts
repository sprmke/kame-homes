import { describe, expect, it } from 'vitest';

import { parsePublicContactCategory, publicContactPath } from '@/features/guest/marketing/contact/lib/publicContactParams';

describe('parsePublicContactCategory', () => {

  it('parsePublicContactCategory is exported', () => {
    expect(typeof parsePublicContactCategory).toBe('function');
  });

});

describe('publicContactPath', () => {

  it('publicContactPath is exported', () => {
    expect(typeof publicContactPath).toBe('function');
  });

});
