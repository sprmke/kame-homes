import { describe, expect, it } from 'vitest';

import { squareImageCoverCrop, loadLogoNaturalSize } from '@/features/dashboard/marketing/lib/polotno/orgLogoCircle';

describe('squareImageCoverCrop', () => {

  it('squareImageCoverCrop is exported', () => {
    expect(typeof squareImageCoverCrop).toBe('function');
  });

});

describe('loadLogoNaturalSize', () => {

  it('loadLogoNaturalSize is exported', () => {
    expect(typeof loadLogoNaturalSize).toBe('function');
  });

});
