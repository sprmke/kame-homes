import { describe, expect, it } from 'vitest';

import { getCollageLayout, collageLayoutsForCellCount, MAX_COLLAGE_CELLS, DEFAULT_COLLAGE_LAYOUT_ID } from '@/features/dashboard/marketing/lib/collage/collageLayouts';

describe('getCollageLayout', () => {

  it('getCollageLayout is exported', () => {
    expect(typeof getCollageLayout).toBe('function');
  });

});

describe('collageLayoutsForCellCount', () => {

  it('collageLayoutsForCellCount is exported', () => {
    expect(typeof collageLayoutsForCellCount).toBe('function');
  });

});

describe('MAX_COLLAGE_CELLS', () => {
  it('is defined', () => {
    expect(MAX_COLLAGE_CELLS).toBeDefined();
  });
});

describe('DEFAULT_COLLAGE_LAYOUT_ID', () => {
  it('is defined', () => {
    expect(DEFAULT_COLLAGE_LAYOUT_ID).toBeDefined();
  });
});
