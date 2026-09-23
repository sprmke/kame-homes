import { describe, expect, it } from 'vitest';

import { isCollageDocument, readCollageCellRef } from '@/features/dashboard/marketing/lib/collage/collageTypes';

describe('isCollageDocument', () => {

  it('isCollageDocument is exported', () => {
    expect(typeof isCollageDocument).toBe('function');
  });

});

describe('readCollageCellRef', () => {

  it('readCollageCellRef is exported', () => {
    expect(typeof readCollageCellRef).toBe('function');
  });

});
