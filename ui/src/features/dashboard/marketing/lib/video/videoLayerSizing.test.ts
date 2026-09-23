import { describe, expect, it } from 'vitest';

import { layerUsesWidthPct, resolveLayerWidthPct, widthPctFromPointerX } from '@/features/dashboard/marketing/lib/video/videoLayerSizing';

describe('layerUsesWidthPct', () => {

  it('layerUsesWidthPct is exported', () => {
    expect(typeof layerUsesWidthPct).toBe('function');
  });

});

describe('resolveLayerWidthPct', () => {

  it('resolveLayerWidthPct is exported', () => {
    expect(typeof resolveLayerWidthPct).toBe('function');
  });

});

describe('widthPctFromPointerX', () => {

  it('widthPctFromPointerX is exported', () => {
    expect(typeof widthPctFromPointerX).toBe('function');
  });

});
