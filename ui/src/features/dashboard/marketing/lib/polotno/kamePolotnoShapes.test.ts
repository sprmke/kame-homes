import { describe, expect, it } from 'vitest';

import { buildKamePolotnoShapes, KAME_POLOTNO_DEFAULT_SHAPE_FILL } from '@/features/dashboard/marketing/lib/polotno/kamePolotnoShapes';

describe('buildKamePolotnoShapes', () => {

  it('buildKamePolotnoShapes is exported', () => {
    expect(typeof buildKamePolotnoShapes).toBe('function');
  });

});

describe('KAME_POLOTNO_DEFAULT_SHAPE_FILL', () => {
  it('is defined', () => {
    expect(KAME_POLOTNO_DEFAULT_SHAPE_FILL).toBeDefined();
  });
});
